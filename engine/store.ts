import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, lstatSync } from "node:fs";
import { join } from "node:path";

export const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024;
const normalize = (value: unknown, seen = new Set<object>()): unknown => {
  if (typeof value === "bigint") return `${value}n`;
  if (Array.isArray(value)) return value.map((item) => normalize(item, seen));
  if (typeof value !== "object" || value === null) return value;
  if (seen.has(value)) throw Error("Cyclic evidence values are not supported");
  seen.add(value);
  const result = Object.fromEntries(
    Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => [key, normalize((value as Record<string, unknown>)[key], seen)]),
  );
  seen.delete(value);
  return result;
};
const serialize = (value: unknown) => JSON.stringify(normalize(value));
export const digest = (value: unknown) =>
  createHash("sha256")
    .update(serialize(value) ?? "undefined")
    .digest("hex");
const legacyDigest = (value: unknown) =>
  createHash("sha256")
    .update(
      JSON.stringify(value, (_, item) =>
        typeof item === "bigint" ? `${item}n` : item,
      ) ?? "undefined",
    )
    .digest("hex");
const encodedBytes = (value: unknown) =>
  Buffer.byteLength(serialize(value) ?? "undefined", "utf8");

const validRecord = (id: unknown, body: any): boolean =>
  typeof id === "string" &&
  typeof body === "object" &&
  body !== null &&
  body.version === 1 &&
  typeof body.workspace === "string" &&
  typeof body.session === "string" &&
  Number.isFinite(Date.parse(body.time)) &&
  typeof body.kind === "string" &&
  Object.prototype.hasOwnProperty.call(body, "input") &&
  Object.prototype.hasOwnProperty.call(body, "output") &&
  (body.inputHash === digest(body.input) || body.inputHash === legacyDigest(body.input)) &&
  (body.outputHash === digest(body.output) || body.outputHash === legacyDigest(body.output)) &&
  (digest(body) === id || legacyDigest(body) === id) &&
  encodedBytes(body) <= MAX_EVIDENCE_BYTES;

export class Workspace {
  db: DatabaseSync;
  name: string;
  session = randomUUID();
  constructor(root: string, name: string) {
    if (!/^[a-z0-9][a-z0-9_-]{0,47}$/i.test(name))
      throw Error("Use a short alphanumeric workspace name");
    mkdirSync(root, { recursive: true });
    const file = join(root, name + ".sqlite");
    if (lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink())
      throw Error("Linked database rejected");
    this.name = name;
    this.db = new DatabaseSync(file);
    const version = this.db.prepare("PRAGMA user_version").get()?.user_version;
    if (Number(version) > 1) {
      this.db.close();
      throw Error("Workspace needs a newer ChainXray version");
    }
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS evidence (id TEXT PRIMARY KEY, body TEXT NOT NULL); PRAGMA user_version=1",
    );
  }
  record(
    kind: string,
    input: unknown,
    output: unknown,
    chainId: string | number = 31337,
  ) {
    const body = {
      workspace: this.name,
      session: this.session,
      chainId,
      version: 1,
      time: new Date().toISOString(),
      kind,
      inputHash: digest(input),
      outputHash: digest(output),
      input,
      output,
    };
    if (encodedBytes(body) > MAX_EVIDENCE_BYTES)
      throw Error("Evidence record exceeds the 4 MB limit");
    const id = digest(body);
    this.db
      .prepare("INSERT OR IGNORE INTO evidence VALUES (?,?)")
      .run(id, JSON.stringify(body));
    return { id, ...body };
  }
  rows() {
    return this.db
      .prepare("SELECT * FROM evidence ORDER BY rowid DESC")
      .all()
      .map((r) => ({ id: r.id, ...JSON.parse(String(r.body)) }));
  }
  restore(rows: any[]) {
    if (!Array.isArray(rows) || rows.length > 10000)
      throw Error("Invalid evidence archive");
    this.db.exec("BEGIN");
    try {
      for (const row of [...rows].reverse()) {
        if (typeof row !== "object" || row === null || Array.isArray(row))
          throw Error("Evidence integrity check failed");
        const { id, ...body } = row ?? {};
        if (!validRecord(id, body))
          throw Error("Evidence integrity check failed");
        this.db
          .prepare("INSERT OR IGNORE INTO evidence VALUES (?,?)")
          .run(id, JSON.stringify(body));
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}
