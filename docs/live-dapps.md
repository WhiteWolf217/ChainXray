# Live dapp testing on Ethereum Sepolia

The app starts in Live Dapps. The header Open Browser button opens https://app.uniswap.org/ directly. There is no built-in test-page server. This means real hosted dapps on Sepolia, not a switch to Ethereum mainnet.

1. Restart the updated desktop app and open a workspace.
2. Open Live Dapps. Leave https://app.uniswap.org/ or enter another HTTPS dapp URL. Click Open dapp in test browser.
3. Select Ethereum Sepolia (11155111) in your test wallet and the dapp. Enable testnet display in Uniswap if required. No local Anvil chain is needed.
4. Open ChainXray's extension on that tab. After upgrading, click Repair extension connection once, reopen the popup and enable interception. Reload already-instrumented tabs before enabling again.
5. Connect through a compatible injected wallet. Initiate a test request. A held request should appear in Intercept before the wallet's signing prompt. Drop first to verify the path.
6. Create another request and Forward to reach wallet approval. You approve or reject in the wallet yourself. Test transactions need Sepolia ETH; swaps also need tokens and pool liquidity.

The Sepolia browser session checks eth_chainId before holding and before releasing. Changing networks while held rejects the request. Captured evidence stores the reported chain rather than assuming local chain 31337. These checks are diagnostic protections, not a tamper-proof boundary against a malicious page or provider.

Other requests, WalletConnect, wallet-internal transfers, and previously cached original methods may bypass interception. The extension must be enabled on each dapp tab and again after navigation/reload. If the wallet prompts immediately, cancel and check the extension before assuming capture works.

Live Uniswap may use Universal Router. Raw requests and typed-data signatures are captured, but the v3 SwapRouter decoder does not decode all Universal Router commands. Repeater uses the local lab: it does not automatically fork Sepolia or reproduce remote state. Wallet result/receipt tracking is not implemented.

Uniswap lists Ethereum Sepolia as a supported interface testnet: https://developers.uniswap.org/docs/trading/swapping-api/supported-chains

Validation: local tests cover wrong-network rejection and network changes while held. The real Chromium/extension integration test uses a synthetic wallet provider. A real Uniswap/MetaMask signed transaction remains a separate manual live test.
