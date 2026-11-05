# ChainXray Desktop
See [Mumbai integrations](docs/mumbai-integrations.md) for Uniswap inspection, sanitized sharing and Arkiv setup, including remaining live-demo requirements.

## CROPS

- C: Local capture, decoding and archive access run without our server. Public dapps and external RPC services retain their own availability dependencies; Arkiv sharing is optional.
- O: Source is provided under the repository LICENSE. Build instructions require Node dependencies and the documented native tooling; bundled third-party software retains its own licenses.
- P: Captures stay in local SQLite. The new public-sharing path exports only three allowlisted fields after preview. Arkiv learns the publishing account, public summary and network metadata. RPCs and optional AI providers have separate visibility; this is not anonymous RPC.
- S: Wallet signing stays in the wallet. A dedicated Arkiv test key is supplied through the engine environment. Local files are not encrypted, and the browser hook is an inspection tool, not a tamper-proof defense against hostile pages.

A local Web3 investigation workbench for Windows x64. A disposable Anvil chain, deliberately vulnerable vault, Forge reproduction and SQLite evidence archive support an end-to-end offline lab.

## Run the lab
For the standalone Windows workbench, open **release/ChainXray Desktop/ChainXray.exe**. Keep its `resources` folder alongside it. This opens a native application window, without a Chrome tab. Windows WebView2 Runtime is required. Run `node scripts/package-desktop.mjs` to refresh this package using the existing native executable and current application resources; rebuild the native executable first if Rust code changes.

Open Browser launches the bundled Chromium with the ChainXray extension and MetaMask at the live Uniswap interface. Live Dapps lets you enter another HTTPS dapp URL. Browser sessions currently require Ethereum Sepolia (11155111), selected in the wallet and dapp. The built-in test dapp is no longer served. See [live dapp instructions](docs/live-dapps.md).

Extract the portable ZIP and double-click **Start ChainXray.cmd**. Keep the launcher open while using the workbench. Alternatively, from this directory run `node scripts/build.mjs` then `node engine/server.ts --browser` with Node 24 and dependencies installed.

1. Open **Workspace setup** and create `vault-lab`.
2. In **Home**, start the chain, deploy the vault and capture the takeover.
3. Select the capture, send it to **Repeater**, and run it. Compare storage slot zero before and after the call. The engine reverts the snapshot after each run.
4. Open **Intruder** to run the edited request and a value mutation. Inspect each case in **Sessions**.
5. Under **Findings**, run the Forge reproduction. Select the resulting evidence to see the Solidity test and output.
6. Export the workspace under **Reports**. Create another workspace and restore the JSON there.

**Frames** accepts the bundled JSON fixture. Run it twice to observe the nonce rejection. **Web3 History** accepts provider request JSON and browser capture exports.

Run `node --test tests/*.test.ts` for the integration suite. Build the native desktop with `pnpm build` on Windows with a Rust toolchain, linker and WebView2. See docs/installation.md for prerequisites.
