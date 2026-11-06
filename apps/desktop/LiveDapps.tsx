import React, { useState } from 'react';
export function LiveDapps({ api, onNavigate }: any) {
  const [url, setUrl] = useState('https://app.uniswap.org/'), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  return <>
    <section><h2>Start a debugging session</h2><p>Use a hosted dapp with a Sepolia test wallet. Requests and debugging results stay in your local workspace.</p>
      <form onSubmit={async e => { e.preventDefault(); setBusy(true); setMessage(''); try { await api('browser_open', { url, network: 'sepolia' }); setMessage('Browser opened. Check the ChainXray extension status, select Sepolia and connect your wallet.'); } catch (e) { setMessage(String(e)); } finally { setBusy(false); } }}>
        <label className="form-label">Dapp address<input required type="url" value={url} onChange={e => setUrl(e.target.value)}/></label><button disabled={busy} type="submit">{busy ? 'Opening browser…' : 'Open dapp in browser'}</button>
      </form><p role="status">{message}</p>
    </section>
    <section><h2>Your first capture</h2><ol className="setup-steps">
      <li><strong>Connect on Sepolia</strong><p>Unlock your test wallet. Select Ethereum Sepolia in both wallet and dapp. On Uniswap, enable testnets if needed.</p></li>
      <li><strong>Check interception</strong><p>Open the ChainXray extension on the dapp tab. On Uniswap, check for MetaMask SDK active after connecting. Other compatible injected wallets use the provider hook.</p></li>
      <li><strong>Initiate a wallet request</strong><p>Try an ETH → WETH wrap on Uniswap. Account and network permission prompts can pass through; the transaction should appear in Intercept before wallet approval.</p><button onClick={() => onNavigate('Intercept')}>Open Intercept</button></li>
      <li><strong>Inspect and drop your first request</strong><p>Drop verifies that ChainXray held it. Forward releases a new request to your wallet for your approval. Copying to Repeater leaves the original held.</p><button onClick={() => onNavigate('Web3 History')}>View request history</button><button onClick={() => onNavigate('Request Flow')}>Explore request flow</button></li>
    </ol></section>
    <details><summary>Connection help and capture limits</summary><div><p>Keep ChainXray open. Pairing lasts 15 minutes; Open Browser refreshes it and clears held requests, so resolve those first. After an extension update, close every managed browser window and restart through Open Browser.</p><p>If the wallet opens transaction approval immediately, cancel and check extension status. WalletConnect, wallet-internal transfers and other wallet SDKs may bypass interception. An active provider hook alone does not establish MetaMask SDK coverage.</p><p>Universal Router calldata is captured but is not fully decoded. Repeater uses the local lab and does not automatically fork Sepolia. Supported wallet outcomes and manual receipt/trace reads appear in Request Flow. Uniswap API quotes are a separate optional tool.</p></div></details>
  </>;
}
