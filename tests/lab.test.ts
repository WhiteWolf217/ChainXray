import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { controller } from "../engine/actions.ts";
import { rpc } from "../engine/lab.ts";
test("vault takeover is reproduced in Forge and isolated by rollback", async () => {
  const act = controller(mkdtempSync(join(tmpdir(), "cx-test-")));
  await act("open", { name: "lab" });
  try {
    const { accounts } = await act("start");
    const {
      output: { target },
    } = await act("deploy");
    const {
      input: {
        params: [tx],
      },
    } = await act("example");
    const original = await rpc("eth_getStorageAt", [target, "0x0", "latest"]);
    const simulation = await act("simulate", tx);
    assert.equal(simulation.output.finding, "Unauthorized owner change");
    assert.equal(
      simulation.output.after.slot0.slice(-40),
      accounts[1].slice(2),
    );
    assert.equal(
      await rpc("eth_getStorageAt", [target, "0x0", "latest"]),
      original,
    );
    assert.equal(
      (await act("campaign", { cases: [tx, tx] })).output.results.length,
      2,
    );
    assert.match((await act("reproduce")).output.output, /1 passed/);
    const { rows, frame } = await act("state");
    assert.equal((await act("frame", frame)).output.admitted, true);
    assert.equal((await act("frame", frame)).output.admitted, false);
    await act("open", { name: "restored" });
    await act("restore", { rows });
    assert.deepEqual((await act("state")).rows, rows);
    await assert.rejects(
      act("restore", { rows: [{ ...rows[0], kind: "tampered" }] }),
      /integrity/,
    );
  } finally {
    await act("close");
  }
});
