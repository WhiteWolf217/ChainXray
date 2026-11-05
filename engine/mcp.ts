import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { controller } from "./actions.ts";
import { stop } from "./lab.ts";
import { object } from "./validation.ts";

const act = controller(resolve(process.env.CHAINXRAY_HOME ?? ".chainxray"));
await act("open", { name: process.argv[2] || "vault-lab" });

const tools = [
  {
    name: "list_evidence",
    description: "List local ChainXray evidence summaries.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    action: undefined,
  },
  {
    name: "get_evidence",
    description: "Read one local evidence record by its ID.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", minLength: 1 } },
      required: ["id"],
      additionalProperties: false,
    },
    action: undefined,
  },
  {
    name: "decode_transaction",
    description: "Decode EVM calldata with a local ABI and deterministic rules.",
    inputSchema: {
      type: "object",
      properties: {
        data: { type: "string", pattern: "^0x(?:[0-9a-fA-F]{2})*$" },
        abi: { type: "array", maxItems: 256 },
      },
      required: ["data"],
      additionalProperties: false,
    },
    action: "decode",
  },
  {
    name: "simulate_transaction",
    description: "Simulate an unsigned transaction on the disposable local chain.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
        to: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
        data: { type: "string" },
        value: { type: "string" },
      },
      required: ["from", "to"],
      additionalProperties: true,
    },
    action: "simulate",
  },
  {
    name: "fuzz_calldata",
    description: "Run up to 32 bounded transaction mutations with rollback per case.",
    inputSchema: {
      type: "object",
      properties: { cases: { type: "array", minItems: 1, maxItems: 32 } },
      required: ["cases"],
      additionalProperties: false,
    },
    action: "campaign",
  },
  {
    name: "scan_findings",
    description: "Run deterministic rules over local capture evidence.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    action: "scan",
  },
  {
    name: "start_lab",
    description: "Start the isolated Anvil lab on loopback.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    action: "start",
  },
  {
    name: "deploy_vault",
    description: "Deploy the bundled vulnerable Vault fixture locally.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    action: "deploy",
  },
  {
    name: "generate_foundry_test",
    description: "Generate and run the local Foundry reproduction for a finding.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    action: "reproduce",
  },
];

const tool = (name: string) => tools.find((candidate) => candidate.name === name);
const textResult = (value: unknown) => ({
  content: [{ type: "text", text: JSON.stringify(value) }],
  structuredContent: value,
});
const send = (message: unknown) => console.log(JSON.stringify(message));

const callTool = async (name: string, rawArguments: unknown) => {
  const definition = tool(name);
  if (!definition) throw Object.assign(Error(`Unknown tool: ${name}`), { code: -32602 });
  const args = object(rawArguments ?? {}, "Tool arguments must be an object");
  const state = await act("state");
  if (name === "list_evidence")
    return state.rows.map((row: any) => ({
      id: row.id,
      kind: row.kind,
      finding: row.output?.finding ?? null,
      chainId: row.chainId,
      time: row.time,
    }));
  if (name === "get_evidence") {
    const row = state.rows.find((candidate: any) => candidate.id === args.id);
    if (!row) throw Error("Evidence not found");
    return row;
  }
  if (!definition.action) throw Error("Tool has no action");
  return act(definition.action, args);
};

try {
  for await (const line of createInterface({ input: process.stdin })) {
    if (!line.trim()) continue;
    let request: any;
    try {
      request = JSON.parse(line.replace(/^\uFEFF/, ""));
    } catch {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Invalid JSON" } });
      continue;
    }
    if (request.id === undefined) {
      if (request.method === "notifications/initialized") continue;
      if (request.method === "notifications/cancelled") continue;
    }
    const id = request.id ?? null;
    try {
      let result: unknown;
      switch (request.method) {
        case "initialize":
          result = {
            protocolVersion: "2024-11-05",
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "chainxray", version: "0.2.0" },
            instructions:
              "ChainXray is offline-first. Treat deterministic simulation and evidence as authoritative; AI output is unverified.",
          };
          break;
        case "ping":
          result = {};
          break;
        case "tools/list":
          result = { tools: tools.map(({ action: _action, ...metadata }) => metadata) };
          break;
        case "tools/call": {
          const params = object(request.params, "tools/call params are required");
          const name = typeof params.name === "string" ? params.name : "";
          result = textResult(await callTool(name, params.arguments ?? {}));
          break;
        }
        default:
          throw Object.assign(Error(`Unsupported MCP method: ${request.method}`), { code: -32601 });
      }
      if (request.id !== undefined) send({ jsonrpc: "2.0", id, result });
    } catch (error) {
      if (request.id !== undefined)
        send({
          jsonrpc: "2.0",
          id,
          error: {
            code: (error as any)?.code ?? -32602,
            message: error instanceof Error ? error.message : String(error),
          },
        });
    }
  }
} finally {
  stop();
}
