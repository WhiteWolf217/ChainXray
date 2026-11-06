# ChainXray Desktop
See [Mumbai integrations](docs/mumbai-integrations.md) for Uniswap inspection, sanitized sharing and Arkiv setup, including remaining live-demo requirements.

## CROPS

- C: Local capture, decoding and archive access run without our server. Public dapps and external RPC services retain their own availability dependencies; Arkiv sharing is optional.
- O: Source is provided under the repository LICENSE. Build instructions require Node dependencies and the documented native tooling; bundled third-party software retains its own licenses.
- P: Captures stay in local SQLite. The new public-sharing path exports only three allowlisted fields after preview. Arkiv learns the publishing account, public summary and network metadata. RPCs and optional AI providers have separate visibility; this is not anonymous RPC.
- S: Wallet signing stays in the wallet. A dedicated Arkiv test key is supplied through the engine environment. Local files are not encrypted, and the browser hook is an inspection tool, not a tamper-proof defense against hostile pages.

A local Web3 investigation workbench for Windows x64. A disposable Anvil chain, deliberately vulnerable vault, Forge reproduction and SQLite evidence archive support an end-to-end offline lab.

## Real-world use: investigating a swap

The Uniswap API integration provides a reference quote that a developer can compare with a captured wallet request and its execution results. The standalone quote form demonstrates API connectivity; its debugging value comes from using that quote alongside transaction evidence.

For example, when investigating a swap, a developer can review:

1. **Reference quote:** What output and route does Uniswap quote for the selected token pair and input amount?
2. **Captured request:** Which router, recipient, input amount and minimum output did the dapp ask the wallet to approve?
3. **Execution trace:** Which contracts ran, and which calls reverted? This requires a trace-capable RPC and suitable ABIs for readable decoding.
4. **Receipt and events:** Did the transaction succeed, and what on-chain events were emitted?

Together, these can help investigate incorrect token units, unexpected recipients, weak minimum-output protection, or differences between a quoted route and the submitted transaction. A fresh quote alone does not establish a vulnerability: prices, liquidity, fees and timing can change. An associated quote is reference data, not proof of the route actually executed.

**Available now:** quote fetching, local storage and manual association with a captured request, plus supported request decoding, wallet outcomes, receipt tracking and contract traces when the RPC supports them. Developers currently compare these records themselves.

**Planned: “Inspect this swap.”** From a captured request, extract supported swap parameters, fetch a reference quote and display a readable comparison beside the request and execution results. Ask for missing information only when decoding cannot supply it. Automatic parameter extraction into the quote form and automatic quote-versus-transaction comparison are not implemented yet.

## Run the lab
For the standalone Windows workbench, open **release/ChainXray Desktop/ChainXray.exe**. Keep its `resources` folder alongside it. This opens a native application window, without a Chrome tab. Windows WebView2 Runtime is required. Run `node scripts/package-desktop.mjs` to refresh this package using the existing native executable and current application resources; rebuild the native executable first if Rust code changes.

Open Browser launches the bundled Chromium with the ChainXray extension and MetaMask at the live Uniswap interface. Live Dapps lets you enter another HTTPS dapp URL. Browser sessions currently require Ethereum Sepolia (11155111), selected in the wallet and dapp. The built-in test dapp is no longer served. See [live dapp instructions](docs/live-dapps.md).

Extension 0.1.9 supports both injected wallet requests and Uniswap's MetaMask SDK connection. The live Sepolia ETH-to-WETH wrap was captured in Intercept and rejected with Drop. Signing stays in the wallet; live SDK forwarding through execution is not yet verified. No Uniswap API key is needed for browser interception.

Start in **Get started**, then use **Intercept → Request history → Request Flow** to inspect a capture. Request Flow shows the recorded source, method, wallet and destination as clickable blocks; it does not infer execution traces. Local lab, frame admission, campaigns and contract tools are under **Advanced tools**. The Uniswap API page guides key setup, quote parameters and saved results, with an optional token amount calculator. AI Investigator has been removed.

Extract the portable ZIP and double-click **Start ChainXray.cmd**. Keep the launcher open while using the workbench. Alternatively, from this directory run `node scripts/build.mjs` then `node engine/server.ts --browser` with Node 24 and dependencies installed.

1. Open **Workspace setup** and create `vault-lab`.
2. In **Home**, start the chain, deploy the vault and capture the takeover.
3. Select the capture, send it to **Repeater**, and run it. Compare storage slot zero before and after the call. The engine reverts the snapshot after each run.
4. Open **Intruder** to run the edited request and a value mutation. Inspect each case in **Sessions**.
5. Under **Findings**, run the Forge reproduction. Select the resulting evidence to see the Solidity test and output.
6. Export the workspace under **Reports**. Create another workspace and restore the JSON there.

Under **Advanced tools**, **Frame admission lab** accepts the bundled JSON fixture. Run it twice to observe the nonce rejection. **Request history** accepts provider request JSON and browser capture exports.

Run `npm test` for the TypeScript and JavaScript test suites with Node 24 and the documented local lab dependencies installed. Build the native desktop with `pnpm build` on Windows with a Rust toolchain, linker and WebView2. See docs/installation.md for prerequisites.

See [request lifecycle](docs/lifecycle.md) for correlated wallet outcomes, automatic receipt tracking, contract call traces, linked Uniswap quotes and sanitized Arkiv sharing.
