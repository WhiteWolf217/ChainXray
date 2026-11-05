import {unpack} from "./frames.ts";
// The operator supplies a dedicated devnet at startup. The client cannot replace its URL.
export function configured() {
  const endpoint = process.env.CHAINXRAY_DEVNET_RPC,
    chain = process.env.CHAINXRAY_DEVNET_CHAIN;
  if (!endpoint || !chain) return null;
  const url = new URL(endpoint);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    !/^\d+$/.test(chain) ||
    BigInt(chain) <= 1n
  )
    throw Error("Invalid devnet configuration");
  return { endpoint, chain };
}
class NodeRejection extends Error {}
export async function submit(p: any) {
  const config = configured();
  if (!config || p.confirmation !== "SUBMIT " + config.chain)
    throw Error("Devnet confirmation required");
  if (!/^0x06(?:[a-f0-9]{2}){1,65536}$/i.test(p.raw))
    throw Error("Supply a signed 0x06 frame transaction");
  if(BigInt(unpack(p.raw).chain_id)!==BigInt(config.chain))throw Error("Frame chain ID differs from configured devnet");
  const call = async (method: string, params: any[]) => {
    const res = await fetch(config.endpoint, {
      method: "POST",
      redirect: "error",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(8000),
    });
    const v = await res.json();
    if (v.error) throw new NodeRejection(String(v.error.message));
    return v.result;
  };
  if (BigInt(await call("eth_chainId", [])) !== BigInt(config.chain))
    throw Error("Configured devnet chain ID mismatch");
  try {
    const hash = await call("eth_sendRawTransaction", [p.raw]);
    if (!/^0x[0-9a-f]{64}$/i.test(hash))
      throw Error("Devnet returned an invalid transaction hash");
    return {
      chain: config.chain,
      admitted: true,
      hash,
    };
  } catch (e) {
    return {
      chain: config.chain,
      admitted: e instanceof NodeRejection ? false : null,
      error: String(e),
    };
  }
}
