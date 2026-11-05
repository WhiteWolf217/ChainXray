import { decodeEventLog, erc20Abi, parseAbi } from "viem";
export const permitAbi = parseAbi([
  "function permit(address owner,address spender,uint256 value,uint256 deadline,uint8 v,bytes32 r,bytes32 s)",
]);
export function observations(request: any, decoded: any, history: any[]) {
  const result: string[] = [];
  const tx = request.params[0];
  if (decoded.finding) result.push(decoded.finding);
  if (
    tx?.from &&
    tx.nonce !== undefined &&
    history.some(
      (r) =>
        r.kind === "capture" &&
        r.input.params[0]?.from?.toLowerCase() === tx.from.toLowerCase() &&
        r.input.params[0]?.nonce === tx.nonce,
    )
  )
    result.push("Repeated sender nonce in captured requests");
  if (
    decoded.functionName === "permit" &&
    history.some(
      (r) =>
        r.kind === "capture" &&
        r.input.params[0]?.to === tx.to &&
        r.input.params[0]?.data === tx.data,
    )
  )
    result.push("Repeated permit signature in capture");
  return result;
}
export function transfers(logs: any[]) {
  return logs.flatMap((log) => {
    try {
      const decoded = decodeEventLog({
        abi: erc20Abi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "Transfer") return [];
      return [
        {
          asset: log.address,
          from: decoded.args.from,
          to: decoded.args.to,
          amount: decoded.args.value.toString(),
        },
      ];
    } catch {
      return [];
    }
  });
}
export function delegates(trace: any): boolean {
  return trace?.type === "DELEGATECALL" || (trace?.calls ?? []).some(delegates);
}
