# ChainXray Desktop

## Web3-Native Offensive Security Workbench

> Working name: **ChainXray**. Name, domain, trademarks, and package names must be checked before public release.

## 1. Executive Summary

ChainXray is an offline-first desktop application for offensive security testing of Web3 systems.

It combines:

- Burp-style Proxy, Repeater, Intruder, Decoder, and Scanner workflows;
- Blockaid-style transaction simulation and malicious-action detection;
- REA-style AI-assisted investigation through MCP;
- Foundry/Anvil-based local execution and exploit reproduction;
- protocol-specific testing for wallets, smart contracts, DeFi, bridges, account abstraction, mempools, and frame transactions.

ChainXray is **Web3-only**. Its security value comes from understanding blockchain semantics rather than scanning ordinary Web2 applications.

The system analyzes:

- wallet-provider calls;
- JSON-RPC requests and responses;
- signed and unsigned transactions;
- EIP-712 typed-data signatures;
- smart-contract bytecode, ABI, storage, and proxy relationships;
- transaction traces and state changes;
- mempool and alternative-mempool behavior;
- protocol-specific actions such as swaps, approvals, lending, bridges, and account abstraction.

The core engine runs locally and can operate without an internet connection when supplied with local contracts, chain snapshots, transaction fixtures, or a local EVM environment. Live-chain analysis requires an RPC connection.

---

## 2. Product Definition

### 2.1 Product statement

> ChainXray is a Web3-native offensive-security workbench that intercepts, decodes, simulates, mutates, fuzzes, and explains wallet and blockchain activity.

### 2.2 Product analogy

| Existing idea | ChainXray equivalent |
|---|---|
| Burp Proxy | Web3 Provider Proxy |
| Burp Repeater | Transaction Repeater |
| Burp Intruder | Calldata and protocol fuzzer |
| Burp Decoder | ABI, calldata, EIP-712, proxy, and frame decoder |
| Burp Scanner | Web3 threat and vulnerability scanner |
| Burp Comparer | Execution/state/balance comparer |
| Blockaid simulation | Pre-sign transaction and asset-impact analysis |
| REA MCP | AI-driven Web3 investigation agent |
| Foundry | Exploit reproduction and invariant testing |

### 2.3 What ChainXray is not

ChainXray does not aim to be a general Web2 penetration-testing suite. It does not make the following its primary scope:

- SQL injection scanning;
- XSS scanning;
- cookie/session testing;
- generic REST API testing;
- generic HTTP crawling;
- ordinary WebSocket security testing;
- website security headers.

A dApp frontend may be used as an entry point, but ChainXray focuses on the Web3 behavior produced by that frontend.

---

## 3. Primary Users

### Security researchers

Use ChainXray to inspect and attack authorized dApps, contracts, wallets, and protocols.

### Smart-contract auditors

Use ChainXray to combine static analysis, dynamic simulation, fuzzing, traces, and reproducible exploit tests.

### Protocol developers

Use ChainXray during development and CI to test transaction flows, invariants, permissions, upgrades, and integrations.

### Wallet developers

Use ChainXray to test how wallet and account-abstraction flows expose users to malicious calls, signatures, approvals, and paymasters.

### Researchers of Ethereum transaction infrastructure

Use the frame and mempool modules to test EIP-8141 transactions, alternative-mempool admission, replay behavior, and resource exhaustion.

---

## 4. Operating Modes

### 4.1 Offline Lab Mode

Offline Lab Mode is the primary mode for the standalone `.exe`.

It uses:

- local Solidity projects;
- local bytecode and ABI files;
- imported transaction fixtures;
- local Anvil forks or chain snapshots;
- disposable test wallets;
- local Foundry tests;
- local AI models through Ollama or another local runtime.

It can perform real attacks against an isolated local chain without touching a live network.

### 4.2 Authorized Testnet Mode

Uses a configured RPC endpoint to test contracts deployed to a testnet. The user explicitly chooses the target chain and wallet.

### 4.3 Live Observation Mode

Passively observes wallet and RPC behavior without changing or broadcasting transactions.

### 4.4 Simulation Mode

Replays transactions against a fork or simulator. This is the default mode for potentially destructive actions.

### 4.5 Fuzz Mode

Generates mutated transactions, signatures, frames, calldata, and call sequences using disposable keys and isolated state.

### 4.6 AI Investigation Mode

Allows an AI agent to query ChainXray through MCP. The agent can inspect evidence, run approved analysis tools, and generate tests or reports.

The AI is an analysis assistant. Deterministic simulation, rules, and evidence remain the authority for security results.

---

## 5. End-to-End Workflow

```text
Create workspace
      ↓
Import target or connect to a local chain
      ↓
Capture wallet/RPC activity
      ↓
Discover contracts and protocol relationships
      ↓
Decode transaction semantics
      ↓
Simulate execution
      ↓
Inspect asset, state, trace, and gas changes
      ↓
Run security rules
      ↓
Replay and mutate with Repeater/Intruder
      ↓
Fuzz contracts, protocols, frames, or mempool rules
      ↓
Investigate with the AI agent
      ↓
Generate Foundry reproduction tests
      ↓
Export an evidence-backed report
```

### Step 1: Create a workspace

The user creates a workspace with:

- target name;
- chain or local chain configuration;
- target contracts;
- wallet mode;
- simulation mode;
- allowed RPC endpoints;
- analysis rules;
- evidence retention settings.

Example:

```yaml
workspace: vulnerable-vault-lab
chain: anvil-local
mode: offline
wallet: disposable-test-wallet
broadcast: disabled
ai: local-ollama
```

### Step 2: Import a target

Supported target inputs:

- Foundry project;
- Hardhat project;
- Solidity source;
- ABI and bytecode;
- contract address with downloaded chain state;
- transaction hash and receipt;
- raw calldata;
- EIP-712 typed data;
- EIP-8141 frame fixture;
- recorded Web3 provider session.

### Step 3: Start the local execution environment

ChainXray starts a disposable local EVM environment, deploys the target contracts, funds test accounts, and records the initial state root.

```text
ChainXray Desktop
        ↓
Local process supervisor
        ↓
Anvil / local EVM
        ↓
Target deployment
        ↓
Disposable test wallets
```

Every test run receives a snapshot ID so it can be reset and reproduced.

### Step 4: Capture Web3 activity

ChainXray captures Web3-specific calls:

```text
eth_chainId
eth_call
eth_estimateGas
eth_sendTransaction
eth_sendRawTransaction
eth_signTypedData_v4
personal_sign
wallet_switchEthereumChain
eth_getLogs
eth_getTransactionReceipt
```

The capture layer records the request, response, wallet context, chain ID, timestamp, and source session. It does not require private keys.

### Step 5: Discover the Web3 attack surface

ChainXray builds a graph:

```text
dApp provider
   └── wallet
         └── RPC endpoint
               └── router contract
                     ├── token contract
                     ├── callback contract
                     ├── proxy implementation
                     └── external protocol
```

Discovery includes:

- contract addresses;
- chain IDs;
- ABI sources;
- function selectors;
- proxies and implementations;
- owner/admin addresses;
- token and NFT standards;
- external calls;
- upgrade paths;
- protocol adapters;
- oracle and bridge dependencies.

### Step 6: Decode the transaction

Raw calldata becomes a semantic action:

```text
multicall()
  ├── approve(USDC, spender, uint256.max)
  ├── permit(owner, spender, amount, deadline, signature)
  └── swap(tokenIn, tokenOut, amountIn, minAmountOut)
```

Supported decoding includes:

- ABI decoding;
- unknown selector lookup;
- proxy-aware decoding;
- recursive multicall decoding;
- ERC-20/721/1155 actions;
- EIP-2612 permits;
- EIP-712 typed data;
- smart-account calls;
- EIP-4337 UserOperations;
- EIP-8141 frames;
- bridge and protocol-specific calls.

### Step 7: Simulate execution

The simulator returns:

- call tree;
- events;
- return values;
- revert reason;
- gas usage;
- token movements;
- NFT movements;
- balance changes;
- storage changes;
- approvals;
- contract-created addresses;
- protocol-specific state changes.

### Step 8: Run security analysis

Initial deterministic checks:

- unlimited token approval;
- hidden asset transfer;
- unexpected recipient;
- permit replay;
- wrong chain or domain separator;
- nonce reuse;
- signature mismatch;
- dangerous delegatecall;
- arbitrary external call;
- weak access control;
- proxy upgrade exposure;
- reentrancy indicators;
- oracle manipulation surface;
- bridge-message replay;
- paymaster abuse;
- excessive validation gas;
- frame-ordering issues;
- unexpected slippage;
- suspicious callback;
- user balance decrease without visible intent.

### Step 9: Use Repeater

The user selects a captured action and changes fields:

```text
recipient
amount
spender
nonce
deadline
chainId
gasLimit
paymaster
validation frame
```

ChainXray replays the modified action against the selected local snapshot or testnet.

### Step 10: Use Intruder

Intruder generates mutations and runs them in parallel against isolated snapshots.

Each case records:

```json
{
  "mutation": "nonce reused",
  "input": "0x...",
  "admitted": true,
  "executed": true,
  "gasUsed": 83411,
  "stateChanged": true,
  "invariantBroken": true,
  "evidenceId": "ev_..."
}
```

### Step 11: Generate a reproduction test

The system converts a confirmed finding into Foundry code:

```solidity
function test_ReplayIsAccepted() public {
    submitFrame(originalFrame);
    submitFrame(originalFrame);
    assertFalse(secondSubmissionShouldBeAccepted);
}
```

The generated test is reviewed and executed locally before being included in a report.

### Step 12: AI investigation

The REA-compatible MCP agent receives structured evidence rather than raw untrusted text.

Example request:

> Explain how this transaction drains the wallet and generate a reproducible Foundry test.

The agent can call:

```text
discover_contracts()
decode_transaction()
trace_execution()
simulate_transaction()
compare_state_changes()
fuzz_calldata()
test_replay()
generate_foundry_test()
create_security_report()
```

### Step 13: Export evidence

Reports include:

- finding title;
- severity;
- affected chain and contracts;
- decoded transaction;
- preconditions;
- exact reproduction steps;
- trace and state changes;
- transaction hashes;
- evidence hashes;
- generated test;
- remediation;
- limitations and assumptions.

---

## 6. Main Product Modules

### 6.1 Web3 Provider Proxy

Intercepts EIP-1193 provider calls between a dApp and a wallet. It provides request history, filtering, blocking, mocking, replay, and export.

### 6.2 JSON-RPC Engine

Normalizes RPC requests and responses across EVM-compatible nodes. It understands transaction, call, log, receipt, storage, and simulation methods.

### 6.3 Decoder

Decodes ABI, calldata, selectors, proxies, multicalls, EIP-712 messages, UserOperations, and frames.

### 6.4 Transaction Repeater

Edits and replays unsigned transaction requests against local forks or authorized testnets.

### 6.5 Intruder/Fuzzer

Mutates transaction fields, calldata, signatures, nonces, frames, protocol sequences, and state assumptions.

### 6.6 Contract Analyzer

Analyzes source, bytecode, ABI, storage, roles, proxy relationships, external calls, and upgrade controls.

### 6.7 Simulator

Runs transactions and bundles against local EVM snapshots and returns decoded execution results.

### 6.8 Protocol Adapters

Adapters provide semantic checks for:

- ERC-20, ERC-721, ERC-1155;
- Uniswap and other AMMs;
- lending and borrowing;
- bridges;
- staking and vaults;
- account abstraction;
- paymasters;
- EIP-8141 frame transactions;
- governance and timelocks.

### 6.9 Mempool and Frame Module

Tests pending transactions, replacement behavior, EIP-8141 frame admission, validation gas, keyed nonces, paymasters, replay, and alternative-mempool rules.

### 6.10 Evidence Store

Stores immutable local evidence references for requests, traces, state roots, simulation outputs, and generated tests.

### 6.11 REA-Compatible MCP Server

Makes ChainXray tools available to compatible AI agents without requiring the entire REA application to be embedded into the desktop UI.

### 6.12 Report Generator

Exports Markdown, JSON, and Foundry reproduction artifacts. PDF export can be added later.

---

## 7. Technology Stack

### 7.1 Desktop application

| Area | Technology | Reason |
|---|---|---|
| Desktop shell | Tauri 2 | Small Windows binary, native process control, offline-friendly |
| UI | React + TypeScript | Fast development and reusable security-workbench components |
| Build tool | Vite | Fast local development and production builds |
| Styling | Tailwind CSS | Consistent dense desktop UI |
| UI components | Radix/shadcn-style components | Accessible panels, dialogs, tables, and command menus |
| State management | Zustand or Redux Toolkit | Predictable workspace/session state |
| Charts/graphs | React Flow and a chart library | Contract graphs, call trees, and state differences |

### 7.2 Web3 analysis engine

| Area | Technology | Reason |
|---|---|---|
| Runtime | Node.js LTS | Good compatibility with REA and MCP tooling |
| Language | TypeScript | Shared types across UI, engine, and MCP |
| EVM client | viem | Typed EVM/RPC primitives and wallet integration |
| ABI/calldata | viem plus custom decoders | Standard calls plus protocol-specific decoding |
| Local database | SQLite | Portable, offline, queryable workspace storage |
| Database access | Drizzle ORM or better-sqlite3 | Simple local persistence and migrations |
| Validation | Zod | Runtime validation of requests, findings, and evidence |
| Logging | pino | Structured local logs without telemetry |

### 7.3 Local blockchain and testing

| Area | Technology |
|---|---|
| Local EVM | Anvil |
| Contract tests | Foundry/Forge |
| Transaction utilities | Foundry Cast and viem |
| Fork snapshots | Anvil fork mode and saved local fixtures |
| Solidity compilation | Foundry-managed solc versions |
| Fuzzing | Foundry fuzzing plus ChainXray mutation engine |
| Execution traces | Foundry/Anvil traces and RPC debug methods where available |

### 7.4 AI and REA integration

| Area | Technology |
|---|---|
| Agent protocol | Model Context Protocol (MCP) |
| MCP server | TypeScript MCP SDK |
| REA integration | REA-compatible MCP tools and evidence contracts |
| Offline inference | Ollama or another local model runtime |
| Optional remote inference | Provider adapter, disabled in Offline Lab Mode |
| Agent output validation | Zod schemas and evidence references |

### 7.5 Browser and wallet integration

| Area | Technology |
|---|---|
| Browser extension | TypeScript, Manifest V3 |
| Provider interception | EIP-1193 wrapper/injected provider bridge |
| Desktop communication | Authenticated localhost WebSocket or native messaging |
| Wallet testing | Disposable local wallets and test accounts |
| Signature testing | EIP-712 encoder/decoder and local test keys |

The browser extension only captures Web3 provider activity. It is not a general Web2 security scanner.

### 7.6 Optional Burp integration

| Area | Technology |
|---|---|
| Burp extension | Java/Kotlin using PortSwigger’s official Montoya API |
| Integration | Web3-specific tabs and forwarding to ChainXray local engine |
| Dependency | Optional; standalone ChainXray remains functional |

Burp’s proprietary source code and branding will not be copied. The integration uses official extension capabilities.

### 7.7 Packaging

| Area | Technology |
|---|---|
| Windows installer | Tauri NSIS/MSI bundle |
| Sidecar binaries | Anvil, ChainXray engine, MCP server |
| Portable build | ZIP distribution with local dependencies |
| Configuration | Workspace-local YAML/JSON plus SQLite |
| Updates | Optional signed update mechanism, disabled in strict offline mode |

---

## 8. Repository Structure

```text
chainxray/
├── apps/
│   ├── desktop/                 # Tauri + React application
│   ├── browser-extension/       # EIP-1193 provider interceptor
│   └── burp-extension/          # Optional Montoya integration
├── packages/
│   ├── shared-types/             # Shared Zod and TypeScript types
│   ├── web3-provider/            # Provider capture and replay
│   ├── rpc-engine/               # JSON-RPC normalization
│   ├── evm-decoder/              # ABI, calldata, proxy, multicall
│   ├── transaction-engine/       # Build, sign, replay, compare
│   ├── simulator/                # Anvil/Foundry process integration
│   ├── fuzz-engine/              # Mutation and campaign execution
│   ├── threat-engine/            # Deterministic security rules
│   ├── protocol-adapters/        # DeFi and Web3 protocol modules
│   ├── evidence-store/           # SQLite and content-addressed artifacts
│   ├── mcp-server/               # AI tools and MCP contracts
│   └── report-generator/         # Markdown, JSON, and test output
├── fixtures/
│   ├── contracts/                # Vulnerable and safe contracts
│   ├── transactions/             # Recorded Web3 flows
│   ├── frames/                   # EIP-8141 fixtures
│   └── chain-state/              # Offline state snapshots
├── docs/
├── tests/
├── scripts/
├── LICENSE
├── SECURITY.md
└── README.md
```

---

## 9. Data Model

Core entities:

```text
Workspace
Target
Chain
Session
ProviderRequest
Transaction
Contract
ProtocolAction
Simulation
FuzzCampaign
FuzzCase
Finding
EvidenceArtifact
GeneratedTest
Report
```

Every important result references:

- workspace ID;
- session ID;
- chain ID;
- block or state snapshot;
- input hash;
- tool version;
- output hash;
- timestamp;
- reproduction command.

This allows a researcher to reproduce a result instead of relying on an unexplained AI score.

---

## 10. Security and Privacy Model

### Key handling

- Never require a production private key.
- Use disposable test wallets for mutation and fuzzing.
- Keep test keys in memory where possible.
- Encrypt persistent secrets using Windows DPAPI.
- Require explicit confirmation before any testnet broadcast.

### Offline-first behavior

- No telemetry by default.
- No cloud upload of transaction data.
- No remote AI requirement in Offline Lab Mode.
- All evidence stored locally.
- Remote services must be visible and explicitly configured.

### Process isolation

- Run local EVM processes with controlled working directories.
- Use per-workspace temporary directories.
- Enforce process timeouts and resource limits.
- Kill runaway fuzz campaigns.
- Never execute imported target code outside the local sandbox.

### Target authorization

The application is intended for local labs, owned systems, testnets, bug-bounty scopes, and explicitly authorized assessments.

### Fail-safe behavior

- Default to simulation-only.
- Default to broadcast disabled.
- Require explicit chain and target confirmation.
- Mark live transactions clearly.
- Preserve original requests before mutation.

---

## 11. Offline Limitations

Offline mode can test:

- local contracts;
- imported bytecode and ABI;
- transaction fixtures;
- local forks already downloaded;
- EIP-8141 fixtures;
- local mempool implementations;
- local AI models;
- static and dynamic contract behavior.

Offline mode cannot obtain fresh:

- mainnet state;
- live token prices;
- current threat intelligence;
- live mempool activity;
- remote contract source code;
- current RPC responses.

These are handled by importing snapshots or switching to Authorized Testnet/Live Observation Mode.

---

## 12. ETHGlobal Mumbai Demo Plan

### Demo title

**ChainXray: Web3 Offensive Security, Locally Reproducible**

### Demo flow

1. Open ChainXray Desktop.
2. Import a vulnerable Web3 protocol fixture.
3. Launch a local Anvil chain.
4. Deploy contracts and fund disposable wallets.
5. Capture a transaction flow.
6. Decode the calls and show the protocol graph.
7. Simulate the original transaction.
8. Modify it with Repeater.
9. Launch Intruder fuzzing.
10. Detect replay, validation, or access-control failure.
11. Ask the local REA-compatible agent to explain the finding.
12. Generate and run a Foundry reproduction test.
13. Show the final evidence report.
14. Run the EIP-8141 frame module against the alternative-mempool devnet when network access is available.

### Strong demo finding

```text
Finding: Frame replay accepted

Original frame: admitted
Replay frame: admitted
Expected: second submission rejected
Observed: second submission accepted
Validation gas: 83,411
Reproduction: tests/FrameReplay.t.sol
Evidence: ev_7c...
```

This demonstrates the complete product loop: interception, decoding, mutation, simulation, fuzzing, AI explanation, and reproducible security testing.

---

## 13. Development Roadmap

### Phase 1: Desktop foundation

- Tauri shell;
- React workbench UI;
- workspace creation;
- SQLite persistence;
- process supervisor;
- Anvil launch and reset.

### Phase 2: Web3 capture and decoding

- EIP-1193 provider capture;
- JSON-RPC normalization;
- transaction history;
- ABI/calldata decoder;
- EIP-712 decoder;
- proxy and multicall support.

### Phase 3: Simulation and security

- transaction simulator;
- balance/state diff;
- trace viewer;
- deterministic rules;
- approval and permit analysis;
- local test wallet.

### Phase 4: Offensive workflows

- Repeater;
- Intruder;
- mutation campaigns;
- invariant checks;
- Foundry test generation;
- evidence-backed findings.

### Phase 5: AI and protocol modules

- MCP server;
- REA-compatible agent workflows;
- EIP-8141 frames;
- alternative-mempool adapter;
- Uniswap adapter;
- bridge and account-abstraction adapters.

### Phase 6: Product hardening

- signed Windows installer;
- portable offline distribution;
- plugin SDK;
- workspace export/import;
- regression corpus;
- optional Burp integration;
- CI mode.

---

## 14. Success Criteria

The first release is successful when a user can:

1. Install ChainXray from a Windows installer.
2. Run it without an internet connection.
3. Import a vulnerable Solidity project.
4. Launch an isolated local chain.
5. Capture and decode Web3 transactions.
6. Simulate the transaction.
7. Mutate it with Repeater.
8. Fuzz it with Intruder.
9. Detect a real vulnerability in the local fixture.
10. Generate a passing Foundry reproduction test.
11. Ask the local agent for an evidence-backed explanation.
12. Export a complete security report.

---

## 15. Licensing and Reuse

### REA

REA is MIT-licensed according to its repository. Reused code must preserve the license and attribution requirements. The preferred integration is to build a ChainXray MCP server that is compatible with REA-style agents rather than tightly coupling the entire REA repository to the desktop application.

### Burp Suite

Burp Suite is proprietary. ChainXray must not copy its source code, internal implementation, or branding. Burp interoperability can be provided through the official extension API.

### Third-party tools

Anvil, Foundry, Solidity compiler versions, local models, and other dependencies must be reviewed for their licenses and included in `THIRD_PARTY_NOTICES.md`.

---

## 16. Final Product Positioning

> **ChainXray is a Web3-native offensive-security desktop application. It gives security researchers Burp-style control over wallet calls and blockchain transactions, Blockaid-style execution and asset analysis, and REA-style AI investigation—completely focused on smart contracts, protocols, wallets, mempools, and onchain state.**
