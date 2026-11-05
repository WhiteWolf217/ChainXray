import { fromRlp } from "viem";
export function unpack(raw: string) {
  if (!/^0x06(?:[0-9a-f]{2})+$/i.test(raw) || raw.length > 131074)
    throw Error("Expected a type 0x06 RLP payload");
  const fields = fromRlp(("0x" + raw.slice(4)) as any);
  if (
    !Array.isArray(fields) ||
    fields.length !== 7 ||
    !Array.isArray(fields[3]) ||
    fields[3].length > 64
  )
    throw Error("Invalid frame envelope");
  const number = (hex: any) => {
    const v = BigInt(hex === "0x" ? 0 : hex);
    if (v > BigInt(Number.MAX_SAFE_INTEGER))
      throw Error("Integer outside local fixture range");
    return Number(v);
  };
  return {
    chain_id: number(fields[0]),
    nonce: number(fields[1]),
    sender: fields[2],
    frames: fields[3].map((f: any) => {
      if (
        !Array.isArray(f) ||
        f.length !== 6 ||
        !Array.isArray(f[3]) ||
        f[3].length !== 2
      )
        throw Error("Invalid encoded frame");
      return {
        mode: number(f[0]),
        flags: number(f[1]),
        target: f[2],
        limits: f[3].map(number),
        value: f[4],
        data: f[5],
      };
    }),
    signatures: fields[4],
    fees: fields[5],
    blob_versioned_hashes: fields[6],
  };
}
// Keep this policy self-contained so an evidence record can export an executable regression.
export function admission(p: any, expected: number) {
  const address = (v: any) =>
    typeof v === "string" && /^0x[a-f0-9]{40}$/i.test(v);
  const bytes = (v: any) =>
    typeof v === "string" && /^0x(?:[a-f0-9]{2})*$/i.test(v);
  const nonNegativeInteger = (v: any) =>
    Number.isSafeInteger(v) && v >= 0;
  const valid =
    p.chain_id === 31337 &&
    address(p.sender) &&
    Number.isSafeInteger(p.nonce) &&
    p.nonce >= 0 &&
    Array.isArray(p.frames) &&
    p.frames.length > 0 &&
    p.frames.length <= 64 &&
    p.frames.every(
      (f: any) =>
        f &&
        [0, 1, 2].includes(f.mode) &&
        Number.isInteger(f.flags) &&
        f.flags >= 0 &&
        f.flags <= (f.mode === 1 ? 3 : 7) &&
         (address(f.target) || f.target === "0x") &&
         bytes(f.data) &&
         Array.isArray(f.limits) &&
         f.limits.length === 2 &&
         f.limits.every(nonNegativeInteger) &&
         (nonNegativeInteger(f.value) || bytes(f.value)),
    );
  return {
    policy: "Local fixture admission model",
    expectedNonce: expected,
    admitted: !!valid && p.nonce === expected,
    reason: !valid
      ? "Malformed fixture"
      : p.nonce !== expected
        ? "Nonce mismatch"
        : "Accepted",
    verification: "not performed by the local fixture model",
    execution: "not performed by the local fixture model",
    boundaries: (p.frames ?? []).map((f: any, index: number) => ({
      index,
      mode: ["DEFAULT", "VERIFY", "SENDER"][f?.mode],
      target: f?.target,
      data: f?.data,
    })),
  };
}
export function frameTest(p: any, expected: number, admitted: boolean) {
  return (
    'import assert from "node:assert/strict";\nconst policy = ' +
    admission.toString() +
    ";\nconst input = " +
    JSON.stringify(p, null, 2) +
    ";\nassert.equal(policy(input," +
    expected +
    ").admitted," +
    admitted +
    ");\n" +
    (admitted
      ? "assert.equal(policy(input," + (expected + 1) + ").admitted,false);\n"
      : "")
  );
}
