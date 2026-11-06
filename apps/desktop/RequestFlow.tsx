import React, { useState } from 'react';
import { Lifecycle } from './Lifecycle';
function nodeLabel(value:string){if(/^0x[0-9a-f]{40}$/i.test(value))return value.slice(0,8)+'…'+value.slice(-6);try{if(/^https?:/.test(value))return new URL(value).host;}catch{}return value;}

export function RequestFlow({ rows, onRepeater, api, onRefresh }: any) {
  const [id, setId] = useState('');
  const [step, setStep] = useState(1);
  const captures = rows.filter((r: any) => r.kind === 'capture');
  const row = captures.find((r: any) => r.id === id) ?? captures[0];
  if (!row) return <section><h2>Follow a wallet request</h2><p>Capture a request first. This view will show its source, method, wallet address and destination as connected blocks.</p><p>Open Browser → enable interception → initiate a request → inspect it here.</p></section>;
  const request = row.input;
  const tx = request.params?.[0];
  const transaction = tx && typeof tx === 'object' && !Array.isArray(tx) ? tx : null;
  const status = request.interception?.status ?? 'recorded';
  const nodes = [
    { title: 'Dapp', value: request.origin || 'Origin not recorded', detail: 'The site that initiated this captured request.' },
    { title: 'ChainXray', value: request.method || 'Unknown method', detail: `Recorded event status: ${status}. This archive entry is not a live queue indicator. Inspect or copy this request for local analysis.` },
    { title: 'Wallet', value: transaction?.from || 'Address not present in transaction envelope', detail: 'Forward releases a held request to wallet approval. Supported hook outcomes and RPC receipt reads appear in the lifecycle below.' },
    { title: 'Destination', value: transaction?.to || 'No transaction destination', detail: transaction?.to ? `Requested function: ${row.output?.functionName || transaction.data?.slice(0, 10) || 'Native token transfer'}. Contract internals and downstream calls require an execution trace.` : 'Signing and permission requests may have no contract destination.' },
  ];
  return <section><h2>Follow a wallet request</h2><p>Select a capture, then click a block to inspect it. Arrows describe the request path, not confirmed on-chain execution.</p>
    <label className="form-label">Captured request<select value={row.id} onChange={e => { setId(e.target.value); setStep(1); }}>{captures.map((r: any) => <option key={r.id} value={r.id}>{r.input.method} · {r.id.slice(0, 10)} · {r.time}</option>)}</select></label>
    <div className="request-flow" aria-label="Request path">{nodes.map((node, i) => <React.Fragment key={node.title}>{i > 0 && <span className="flow-arrow" aria-hidden="true">→</span>}<button className={'flow-node ' + (step === i ? 'selected' : '')} aria-pressed={step === i} title={node.value} onClick={() => setStep(i)}><small>{i + 1}. {node.title}</small><strong>{nodeLabel(node.value)}</strong></button></React.Fragment>)}</div>
    <div className="flow-detail"><h3>{nodes[step].title}</h3><p>{nodes[step].detail}</p><code>{nodes[step].value}</code></div>
    {status === 'drop' && <p className="status-warning">Dropped: this request was rejected before wallet approval.</p>}
    <details><summary>Full captured request</summary><pre>{JSON.stringify(request, null, 2)}</pre></details>
    {transaction && ['eth_sendTransaction', 'eth_call', 'eth_estimateGas'].includes(request.method) && <button onClick={() => onRepeater({ ...transaction, sourceEvidence: row.id })}>Copy transaction to Repeater</button>}
    <p>Repeater runs against the local lab. It does not reproduce public chain state automatically.</p>
    <Lifecycle key={row.id} row={row} rows={rows} api={api} onRefresh={onRefresh}/>
  </section>;
}
