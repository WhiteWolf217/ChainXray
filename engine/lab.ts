import { delegates, transfers } from "./rules.ts";
import { fileURLToPath } from "node:url";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { randomBytes } from "node:crypto";
import { createHash } from "node:crypto";
import {
  readFileSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";

const MAX_RPC_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_EVIDENCE_PAYLOAD_BYTES = 1_000_000;
const bounded = (value: unknown, limit = MAX_EVIDENCE_PAYLOAD_BYTES): unknown => {
  const encoded = JSON.stringify(value) ?? "undefined";
  if (Buffer.byteLength(encoded) <= limit) return value;
  return {
    truncated: true,
    bytes: Buffer.byteLength(encoded),
    sha256: createHash("sha256").update(encoded).digest("hex"),
  };
};
const resolveTool = (environment: string, relative: string) => {
  const configured = process.env[environment];
  if (configured !== undefined) {
    if (!isAbsolute(configured) || !existsSync(configured))
      throw Error(`${environment} must be an absolute existing file`);
    return configured;
  }
  const bundled = fileURLToPath(new URL(relative, import.meta.url));
  if (!existsSync(bundled))
    throw Error(`Bundled tool is missing: ${relative}`);
  return bundled;
};

const anvil = () =>
  resolveTool(
    "CHAINXRAY_ANVIL_PATH",
    "../node_modules/@foundry-rs/anvil-win32-amd64/bin/anvil.exe",
  );
const forge = () =>
  resolveTool(
    "CHAINXRAY_FORGE_PATH",
    "../node_modules/@foundry-rs/forge-win32-amd64/bin/forge.exe",
  );
const solc = () => resolveTool("CHAINXRAY_SOLC_PATH", "../runtime/solc.exe");
export const source = readFileSync(
  new URL("../fixtures/contracts/Vault.sol", import.meta.url),
  "utf8",
);
let checkpoint = "";
let checkpointTarget = "";
let checkpointAccounts: string[] = [];
let child: any,
  url = "",
  target = "",
  accounts: string[] = [];
export function status() {
  return {
    running: !!child,
    rpcUrl: child ? url : null,
    target,
    accounts,
    chainId: 31337,
    mode: "offline-lab",
    broadcast: false,
  };
}
export async function rpc(method: string, params: any[] = []) {
  if (!child || child.exitCode !== null)
    throw Error("Start the local lab first");
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(5000),
  });
  const text = await res.text();
  if (Buffer.byteLength(text) > MAX_RPC_RESPONSE_BYTES)
    throw Error(`RPC response exceeded ${MAX_RPC_RESPONSE_BYTES} bytes`);
  const msg = JSON.parse(text);
  if (msg.error) throw Error(msg.error.message);
  return msg.result;
}
export function stop() {
  checkpoint = "";
  checkpointTarget = "";
  child?.kill();
  child = null;
  target = "";
  accounts = [];
  return status();
}
export async function start() {
  if (child) return status();
  const socket = createServer();
  await new Promise<void>((r) => socket.listen(0, "127.0.0.1", r));
  const port = (socket.address() as any).port;
  await new Promise((r) => socket.close(r));
  url = "http://127.0.0.1:" + port;
  const proc = spawn(
    anvil(),
    [
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--chain-id",
      "31337",
      "--mnemonic-random",
      "12",
      "--steps-tracing",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  child = proc;
  proc.on("exit", () => {
    if (child === proc) {
      child = null;
      target = "";
      accounts = [];
    }
  });
  try {
    await new Promise((resolve, reject) => {
      proc.once("spawn", resolve);
      proc.once("error", reject);
    });
    let lastError;
    for (let i = 0; i < 100; i++) {
      try {
        accounts = await rpc("eth_accounts");
        break;
      } catch (error) {
        lastError = error;
        await delay(100);
      }
    }
    if (!accounts.length)
      throw Error(
        "Anvil did not become ready: " +
          String(lastError) +
          " " +
          String(lastError?.cause),
      );
    return status();
  } catch (e) {
    stop();
    throw e;
  }
}
async function waitReceipt(hash: string) {
  for (let i = 0; i < 100; i++) {
    const receipt = await rpc("eth_getTransactionReceipt", [hash]);
    if (receipt) return receipt;
    await delay(50);
  }
  throw Error("Timed out waiting for lab receipt");
}
export async function snapshot() {
  checkpoint = await rpc("evm_snapshot");
  checkpointTarget = target;
  checkpointAccounts = [...accounts];
  return { snapshot: checkpoint };
}
export async function reset() {
  if (!checkpoint || !(await rpc("evm_revert", [checkpoint])))
    throw Error("Create a snapshot first");
  target = checkpointTarget;
  accounts = [...checkpointAccounts];
  return snapshot();
}
export async function newAccount() {
  if (accounts.length >= 64) throw Error("Lab account limit reached");
  const address = "0x" + randomBytes(20).toString("hex");
  await rpc("anvil_impersonateAccount", [address]);
  await rpc("anvil_setBalance", [address, "0xde0b6b3a7640000"]);
  accounts.push(address);
  return { address, initialBalanceWei: "1000000000000000000" };
}
export async function deploy() {
  const compiler = solc();
  const compiled = JSON.parse(
    execFileSync(compiler, ["--combined-json", "bin", "-"], {
      input: source,
      encoding: "utf8",
      windowsHide: true,
      timeout: 30000,
    }),
  );
  const hash = await rpc("eth_sendTransaction", [
    {
      from: accounts[0],
      data: "0x" + compiled.contracts["<stdin>:Vault"].bin,
      gas: "0x300000",
    },
  ]);
  const receipt = await waitReceipt(hash);
  if (receipt?.status !== "0x1") throw Error("Deployment failed");
  target = receipt.contractAddress;
  return status();
}
export async function simulate(input: any) {
  const { from = accounts[1], to = target, data = "0x", value = "0x0" } = input;
  if (
    !accounts.includes(from) ||
    !/^0x[0-9a-f]{40}$/i.test(to) ||
    !/^0x(?:[0-9a-f]{2}){0,16384}$/i.test(data) ||
    !/^0x[0-9a-f]{1,64}$/i.test(value)
  )
    throw Error("Invalid lab transaction");
  const snapshot = await rpc("evm_snapshot");
  const state = async () => ({
    slot0: await rpc("eth_getStorageAt", [to, "0x0", "latest"]),
    senderBalance: await rpc("eth_getBalance", [from, "latest"]),
    targetBalance: await rpc("eth_getBalance", [to, "latest"]),
  });
  try {
    const before = await state();
    const hash = await rpc("eth_sendTransaction", [
      { from, to, data, value, gas: "0x300000" },
    ]);
    const receipt = await waitReceipt(hash);
    let trace;
    try {
      trace = await rpc("debug_traceTransaction", [
        hash,
        { tracer: "callTracer" },
      ]);
    } catch (error) {
      trace = { unavailable: String(error) };
    }
    const after = await state();
    let stateDiff;
    try {
      stateDiff = await rpc("debug_traceTransaction", [
        hash,
        { tracer: "prestateTracer", tracerConfig: { diffMode: true } },
      ]);
    } catch (error) {
      stateDiff = { unavailable: String(error) };
    }
    const movements = transfers(
      Array.isArray(receipt.logs) ? receipt.logs : [],
    ).slice(0, 1024);
    const warnings = [];
    if (delegates(trace)) warnings.push("Delegatecall executed");
    if (
      input.expectedRecipient &&
      movements.some(
        (m) => m.to.toLowerCase() !== input.expectedRecipient.toLowerCase(),
      )
    )
      warnings.push("Unexpected token recipient");
    const finding =
      to.toLowerCase() === target.toLowerCase() &&
      before.slot0 !== after.slot0 &&
      before.slot0.slice(-40) !== from.slice(2).toLowerCase()
        ? "Unauthorized owner change"
        : null;
    const evidenceReceipt = {
      ...receipt,
      logs: Array.isArray(receipt.logs) ? receipt.logs.slice(0, 1024) : [],
      logsTruncated: Array.isArray(receipt.logs) && receipt.logs.length > 1024,
    };
    return {
      from,
      to,
      data,
      value,
      snapshot,
      before,
      after,
      stateDiff: bounded(stateDiff),
      receipt: evidenceReceipt,
      trace: bounded(trace),
      movements,
      warnings,
      finding: finding ?? warnings[0] ?? null,
    };
  } finally {
    if (!(await rpc("evm_revert", [snapshot]))) {
      stop();
      throw Error("Snapshot rollback failed. Lab stopped");
    }
  }
}
export function reproduce() {
  const dir = mkdtempSync(join(tmpdir(), "chainxray-"));
  mkdirSync(join(dir, "src"));
  mkdirSync(join(dir, "test"));
  writeFileSync(join(dir, "src/Vault.sol"), source);
  const test =
    'pragma solidity ^0.8.20; import "../src/Vault.sol"; contract Attacker { function attack(Vault v) external {v.setOwner(address(this));} } contract VaultTest {function testUnauthorizedTakeover() public {Vault v=new Vault(); Attacker a=new Attacker(); require(v.owner()!=address(a)); a.attack(v); require(v.owner()==address(a));}}';
  writeFileSync(join(dir, "test/Vault.t.sol"), test);
  writeFileSync(
    join(dir, "foundry.toml"),
    '[profile.default]\nsolc_version="0.8.30"\n',
  );
  const output = execFileSync(
    forge(),
    [
      "test",
      "--offline",
      "--use",
      solc(),
      "-vv",
    ],
    { cwd: dir, encoding: "utf8", timeout: 30000, windowsHide: true },
  );
  return { dir, test, output };
}
