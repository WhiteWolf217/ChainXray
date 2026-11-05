# Mumbai additions and remaining verification

Baseline: ChainXray already had local capture, simulation, evidence archives and a vault reproduction. Record the actual pre-event commit or dated archive before submission. Do not describe the baseline as new hackathon work.

## Uniswap

### Live quote API

Open **Uniswap API**, enter a key from https://developers.uniswap.org/dashboard and click **Use key for this session**. The engine keeps it in memory; alternatively provide UNISWAP_API_KEY before launch. Restarting clears session keys. Enter chain ID, token contract addresses, wallet, amount in raw units and slippage percent, then fetch. A real POST to https://trade-api.gateway.uniswap.org/v1/quote requests V3 / EXACT_INPUT quotes. Results and their request inputs are saved as evidence. The API sees those inputs and the caller's IP. No request occurs automatically.

This integration fetches quotes only. It does not call /swap, sign Permit2, compare a captured transaction automatically, or execute a swap. API quote output may target Universal Router when later built as a transaction; the existing v3 SwapRouter decoder is not a Universal Router decoder. Without a configured valid key, only mocked transport tests have been run; do not describe those tests as a live API verification.

The decoder recognizes Uniswap v3 SwapRouter exactInputSingle, exactOutputSingle, exactInput and exactOutput calldata. Named parameters and zero minimum-output observations appear in evidence. Repeater can re-encode recipient and minimum-output changes. Matching an ABI does not verify the target contract or identify a vulnerability.

Reference interface: https://github.com/Uniswap/v3-periphery/blob/main/contracts/interfaces/ISwapRouter.sol

Replay uses the existing local simulator. A real Uniswap deployment or suitable fork with pools, liquidity, allowances and funded senders is still required for an end-to-end swap demo. The bundled vault is not such a deployment. Universal Router and v4 commands are not covered.

## Arkiv

Desktop setup: open **Shared Findings**, expand **Arkiv connection**, enter a dedicated funded Rabdi test private key and optional access key, and choose **Use for this session**. Querying only needs an access key when the public RPC is insufficient. Settings are held in local engine memory, are not written to evidence, and disappear at exit. **Clear session settings** removes overrides; environment credentials, if configured, still apply. Raw SDK network errors are replaced with generic messages to avoid exposing credential-bearing RPC URLs.

Shared Findings creates a fixed allowlisted summary from decoded swap evidence. Preview it, then export offline or publish explicitly. No raw request, wallet address, signature, origin, calldata or free-form text is copied into the summary.

Configure CHAINXRAY_ARKIV_TEST_KEY as a dedicated funded Rabdi test account and ARKIV_ACCESS_KEY as the optional RPC access key before launching. Neither is sent to the UI. Writes use SDK createEntity and expire after seven days. Query by publisher wallet retrieves up to 25 matching schema entities. Public observations are unverified claims; expiration does not erase third-party copies.

Live write/read verification still requires a funded account. Do not claim a successful deployment until recording the entity key, transaction and publisher address from a real run.

## CROPS

New privacy improvement: a separate allowlisted publication format, preview and offline sanitized export. Existing full archive exports remain private and contain raw evidence. Demonstrate a capture containing a distinctive private marker, export the public preview, and show that only protocol, category and a fixed summary remain. Repeat with internet disconnected.

Submission still requires a public licensed repository, accurate baseline, demo video, Uniswap feedback form and Arkiv documentation/evidence. No sponsor eligibility or prize is guaranteed.
