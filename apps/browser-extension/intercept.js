document.getElementById('repair').onclick=()=>chrome.runtime.reload();
fetch(chrome.runtime.getURL('pair.json')).then(r=>r.json()).then(c=>{document.getElementById('pair').value=c.pair;}).catch(()=>{});
document.getElementById('intercept').onclick = async () => {
  const status = document.getElementById('status');
  try {
    const pair = document.getElementById('pair').value.trim(), url = new URL(pair);
    if(url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !/^#[a-f0-9]{64}$/.test(url.hash)) throw Error('Enter a desktop pairing link');
    let managedPair=false;
    try{const r=await fetch(chrome.runtime.getURL('pair.json'),{cache:'no-store'});managedPair=(await r.json()).pair===pair;}catch{}
    await chrome.storage.session.set({pair,managedPair});
    const health=await chrome.runtime.sendMessage({kind:'cx-check'});
    if(!health)throw Error('The extension background worker is outdated or not responding. Click Repair extension connection, then reopen this popup and enable interception. The desktop engine may still be healthy.');
    if(health.status!=='ready')throw Error(health.error || 'Extension returned an invalid connection response. Click Repair extension connection.');
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    const secret=Array.from(crypto.getRandomValues(new Uint8Array(32)));
    const bridge=await chrome.scripting.executeScript({target:{tabId:tab.id}, args:[secret], func:async(secret)=>{
      if(globalThis.cxBridge) return false;
      globalThis.cxBridge=true;
      const signingKey=await crypto.subtle.importKey('raw',new Uint8Array(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
      window.addEventListener('message', async e=>{
        if(e.source!==window || e.data?.kind!=='cx-hold') return;
        const id=e.data.id;
        let result;
        try { result=await chrome.runtime.sendMessage({kind:'cx-intercept',request:e.data.request}); }
        catch { result={status:'error',error:'Extension connection lost. Repair the extension connection, reload the dapp and enable interception again.'}; }
        const body=JSON.stringify({id,result:result??{status:'error',error:'No response from the extension background worker. Repair extension connection and reload the dapp.'}});
        const mac=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',signingKey,new TextEncoder().encode(body))));
        window.postMessage({kind:'cx-result',id,body,mac},location.origin);
      });
      return true;
    }});
    if(bridge[0]?.result===false) {status.textContent='Already enabled. Reload the dapp to reconnect or change pairing.';return;}
    const injection = await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',args:[secret],func:async(secret)=>{
      const verify=crypto.subtle.verify.bind(crypto.subtle);
      const verificationKey=await crypto.subtle.importKey('raw',new Uint8Array(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
      const key=Symbol.for('chainxray.intercept');
      if(window[key]) return window[key];
      const report={connected:0,unsupported:0};
      window[key]=report;
      const wrapped=new WeakSet();
      const wrap=provider=>{
        if(!provider || (typeof provider!=='object' && typeof provider!=='function') || wrapped.has(provider)) return;
        const original=provider.request;
        if(typeof original!=='function') return;
        const intercepted=async function(request){
          if(!/^(eth_sendTransaction|eth_sendRawTransaction|eth_signTypedData(?:_v[134])?|personal_sign|eth_sign)$/.test(request.method)) return original.call(provider,request);
          const id=crypto.randomUUID();
          const result=await new Promise(resolve=>{
            const listener=async e=>{if(e.source!==window || e.data?.kind!=='cx-result' || e.data.id!==id) return;
              try {const {body,mac}=e.data;if(typeof body!=='string'||!Array.isArray(mac)||mac.length!==32)return;
                if(!await verify('HMAC',verificationKey,new Uint8Array(mac),new TextEncoder().encode(body)))return;
                const decision=JSON.parse(body);if(decision.id!==id)return;
                clearTimeout(timer);window.removeEventListener('message',listener);resolve(decision.result);
              }catch{ /* Ignore forged or malformed decisions. */ }
            };
            const timer=setTimeout(()=>{window.removeEventListener('message',listener);resolve({status:'error',error:'Interception timed out after five minutes.'});},300000);
            window.addEventListener('message',listener);
            window.postMessage({kind:'cx-hold',id,request:{method:request.method,params:request.params??[]}},location.origin);
          });
          if(result?.status==='error')throw Object.assign(new Error(result.error),{code:-32000});
          if(result?.status!=='forward') throw Object.assign(new Error('Request dropped by ChainXray'),{code:4001});
          return original.call(provider,result.request);
        };
        try { provider.request=intercepted; if(provider.request!==intercepted) throw Error('Read-only provider'); wrapped.add(provider); report.connected++; }
        catch { report.unsupported++; }

      };
      window.addEventListener('eip6963:announceProvider',e=>{wrap(e.detail?.provider);});
      window.dispatchEvent(new Event('eip6963:requestProvider'));
      const legacy=()=>{if(Array.isArray(window.ethereum?.providers)) window.ethereum.providers.forEach(wrap);wrap(window.ethereum);};
      legacy();
      window.addEventListener('ethereum#initialized',legacy);
      return report;
    }});
    const report=injection[0]?.result;
    status.textContent=report?.connected ? 'ChainXray v0.1.2 connected. Interception enabled for '+report.connected+' wallet provider(s). Choose your wallet in the dapp. Reload this tab to disable.' : 'Listening for wallet providers. No compatible writable provider found yet. Unlock your wallet, then enable again before connecting the dapp.';
    if(report?.unsupported) status.textContent+=' Some providers are read-only and could not be intercepted.';
  } catch(e) {status.textContent=String(e);}
};
