import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { erc20Abi, encodeFunctionData, maxUint256, toRlp } from "viem";
import { controller, fixtureAbi } from "../engine/actions.ts";
import { unpack, admission, frameTest } from "../engine/frames.ts";
import { runInNewContext } from "node:vm";
test("nested multicall retains the inner unlimited approval and original calldata", async () => {
  const act = controller(mkdtempSync(join(tmpdir(), "cx-decode-")));
  await act("open", { name: "decode" });
  try {
    const spender = "0x1111111111111111111111111111111111111111";
    const approval = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, maxUint256],
    });
    const data = encodeFunctionData({
      abi: fixtureAbi,
      functionName: "multicall",
      args: [[approval]],
    });
    const row = await act("capture", {
      method: "eth_call",
      params: [{ data }],
    });
    assert.equal(row.output.children[0].finding, "Unlimited token approval");
    assert.equal(row.input.params[0].data, data);
  } finally {
    await act("close");
  }
});
test("parameterless provider requests remain valid capture evidence", async () => {
  const act = controller(mkdtempSync(join(tmpdir(), "cx-capture-")));
  await act("open", { name: "capture" });
  try {
    const row = await act("capture", {
      method: "eth_chainId",
      params: [],
      response: "0x7a69",
    });
    assert.equal(row.output.method, "eth_chainId");
    assert.deepEqual(row.input.params, []);
  } finally {
    await act("close");
  }
});
test("type 06 wire payload exposes frame boundaries and portable replay regression", () => {
  const addr = "0x1111111111111111111111111111111111111111";
  const raw =
    "0x06" +
    toRlp([
      "0x7a69",
      "0x",
      addr,
      [["0x01", "0x", addr, ["0x10", "0x"], "0x", "0x"]],
      [],
      ["0x", "0x"],
      [],
    ]).slice(2);
  const fixture = unpack(raw);
  assert.equal(admission(fixture, 0).boundaries[0].mode, "VERIFY");
  assert.equal(admission(fixture, 0).admitted, true);
  runInNewContext(
    frameTest(fixture, 0, true).split("\n").slice(1).join("\n"),
    { assert },
    { timeout: 1000 },
  );
});
