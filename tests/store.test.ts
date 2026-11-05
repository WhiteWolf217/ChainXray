import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Workspace, digest } from "../engine/store.ts";

test("evidence restore rejects a record with stale nested hashes", () => {
  const root = mkdtempSync(join(tmpdir(), "cx-store-"));
  const source = new Workspace(root, "source");
  const row = source.record("capture", { method: "eth_chainId", params: [] }, {});
  const { id: _id, ...body } = row;
  const forgedBody = { ...body, input: { method: "eth_accounts", params: [] } };
  const forged = { id: digest(forgedBody), ...forgedBody };
  const target = new Workspace(root, "target");
  assert.throws(() => target.restore([forged]), /integrity/);
  source.db.close();
  target.db.close();
});
