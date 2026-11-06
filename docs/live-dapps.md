# Live dapp testing on Ethereum Sepolia

## Extension 0.1.8 update

Live Uniswap's MetaMask connector uses MetaMask Connect's direct ChromeTransport (CAIP-348), rather than the injected window.ethereum transport for transactions. ChainXray now hooks the SDK singleton's invokeMethod, extracts the inner EVM request, checks its eip155 scope against Sepolia, and sends it to the existing hold queue. Forward preserves the SDK envelope and scope while using the edited inner request; Drop rejects with 4001. The SDK hook waits for initialization even if the wallet is connected later. The popup separately reports SDK readiness. Browser-provider hooks remain enabled alongside the older message-channel hook; one-use forwarding allowances prevent duplicate holds when both paths observe the same request.

Managed extension staging now uses content-derived filenames for the background worker and its activation import. In an affected persistent browser profile, the old worker was still running despite an updated manifest version, so auto-enable messages returned no response. New filenames prevent reuse of those old script URLs. The Repair button now instructs a full managed-browser restart instead of calling runtime.reload, which disabled the command-line extension in that profile. Keep the desktop engine running and use Open Browser after reopening a workspace to refresh pairing.

For the injected-provider path, MetaMask calls through cached original methods and sendAsync can be held at its page-to-extension message channel; other injected wallets retain provider-level interception. Uniswap's MetaMask SDK transaction path is held at the SDK invocation hook described above. The popup reports channel request counts, the last method and errors. WalletConnect and wallet-internal sends are separate paths.

Uniswap gets a document-start provider shim so cached provider requests can still be intercepted. Managed Uniswap tabs automatically check pairing and activate interception on each navigation/reload. The popup checks the current page's hook status. Other HTTPS origins still use the existing manual hook. wallet_sendCalls batches are held too; they are not yet decoded or expanded into Repeater cases.

After updating: close every managed Chrome for Testing window and the desktop, restart the desktop, open a workspace, then click Open Browser. The popup must report v0.1.8. For Uniswap's MetaMask SDK connection, check for **MetaMask SDK active**; an active injected provider or message channel alone does not establish SDK coverage. The Repair button displays restart instructions; it no longer reloads the command-line extension in place. Existing loaded pages cannot acquire a document-start hook retroactively.

The app starts in Live Dapps. The header Open Browser button opens https://app.uniswap.org/ directly. There is no built-in test-page server. This means real hosted dapps on Sepolia, not a switch to Ethereum mainnet.

1. Restart the updated desktop app and open a workspace.
2. Open Live Dapps. Leave https://app.uniswap.org/ or enter another HTTPS dapp URL. Click Open dapp in test browser.
3. Select Ethereum Sepolia (11155111) in your test wallet and the dapp. Enable testnet display in Uniswap if required. No local Anvil chain is needed.
4. Open ChainXray's extension on that tab. After upgrading, close the managed browser completely, use Open Browser in the running desktop, then reload the dapp. Confirm the popup reports an active interception channel.
5. Connect through MetaMask SDK or a compatible injected wallet. MetaMask may first request account/network permissions; these pass through and are distinct from transaction approval. Initiate a test request. A held request should appear in Intercept before the wallet's transaction/signing prompt. Drop first to verify the path.
6. Create another request and Forward to reach wallet approval. You approve or reject in the wallet yourself. Test transactions need Sepolia ETH; swaps also need tokens and pool liquidity.

The injected-provider path checks eth_chainId before holding and before releasing; changing networks while held rejects the request. The SDK path checks the invocation's eip155 scope against Sepolia and preserves that scope when forwarding. Captured evidence stores the reported chain rather than assuming local chain 31337. These checks are diagnostic protections, not a tamper-proof boundary against a malicious page or provider.

Keep the desktop running during capture. Pairing expires after 15 minutes and accepts up to 500 capture requests; Open Browser refreshes pairing. Held requests expire after five minutes. Refreshing pairing clears the existing queue, so resolve held requests first.

Other wallet SDKs, WalletConnect, wallet-internal transfers and cached original methods in unsupported integrations may bypass interception. Outside Uniswap, enable the extension on each dapp tab and again after navigation/reload. If the wallet prompts immediately, cancel and check the extension before assuming capture works.

Live Uniswap may use Universal Router. Raw requests and typed-data signatures are captured, but the v3 SwapRouter decoder does not decode all Universal Router commands. Repeater uses the local lab: it does not automatically fork Sepolia or reproduce remote state. Wallet result/receipt tracking is not implemented.

Uniswap lists Ethereum Sepolia as a supported interface testnet: https://developers.uniswap.org/docs/trading/swapping-api/supported-chains

## Verification

On November 6, 2026, an actual Uniswap 0.001 Sepolia ETH to WETH wrap through the MetaMask SDK connector was held as eth_sendTransaction in the desktop Intercept screen. The user selected Drop and confirmed that Uniswap rejected the request. This verifies the live SDK capture/drop path. No transaction was approved as part of that verification. Live SDK forwarding followed by wallet execution remains unverified.

Automated tests cover SDK capture/drop, scope validation, forwarding with the envelope preserved, injected-provider network checks, cached-method interception, and worker staging. Run `npm test` with Node 24 and the documented local lab dependencies installed.

The optional `node scripts/test-live-provider.mjs` test needs the bundled Chromium and MetaMask under runtime/ plus internet access. It uses a disposable profile on the hosted Uniswap page and issues test calls through the real injected provider via request, a cached original method and sendAsync. Every call is dropped; no wallet is unlocked and nothing is signed or broadcast. These calls are distinct from exercising Uniswap's own SDK connector.

SDK interception currently depends on MetaMask Connect exposing its singleton and a writable invokeMethod. Changes to that SDK interface may require an adapter update. It does not cover every wallet SDK or WalletConnect.
