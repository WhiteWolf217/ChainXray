# Uniswap integration feedback

Implemented: v3 SwapRouter parameter inspection, controlled calldata mutation, and live V3 quote requests via the Uniswap API, with engine-only session key storage and persisted quote evidence. Reference: https://github.com/Uniswap/v3-periphery/blob/main/contracts/interfaces/ISwapRouter.sol

Current limitation: ABI decoding cannot authenticate deployment identity; Universal Router and v4 command formats require separate decoders. A real swap replay demo is pending provision of matching local contracts and liquidity.

The developer feedback form has not been submitted. Record actual integration feedback and submit https://developers.uniswap.org/hackathon-feedback before entering.
