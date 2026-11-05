import { unpack, admission, frameTest } from "./frames.ts";
import { uniswapAbi, analyzeUniswap, mutateUniswap } from './uniswap.ts';
import {publicFinding,publishFinding,queryFindings} from './public-findings.ts';
import {requestUniswapQuote} from './uniswap-api.ts';
import { investigate } from "./investigate.ts";
import { permitAbi, observations } from "./rules.ts";
import { configured, submit } from "./devnet.ts";
import {
  decodeFunctionData,
  encodeFunctionData,
  parseAbi,
  erc20Abi,
  maxUint256,
  parseTransaction,
} from "viem";
import { Workspace } from "./store.ts";
import * as lab from "./lab.ts";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import {
  assertActionPayload,
  data,
  object,
} from "./validation.ts";
export const fixtureAbi = parseAbi([
  "function setOwner(address next)",
  "function owner() view returns(address)",
  "function multicall(bytes[] calls)",
]);
const fixture = JSON.parse(
  readFileSync(
    new URL("../fixtures/frames/demo.json", import.meta.url),
    "utf8",
  ),
);
const json = (x: any) =>
  JSON.parse(
    JSON.stringify(x, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
export function decodeCalldata(input: unknown, abi: any[] = [], depth = 0): any {
  const calldata = data(input);
  let decoded;
  try {
    decoded = decodeFunctionData({
      abi: [...abi, ...fixtureAbi, ...permitAbi, ...erc20Abi, ...uniswapAbi],
      data: calldata,
    });
  } catch {
    return { selector: calldata.slice(0, 10), functionName: "unknown" };
  }
  const args: any = decoded.args ?? [];
  return json({
    ...decoded,
    uniswap: analyzeUniswap(calldata),
    children:
      decoded.functionName === "multicall" && depth < 4 && Array.isArray(args[0])
        ? args[0].slice(0, 64).map((d: string) =>
            decodeCalldata(d, abi, depth + 1),
          )
        : [],
    finding:
      decoded.functionName === "approve" && args[1] === maxUint256
        ? "Unlimited token approval"
        : null,
  });
}
export function controller(root: string) {
  mkdirSync(root, { recursive: true });
  let ws: Workspace | undefined,
    cancelled = false,
    busy = false;
  async function run(action: string, p: any = {}): Promise<any> {
    const envelope = object(p, "Action payload must be an object");
    p = assertActionPayload(action, envelope);
    if (action === "open") {
      const next = new Workspace(root, p.name);
      lab.stop();
      ws?.db.close();
      ws = next;
    }
    if (action === "close") {
      lab.stop();
      ws?.db.close();
      ws = undefined;
    }
    if (["open", "close", "state"].includes(action))
      return {
        devnet: configured()?.chain,
        workspace: ws?.name,
        workspaces: readdirSync(root)
          .filter((n) => n.endsWith(".sqlite"))
          .map((n) => n.slice(0, -7)),
        lab: lab.status(),
        rows: ws?.rows() ?? [],
        frame: fixture,
      };
    if (!ws) throw Error("Open a workspace first");
    if(action === 'uniswap_quote') {
      const result=await requestUniswapQuote(p);
      return ws.record(action,result.request,result,result.request.tokenInChainId);
    }
    if(action === 'public_preview') return publicFinding(ws.rows().find(r=>r.id===p.id));
    if(action === 'arkiv_query') return json(await queryFindings(String(p.owner)));
    if(action === 'arkiv_publish') {
      const value=publicFinding(ws.rows().find(r=>r.id===p.id));
      if(p.confirmation !== JSON.stringify(value)) throw Error('Review the publication preview before publishing.');
      return ws.record(action,value,json(await publishFinding(value)),'7794095');
    }
    if (action === 'uniswap_mutate') {
      const tx = object(p.transaction);
      return {...tx, data:mutateUniswap(data(tx.data), object(p.changes))};
    }
    if (action === "investigate") {
      const row = ws.rows().find((r) => r.id === p.id);
      return ws.record(action, p, await investigate(p.model, row));
    }
    if (action === "submit") {
      if (typeof p.raw !== "string" || typeof p.confirmation !== "string")
        throw Error("Signed frame and confirmation are required");
      const result = await submit(p);
      return ws.record(
        "devnet submission",
        { raw: p.raw },
        result,
        result.chain,
      );
    }
    if (action === "restore") {
      ws.restore(p.rows);
      return true;
    }
    if (action === "start") return lab.start();
    if (action === "account")
      return ws.record(action, {}, await lab.newAccount());
    if (action === "stop") return lab.stop();
    if (action === "snapshot" || action === "reset")
      return ws.record(action, {}, await lab[action]());
    if (action === "deploy") return ws.record(action, {}, await lab.deploy());
    if (action === "abi") {
      return ws.record(action, p, {});
    }
    if (action === "decode") {
      const abi = Array.isArray(p.abi) ? p.abi : [];
      return ws.record(action, p, decodeCalldata(p.data, abi));
    }
    if (action === "scan") {
      const findings = ws
        .rows()
        .filter((row) => row.kind === "capture" && row.output?.finding)
        .map((row) => ({ evidenceId: row.id, finding: row.output.finding }));
      return ws.record(action, {}, { findings, scanned: ws.rows().length });
    }
    if (action === "example") {
      const { accounts, target } = lab.status();
      if (!target) throw Error("Deploy the vault first");
      p = {
        method: "eth_sendTransaction",
        params: [
          {
            from: accounts[1],
            to: target,
            data: encodeFunctionData({
              abi: fixtureAbi,
              functionName: "setOwner",
              args: [accounts[1] as any],
            }),
          },
        ],
      };
      action = "capture";
    }
    if (action === "capture") {
      if (
        !/^(eth_|wallet_|personal_sign$)/.test(p.method) ||
        !Array.isArray(p.params)
      )
        throw Error("Expected a provider request with method and params");
      let tx = p.params[0];
      if (p.method === "eth_sendRawTransaction") tx = parseTransaction(tx);
      const abi =
        ws
          .rows()
          .find(
            (r) =>
              r.kind === "abi" &&
              r.input.address?.toLowerCase() === tx?.to?.toLowerCase(),
          )?.input.abi ?? [];
      const decoded = tx?.data
        ? decodeCalldata(tx.data, abi)
        : { method: p.method, params: json(p.params) };
      if (p.method === "eth_signTypedData_v4") {
        const typed =
          typeof p.params[1] === "string"
            ? JSON.parse(p.params[1])
            : p.params[1];
        decoded.typedData = {
          domain: typed.domain,
          primaryType: typed.primaryType,
          message: typed.message,
        };
      }
      const warnings = [...observations(p, decoded, ws.rows()), ...(decoded.uniswap?.warnings ?? [])];
      return ws.record(action, p, {
        ...decoded,
        warnings,
        finding: warnings[0] ?? null,
      }, typeof p.captureChainId==='string' && /^0x[0-9a-f]{1,16}$/i.test(p.captureChainId) ? BigInt(p.captureChainId).toString() : 'unknown');
    }
    if (action === "simulate")
      return ws.record(action, p, await lab.simulate(p));
    if (action === "campaign") {
      if (!Array.isArray(p.cases) || !p.cases.length || p.cases.length > 32)
        throw Error("Supply 1–32 mutations");
      cancelled = false;
      const end = Date.now() + 30000,
        results = [];
      for (const tx of p.cases) {
        if (cancelled || Date.now() > end) break;
        try {
          results.push(ws.record("mutation", tx, await lab.simulate(tx)).id);
        } catch (e) {
          results.push(ws.record("mutation", tx, { error: String(e) }).id);
        }
      }
      return ws.record(action, p, {
        results,
        cancelled,
        truncated: results.length < p.cases.length,
      });
    }
    if (action === "reproduce") {
      const f = ws
        .rows()
        .find((r) => r.output?.finding === "Unauthorized owner change");
      if (!f) throw Error("Simulate the vault takeover first");
      return ws.record(action, { evidence: f.id }, lab.reproduce());
    }
    if (action === "frame") {
      if (p.raw) p = unpack(p.raw);
      if (!Array.isArray(p.frames) || p.frames.length > 64)
        throw Error("Expected up to 64 frames");
      const expected = ws
        .rows()
        .filter(
          (r) =>
            r.kind === "frame" &&
            r.output.admitted &&
            r.input.sender.toLowerCase() === String(p.sender).toLowerCase(),
        ).length;
      const result = admission(p, expected);
      return ws.record(action, p, {
        ...result,
        test: frameTest(p, expected, result.admitted),
      });
    }
    throw Error("Unknown action");
  }
  return async (action: string, p: any = {}) => {
    if (action === "cancel") {
      cancelled = true;
      return true;
    }
    if (busy) throw Error("Engine busy");
    busy = true;
    try {
      return await run(action, p);
    } finally {
      busy = false;
    }
  };
}
