import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";
const root = resolve(process.argv[2] ?? "src-tauri/resources");
const proc = spawn(
  join(root, "node.exe"),
  ["engine/server.mjs", "--parent-pipe"],
  {
    cwd: root,
    stdio: ["pipe", "pipe", "inherit"],
    env: {
      ...process.env,
      CHAINXRAY_HOME: mkdtempSync(join(tmpdir(), "cx-portable-")),
    },
    windowsHide: true,
  },
);
try {
  const url = await new Promise((r, j) => {
    createInterface({ input: proc.stdout }).once("line", r);
    proc.once("exit", () => j(Error("Engine closed")));
    proc.once("error", j);
  });
  const { origin, hash } = new URL(url);
  const html = await (await fetch(origin)).text();
  const client = html.match(/src="([^"]+\.js)"/)[1];
  assert.equal((await fetch(origin + client)).status, 200);
  assert.equal((await fetch(origin + "/api", { method: "POST" })).status, 403);
  async function api(action, payload = {}) {
    const res = await fetch(origin + "/api", {
      method: "POST",
      headers: { authorization: "Bearer " + hash.slice(1) },
      body: JSON.stringify({ action, payload }),
    });
    const value = await res.json();
    assert.ok(res.ok, JSON.stringify(value));
    return value;
  }
  await api("open", { name: "portable" });
  const captureToken = new URL(await api("pair")).hash.slice(1);
  const captureCall = (action, payload = {}) =>
    fetch(origin + "/api", {
      method: "POST",
      headers: { authorization: "Bearer " + captureToken },
      body: JSON.stringify({ action, payload }),
    });
  assert.equal((await captureCall("state")).status, 403);
  assert.equal(
    (
      await captureCall("capture", {
        method: "eth_chainId",
        params: [],
        response: "0x7a69",
      })
    ).status,
    200,
  );
  await api("start");
  await api("deploy");
  const capture = await api("example");
  assert.equal(
    (await api("simulate", capture.input.params[0])).output.finding,
    "Unauthorized owner change",
  );
  assert.match((await api("reproduce")).output.output, /1 passed/);
  await api("close");
  console.log(
    "Portable UI assets, API authentication, vault simulation and offline Forge passed.",
  );
} finally {
  proc.stdin.end();
}
