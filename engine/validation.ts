const HEX = /^0x(?:[0-9a-f]{2})*$/i;
const ADDRESS = /^0x[0-9a-f]{40}$/i;
const QUANTITY = /^0x[0-9a-f]{1,64}$/i;

export type JsonObject = Record<string, unknown>;

export const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const object = (value: unknown, message = "Expected an object") => {
  if (!isObject(value)) throw Error(message);
  return value;
};

export const string = (value: unknown, message = "Expected a string") => {
  if (typeof value !== "string") throw Error(message);
  return value;
};

export const address = (value: unknown, message = "Invalid address") => {
  const result = string(value, message);
  if (!ADDRESS.test(result)) throw Error(message);
  return result;
};

export const data = (value: unknown, message = "Invalid hex data") => {
  const result = string(value, message);
  if (result.length > 32770 || !HEX.test(result)) throw Error(message);
  return result;
};

export const quantity = (value: unknown, message = "Invalid quantity") => {
  const result = string(value, message);
  if (!QUANTITY.test(result)) throw Error(message);
  return result;
};

const jsonBytes = (value: unknown): number => {
  try {
    return Buffer.byteLength(JSON.stringify(value));
  } catch {
    return Number.POSITIVE_INFINITY;
  }
};

export const providerRequest = (value: unknown) => {
  const request = object(value, "Expected a provider request");
  const method = string(request.method, "Provider method is required");
  if (!/^(eth_|wallet_|personal_sign$)/.test(method))
    throw Error("Unsupported provider method");
  if (!Array.isArray(request.params) || request.params.length > 256)
    throw Error("Provider params must be an array of at most 256 items");
  if (jsonBytes(request) > 2_000_000)
    throw Error("Provider request exceeds the 2 MB limit");
  return request;
};

export const transaction = (value: unknown) => {
  const tx = object(value, "Expected an unsigned transaction");
  if (tx.from !== undefined) address(tx.from, "Invalid transaction sender");
  if (tx.to !== undefined) address(tx.to, "Invalid transaction target");
  if (tx.data !== undefined) data(tx.data, "Invalid transaction calldata");
  if (tx.value !== undefined) quantity(tx.value, "Invalid transaction value");
  if (jsonBytes(tx) > 256_000) throw Error("Transaction exceeds the 256 KB limit");
  return tx;
};

export const simulation = (value: unknown) => {
  const tx = transaction(value);
  if (tx.from === undefined || tx.to === undefined)
    throw Error("Simulation requires from and to addresses");
  return tx;
};

export const campaign = (value: unknown) => {
  const input = object(value, "Expected an Intruder campaign");
  if (!Array.isArray(input.cases) || input.cases.length < 1 || input.cases.length > 32)
    throw Error("Supply 1–32 mutation cases");
  return {
    ...input,
    cases: input.cases.map((item) => simulation(item)),
  };
};

export const actionEnvelope = (value: unknown) => {
  const envelope = object(value, "Expected an API request");
  const action = string(envelope.action, "API action is required");
  if (action.length > 64 || !/^[a-z][a-z_]*$/.test(action))
    throw Error("Invalid API action");
  const payload = envelope.payload === undefined ? {} : object(envelope.payload);
  if (jsonBytes(payload) > 8_000_000) throw Error("API payload exceeds the 8 MB limit");
  return { action, payload };
};

export const assertActionPayload = (action: string, payload: JsonObject) => {
  switch (action) {
    case "capture":
      return providerRequest(payload);
    case "simulate":
      return simulation(payload);
    case "campaign":
      return campaign(payload);
    case "open":
      string(payload.name, "Workspace name is required");
      return payload;
    case "abi":
      if (!Array.isArray(payload.abi) || payload.abi.length > 256)
        throw Error("Expected an ABI array of at most 256 items");
      address(payload.address, "ABI address is required");
      return payload;
    case "restore":
      if (!Array.isArray(payload.rows)) throw Error("Expected an evidence rows array");
      return payload;
    case "investigate":
      string(payload.id, "Evidence ID is required");
      string(payload.model, "Ollama model is required");
      return payload;
    case "decode":
      data(payload.data, "Calldata is required");
      if (payload.abi !== undefined && !Array.isArray(payload.abi))
        throw Error("ABI must be an array");
      return payload;
    default:
      return payload;
  }
};
