## Install on a Windows laptop

Use `release/ChainXray-Setup-x64.exe` on Windows 10/11 x64 (Intel/AMD). Run setup, approve the Windows administrator prompt and follow the wizard. Launch ChainXray from the Start menu after installation. This package targets x64; Windows 7/8, 32-bit Windows and native ARM64 are not validated targets.

The setup includes the application, Node runtime, interactive Chromium, MetaMask extension, Solidity compiler, Anvil and Forge. It embeds the official Microsoft WebView2 bootstrapper and the Visual C++ x64 redistributable so users do not need Node, Rust, developer tools or a separate browser installation. Disk space is needed for both setup extraction and installed browser files. Internet is required during setup if WebView2 must be installed; machines with WebView2 already installed can use the bundled application resources directly. A restart may be required after installing runtime dependencies.

Open or create a workspace, then use **Open Browser**. Wallet onboarding is completed by the user. The packaged browser has a separate profile; existing wallet accounts and private keys are not included. Live dapps, quotes, public RPC reads and Arkiv need internet. Local lab functions can run offline after installation.

The setup is unsigned unless a release signing certificate is configured. Windows can display an unknown-publisher or SmartScreen prompt. Distribute the setup with `ChainXray-Setup-x64.sha256` and verify its source and checksum before running it. A separate clean Windows machine test is still required before promising compatibility across hardware and security policies.

## Build the setup from source

Install Node 24 and pnpm, then run pnpm install --frozen-lockfile. The Windows x64 solc 0.8.30 executable belongs at runtime/solc.exe. Bundled Chromium, MetaMask and VC_redist.x64.exe must be present under runtime/. With the documented Rust/linker tools available, run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-installer.ps1`. The build downloads official NSIS tooling and the WebView2 bootstrapper when they are not cached, produces the setup under release/, and writes its SHA-256 checksum. Installer settings are in src-tauri/tauri.conf.json. Browser testing tools and downloaded ZIP archives are excluded from staged runtime resources.

For a portable folder, run node scripts/package-desktop.mjs and preserve its resources directory beside ChainXray.exe. Portable users must already have WebView2 and any needed Visual C++ runtime installed.

For wallet capture, enable developer mode in your Chromium browser and load apps/browser-extension as an unpacked extension. Open the dApp tab with a wallet provider and select Capture this tab. Use Stop and export JSON to save the session. To import directly too, choose Pair browser capture in Web3 History and paste the link into the extension immediately before stopping capture. Links expire after 15 minutes or 500 requests and are revoked when the workspace changes. Refresh history to see the new records.

## Dedicated browser
Open a workspace, then click **Open Browser**. This launches bundled Chromium with an isolated persistent profile, MetaMask, and ChainXray Provider Capture. Complete MetaMask onboarding yourself. On the target dapp tab, open the ChainXray extension and choose **Enable wallet interception** before connecting the dapp. Its pairing link is prefilled. Reload the tab to remove interception. Pairing expires after 15 minutes; reopening the browser action refreshes the pairing file, so reopen the extension popup to enable it again.

The desktop workbench remains a standalone app. The browser profile is stored alongside workspace data, separately from your everyday Chrome/MetaMask profile. The browser stays open if the workbench closes; pending intercepted calls fail closed when the engine becomes unavailable. Wallet-to-node RPC interception is not yet implemented.

## Other wallets
Interception discovers EIP-6963 providers and legacy window.ethereum providers without wallet-brand checks. Install your preferred Chromium wallet extension in the dedicated browser, enable wallet interception on the dapp tab, and choose that wallet in the dapp. MetaMask remains bundled as a default, but is not required by interception or browser startup. Other installed extensions are no longer disabled by the launcher.

Compatibility is limited to injected EVM providers whose request method can be wrapped. Read-only providers are reported as unsupported. Enable before the dapp caches a provider method. WalletConnect sessions, separate wallet applications, non-EVM wallets, and transfers initiated inside wallet UI are not covered by this browser hook. Generic-provider tests use test doubles; individual wallet products still require end-to-end verification.

Interception decisions are authenticated with a per-tab HMAC key passed directly into the isolated and main execution worlds, not through page messages. Forged or altered cx-result messages are ignored. This protects the decision bridge; it does not make an injected JavaScript provider hook a security boundary against a page that retains an original provider reference or tampers with the runtime before installation. Reload existing tabs before enabling the updated extension.

The standalone test-dapp.html requires chain 31337 before its actions. ETH transfers return to the connected test account. Approval tests require an entered deployed token address, check contract code, and read decimals. Chain ID checks are guardrails, not proof of a node's identity; use your local test-wallet profile.
