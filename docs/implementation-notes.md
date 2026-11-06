# Implementation and repository audit

Audit date: 2026-11-03 (Asia/Calcutta)

This note records the audit of the attached `CHAINXRAY-DESIGN.md`, the ChainXray
workspace at the repository root, and the supplied `rea/` repository. The design
file was read in full before reviewing implementation files.

## Executive result

The root workspace is already a working ChainXray Offline Lab vertical slice. It
has a React/Vite workbench, a Node 24 engine, local Anvil and Forge execution,
SQLite evidence, browser-provider capture, a minimal MCP stdio adapter, an
EIP-8141 fixture/admission model, reports, and a Tauri Windows shell.

The demonstrated path works end to end:

```text
workspace → Anvil → vulnerable Vault → provider capture → Repeater/Simulator
→ rollback → Intruder → deterministic finding → Forge reproduction
→ EIP-8141 nonce admission → JSON/Markdown export → restore
```

The implementation is a strong demo/MVP, not yet the complete product in the
design specification. The largest gaps are typed/runtime input validation,
production-grade Evidence authentication, full MCP SDK compatibility, complete
EVM trace/state semantics, and real EIP-8141 cryptographic/admission execution.

## Inventory boundaries

The workspace contains both authored code and large generated/vendor trees.
Generated or vendor material was counted but not treated as product source:

| Area | Files | Meaning |
| --- | ---: | --- |
| Root workspace reviewed files | 7,185 | Root files excluding dependency/build trees; this includes the authored `rea/` checkout |
| ChainXray authored files excluding `rea/` | 67 | Root application, engine, fixture, documentation, packaging, and test files |
| REA authored/reviewed files | 7,118 | `rea/` excluding `node_modules`, `dist`, `.git`, `.turbo`, and `.cache` |
| REA generated/vendor files | 27,755 | Dependencies, built output, caches, and Git metadata |
| Root generated/vendor files | large | `node_modules`, `dist`, `.build-tools`, `src-tauri/resources`, `src-tauri/target`, and release artifacts |

The REA authored inventory is:

| REA area | Files | Role |
| --- | ---: | --- |
| `src/` | 3,557 | TypeScript domain, application, providers, composition, CLI, MCP, and process code |
| `tests/` | 2,386 | Boundary, acceptance, conformance, composition, process, and evaluation tests |
| `docs/` | 323 | Product, provider, contract, verification, and generated-doc source |
| `scripts/` | 539 | Build, test, catalog, docs, fixture, setup, and verification tooling |
| `website/` | 101 | Documentation website and static assets |
| `bridge/` | 36 | Ghidra, native, Android, pwntools, pwndbg, Cutter, and mitmproxy bridges |
| `.github/` | 51 | CI workflows, actions, issue forms, and CodeQL configuration |
| Other source/config/license areas | 125 | Native code, skills, licenses, examples, patches, and project metadata |

REA source families were also checked individually by directory: `domain`
(1,198), `application` (578), `browser` (195), `artifacts` (187), `native`
(155), `server` (144), `process` (142), `contracts` (119), `ghidra` (101),
`cli` (83), `dotnet` (56), `composition` (46), `hopper` (41), `config` (40),
`ida` (39), `javascript` (34), `kuna` (29), Android/ADB/GPU/firmware/WASM and
the remaining provider families. The source is not a hidden ChainXray engine;
it is a reverse-engineering platform with one bounded EVM-bytecode inspection
capability.

## ChainXray authored files

### Root manifests and policy files

- `package.json` — private Node package, React/Vite/viem/solc/Foundry/Tauri
  dependencies, and scripts for tests, UI build, portable build, and Tauri.
- `pnpm-lock.yaml` — frozen dependency graph. Resolved versions include React
  19.3.1, viem 2.57.14, Vite 7.3.7, Tauri CLI 2.12.4, and Playwright 1.64.1.
- `pnpm-workspace.yaml` — contains only an `allowBuilds` value. It does not
  declare workspace packages; the value should be verified against the pinned
  pnpm version before relying on `pnpm install --frozen-lockfile`.
- `README.md` — accurate demo workflow and startup instructions, but it does
  not list all product limitations or the exact package-manager version.
- `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`, and
  `THIRD_PARTY_NOTICES.md` — local testing, authorized-use, MIT licensing, and
  third-party attribution policy.
- `CHAINXRAY-DESIGN.md` — product and implementation specification supplied by
  the user; it is more extensive than the current implementation.
- `.gitignore` — excludes dependencies, generated UI, portable resources, build
  tools, and release output. The root itself has no `.git` directory in this
  environment; `rea/` has its own Git metadata.
- `index.html` — Vite entry page loading `apps/desktop/main.tsx`.
- `notices/*` — Foundry MIT/Apache, Solidity GPL, and Node notices used for
  portable distribution.

### `apps/desktop`

- `main.tsx` — single React workbench and API client. It implements all named
  navigation views, workspace setup, chain controls, capture import, Repeater,
  Simulator, Intruder, ABI registration, frame testing, Findings, AI request,
  and report export/restore. It is intentionally compact but uses `any`, JSON
  parsing, and a single large component instead of typed domain models or
  route-level components.
- `Evidence.tsx` — result renderer for frame admission, transaction receipts,
  decoded calls, campaigns, and Markdown report generation.
- `style.css` — dense dark security-tool styling with fixed navigation, tables,
  JSON editor, evidence cards, and responsive-independent desktop layout.

### `engine`

- `actions.ts` — controller/orchestrator. It validates action-specific limits,
  decodes ABI/calldata using viem, records captures, calls the lab, runs bounded
  campaigns, invokes Ollama, and creates frame evidence. It is the main coupling
  point and should eventually be split into typed action services.
- `lab.ts` — Windows Anvil supervisor. It binds Anvil to loopback, creates
  disposable accounts, deploys `Vault.sol` with the bundled solc, snapshots and
  reverts state, collects receipts/call traces/storage/balances, and runs an
  offline Forge reproduction.
- `store.ts` — SQLite workspace and evidence table. It stores JSON records with
  workspace/session/chain/time metadata and SHA-256 fields, rejects a linked DB
  file, supports transactional restore, and caps archives at 10,000 rows.
- `server.ts` — loopback HTTP server. It generates a launch bearer token,
  serves the static UI, exposes `/api`, enforces host and token checks, limits
  request bodies to 8 MB, supports expiring browser pairing, and closes Anvil
  on process exit.
- `rules.ts` — deterministic observations for unlimited approvals, repeated
  nonces, repeated permit calldata, ERC-20 Transfer logs, and delegatecalls.
- `frames.ts` — type-06 RLP unpacking, decoded frame boundary projection, a
  local chain/nonce/shape admission policy, and standalone replay-test output.
- `devnet.ts` — optional configured devnet adapter. It requires a typed frame,
  matching configured chain, explicit `SUBMIT <chain>` confirmation, checks
  `eth_chainId`, submits the raw transaction, and distinguishes rejection from
  transport uncertainty.
- `mcp.ts` — minimal line-delimited JSON-RPC MCP-like server exposing evidence,
  simulation, fuzzing, lab start, and deployment actions. It is not yet based
  on the MCP SDK and does not advertise schemas/transport behavior as fully as
  the design requires.

### Fixtures and tests

- `fixtures/contracts/Vault.sol` — deliberately vulnerable unrestricted
  `setOwner` fixture with an owner-change event.
- `fixtures/frames/demo.json` — chain 31337, nonce-zero fixture with VERIFY and
  SENDER frames.
- `fixtures/README.md` — states the intended vulnerability and fixture scope.
- `tests/lab.test.ts` — validates Anvil deployment, unauthorized takeover,
  rollback, bounded campaign, Forge reproduction, frame nonce behavior,
  archive restore, and tamper rejection.
- `tests/decoder.test.ts` — validates nested multicall decoding and an inner
  unlimited approval finding, plus type-06 boundary/replay output.
- `tests/devnet.test.ts` — validates confirmation, chain checking, and node
  rejection handling without network access.

### Build, packaging, and extension files

- `scripts/build.mjs` — runs Vite and then stages bundled engine/resources.
- `scripts/stage.mjs` — esbuilds server/MCP bundles for Node 24, copies UI,
  fixtures, extension, runtime, notices, Node, Anvil, and Forge, and writes the
  portable launcher.
- `scripts/test-portable.mjs` — starts the staged runtime and verifies auth,
  pairing, capture, Anvil, deployment, simulation, Forge, and close behavior.
- `scripts/test-ui.mjs` — Playwright browser workflow covering the demo path.
  It assumes `ProgramFiles` environment variables exist; when neither is set,
  the script crashes while constructing browser paths before it can report a
  useful prerequisite error.
- `scripts/zip.ps1` — creates the Windows ZIP and SHA-256 checksum.
- `scripts/build-windows.ps1` — selects local Rust/MinGW/LLVM toolchains and
  invokes the Tauri CLI.
- `apps/browser-extension/manifest.json` — Manifest V3 extension with active-tab,
  scripting, and loopback permissions.
- `apps/browser-extension/popup.html` — small capture control surface.
- `apps/browser-extension/popup.js` — injects an EIP-1193 `request` wrapper in
  the page main world, retains up to 500 Web3 calls, exports JSON, and can send
  each call to an expiring loopback pairing token.
- `src-tauri/src/main.rs` — Windows Tauri host. It starts the staged Node engine
  through a hidden child process, passes workspace location, reads the loopback
  URL, and creates the workbench window.
- `src-tauri/tauri.conf.json` — Tauri 2 resource bundle and offline WebView2
  installer configuration.
- `src-tauri/Cargo.toml`, `Cargo.lock`, `build.rs`, `installer-hooks.nsh`, and
  `icons/icon.ico` — Rust/Tauri build metadata and VC runtime installation.
- `src-tauri/gen/schemas/*` — generated Tauri schemas, not product logic.
- `src-tauri/resources/*` and `src-tauri/target/*` — generated portable/runtime
  and native build artifacts; they should not be treated as source review.

### Documentation files

The ten root `docs/` files cover architecture, installation, offline mode,
simulation, fuzzing, evidence, MCP, EIP-8141, troubleshooting, and this audit.
They accurately describe the current demo boundaries, especially snapshot
rollback and the local frame policy, but they should not be read as evidence
that the omitted production capabilities already exist.

## REA audit and reuse decision

REA is `rea-agents` 6.8.0, MIT-licensed, ESM TypeScript, with Node
`^22.23.4 || ^24.22.1 || >=26.12.1` and npm 11.16.0. Its entry points are
`scripts/rea.mjs`, `src/cli.ts`, and `src/main.ts`. The MCP composition is in
`src/server/createServer.ts`, `EvidenceMcpServer.ts`, request tracking and HTTP
transport files. Evidence contracts are in `src/domain/evidence.ts`,
`evidenceBundle.ts`, and `src/application/investigation/`; SQLite-related
adapters are under `src/application/sqlite/` and `src/sqlite/`.

Useful concepts to reuse by contract or adaptation:

1. authenticated/content-addressed Evidence IDs;
2. narrow Evidence reader/writer ports;
3. explicit observed/derived/inferred confidence and authority;
4. source-evidence links and immutable bundle snapshots;
5. MCP tool contracts with explicit schemas and bounded delivery;
6. owned process lifecycle, cancellation, deadlines, and cleanup retry;
7. inward dependency flow: domain → application → providers → CLI/MCP.

Code reuse is not currently present and is not necessary for the MVP. The REA
source is a reverse-engineering application with hundreds of unrelated provider
families. ChainXray should keep its own Web3 domain and engine, then expose an
REA-compatible MCP/evidence boundary. If code is later copied, preserve the REA
MIT copyright and attribution from `rea/LICENSE` and update root notices.

## Required milestone coverage

| Milestone | Current coverage | Assessment |
| --- | --- | --- |
| 0 Audit | Root/REA inventory, runtime/package/license/MCP/Evidence review | Complete for this audit; Git status unavailable because `git` is not on PATH |
| 1 Foundation | Tauri shell, React UI, Node engine, SQLite workspace, loopback server | Working MVP; typed shared contracts and migrations are missing |
| 2 Local EVM lab | Anvil start/stop, Vault deployment, accounts, snapshots/reset, chain state | Working and integration-tested |
| 3 Capture/decoding | Browser capture/import, RPC records, viem decode, nested multicall, local ABI | Partial; no broad ABI/proxy/EIP-712/UserOperation/frame decoder |
| 4 Simulation/security | Receipt, call trace, storage/balance comparison, a few rules | Partial; no generalized asset/state model or full rule set |
| 5 Repeater/Intruder | Edited transaction replay and max-32 sequential cases with rollback/cancel | Partial; no typed transaction editor, parallel isolated workers, or mutation families |
| 6 Reproduction/AI | Forge test generation/execution, Ollama explanation, minimal MCP | Partial; MCP SDK contracts, evidence citations, and deterministic AI validation remain |
| 7 EIP-8141 | RLP fixture decode, boundaries, local nonce admission, optional devnet submit | Demo-only; signatures, fees, execution, alternative mempool, and real admission are absent |
| 8 Packaging | Portable ZIP/checksum, Tauri resources, installer hook | Partial; Windows packaging artifact exists, clean-install/no-network matrix is not verified here |

## Hardening completed in this pass

- Added `engine/validation.ts` for shared API, provider-request, transaction,
  campaign, ABI, restore, and calldata boundary validation.
- Strengthened `engine/store.ts` so restore recomputes nested input/output
  hashes, rejects malformed rows, and enforces a 4 MB evidence-record limit.
- Added bounded RPC, trace, state-diff, log, and movement evidence handling.
- Added explicit Anvil/Forge/solc path resolution with validated environment
  overrides and portable-bundle fallback paths.
- Expanded the MCP stdio surface with named tools, schemas, initialize/ping,
  notifications, structured tool results, deterministic scan/decode tools, and
  standard JSON-RPC error codes.
- Added Decoder and Scanner workbench views and protected Repeater from
  parameterless provider calls.
- Added frame value/data validation and explicit “verification/execution not
  performed” result markers.
- Added evidence-integrity and parameterless-capture regression tests.
- Added a pinned pnpm package manager and valid `allowBuilds` configuration.

## Remaining findings

### High priority

1. **Frame support remains a policy model.** The implementation does not verify
   signatures, fees, authorization, frame execution, resource accounting, or
   alternative-mempool admission. Keep local acceptance clearly labeled and do
   not present it as EIP-8141 security proof.
2. **MCP transport is still a compact stdio implementation.** It now exposes
   explicit schemas, lifecycle methods, structured results, notifications, and
   error codes, but it is not yet backed by the official MCP SDK and does not
   provide HTTP transport, resources, prompts, or cancellation propagation.
3. **The deterministic rule set covers only the first small subset of the
   design rules.** Permit domain/replay semantics, proxy upgrades, access
   control analysis, reentrancy, slippage, bridges, account abstraction,
   paymasters, generalized storage diffs, and hidden asset intent remain future
   modules.

### Medium priority

4. `main.tsx` remains a compact `any`-heavy component. It now disables unsafe
   parameterless capture replay, but the UI still needs typed state models and
   split workbench panels for production-scale Burp-style workflows.
5. The Tauri/Rust installer and clean Windows installation matrix still need a
   native build and clean-machine verification.

## Checks executed

### ChainXray root

- `src-tauri/resources/node.exe --test tests/*.test.ts` — **passed, 6/6**.
- `src-tauri/resources/node.exe scripts/build.mjs` — **passed**, Vite and
  esbuild staging completed.
- `src-tauri/resources/node.exe scripts/test-portable.mjs src-tauri/resources`
  — **passed**: auth, pairing, capture, Anvil, deployment, simulation, Forge.
- `src-tauri/resources/node.exe scripts/test-ui.mjs` — **passed** after setting
  the Windows `ProgramFiles` variables; the unconfigured-host failure is a
  test-harness portability issue documented above.
- Node syntax checks for engine files and extension — **passed**.
- Packaged MCP tool discovery and `list_evidence` call — **passed**; the server
  also strips a UTF-8 BOM defensively from the first stdio line.
- Tauri/Rust installer build — **not run** in this audit.

### REA

- `rea/.nvmrc` and package metadata identify Node 24.22.1 and npm 11.16.0.
- `scripts/run-typescript.mjs --noEmit` — **passed**.
- `scripts/run-development-tests.mjs local` — exited 0 but reported “No test
  files found”; this wrapper invocation did not constitute a completed suite.
- Direct Vitest source projects were started but exceeded the 300-second audit
  limit before a final result; no pass claim is made.
- `scripts/run-turbo.mjs run typecheck lint` — **blocked** because no package
  manager binary was available on PATH for Turbo to resolve.
- `git status` — **unavailable** because `git` is not installed/on PATH in the
  worker environment.
