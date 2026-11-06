import React,{useState,useEffect} from 'react';
export function ArkivSettings({api}:any){
 const [testKey,setTestKey]=useState(''),[accessKey,setAccessKey]=useState(''),[status,setStatus]=useState<any>({}),[error,setError]=useState(''),[busy,setBusy]=useState(false),[connection,setConnection]=useState<any>(null);
 useEffect(()=>{api('arkiv_status').then(setStatus).catch((e:any)=>setError(String(e)));},[]);
 const configure=async(clear=false)=>{setBusy(true);setError('');setConnection(null);try{setStatus(await api('arkiv_configure',clear?{clear:true}:{testKey,accessKey}));setTestKey('');setAccessKey('');}catch(e){setError(String(e));}finally{setBusy(false);}};
 const check=async()=>{setBusy(true);setError('');setConnection(null);try{setConnection(await api('arkiv_check'));}catch(e){setError(String(e));}finally{setBusy(false);}};
 const connectionLabel=connection?'Reads verified':status.configured?'Publisher configured':'Not tested';
 return <details className="arkiv-connection">
  <summary><span className="arkiv-heading">Arkiv connection</span><span className={'arkiv-badge'+(connection?' verified':'')}>{connectionLabel}</span></summary>
  <div className="arkiv-body">
   <div className="arkiv-overview">
    <div><span className="arkiv-caption">Network</span><strong>Rabdi <span className="arkiv-network-tag">Testnet</span></strong><small>Chain 7794095</small></div>
    <div><span className="arkiv-caption">Read access</span><strong>{status.accessKeyConfigured?'Hub access key':'Public RPC'}</strong><small>{status.accessKeyConfigured?'Access key configured':'Rate limits apply'}</small></div>
    <div><span className="arkiv-caption">Publisher balance</span><strong>{connection?.balance!=null?<>{connection.balance} <span className="arkiv-unit">test GLM</span></>:'—'}</strong><small>{connection?.balance==='0'?'Funding required to publish':connection?.balance!=null?'Available for publication fees':'Run a connection test to check'}</small></div>
   </div>
   {status.publisher&&<div className="arkiv-publisher"><span className="arkiv-caption">Publisher</span><code>{status.publisher}</code></div>}
   <div className="arkiv-credentials">
    <h3>Session credentials</h3><p>Use a dedicated test account. Add an access key for reads and a private key to publish.</p>
    <div className="arkiv-fields">
     <label htmlFor="arkiv-private-key">Dedicated test account private key<input id="arkiv-private-key" type="password" autoComplete="off" placeholder={status.configured?'Saved for this session':'64 hex characters, with or without 0x'} value={testKey} onChange={e=>setTestKey(e.target.value)} disabled={busy}/><small>Accepts keys with or without the 0x prefix.</small></label>
     <label htmlFor="arkiv-access-key">Arkiv access key <span className="arkiv-optional">Optional</span><input id="arkiv-access-key" type="password" autoComplete="off" placeholder={status.accessKeyConfigured?'Saved for this session':'Full key copied from Arkiv Hub'} value={accessKey} onChange={e=>setAccessKey(e.target.value)} disabled={busy}/><small>Copy the full key from the Arkiv Hub.</small></label>
    </div>
    <div className="arkiv-actions"><button className="arkiv-primary" disabled={busy||(!testKey&&!accessKey)} onClick={()=>configure()}>Use for this session</button><button disabled={busy||Boolean(testKey||accessKey)} onClick={check}>{busy?'Working…':'Test connection'}</button><button className="arkiv-clear" disabled={busy} onClick={()=>configure(true)}>Clear session settings</button></div>
   </div>
   {connection&&<div className="arkiv-notice" role="status"><span className="arkiv-notice-icon" aria-hidden="true">✓</span><div><strong>Rabdi reads verified</strong><p>{connection.balance==='0'?'Fund this publisher with test GLM before publishing.':connection.balance!==null?'Your connection is ready. Publishing uses test GLM from this account.':'Add a publisher account when you’re ready to publish.'} Connection tests never send a transaction.</p></div></div>}
   {error&&<div className="arkiv-error" role="alert">{error}</div>}
   <p className="arkiv-footnote">Credentials stay in memory and are excluded from reports. Blank fields keep saved values. Clearing session settings preserves any environment configuration.</p>
  </div>
 </details>;
}
