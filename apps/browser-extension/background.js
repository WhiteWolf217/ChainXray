importScripts('activation.js');
importScripts('sdk-activation.js');
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!['cx-intercept','cx-check','cx-auto-enable'].includes(message.kind) || (message.kind!=='cx-check' && !sender.tab)) return;
  (async () => {
    const stored=await chrome.storage.session.get(['pair','managedPair']);
    let config=stored.pair;
    if(message.kind==='cx-auto-enable' && new URL(sender.url).origin!=='https://app.uniswap.org')throw Error('Automatic activation is limited to Uniswap');
    if(stored.managedPair||message.kind==='cx-auto-enable'){try{const r=await fetch(chrome.runtime.getURL('pair.json'),{cache:'no-store'});if(r.ok){config=(await r.json()).pair;if(message.kind==='cx-auto-enable')await chrome.storage.session.set({pair:config,managedPair:true});}}catch{}}
    if (!config) throw Error('Pair ChainXray first');
    const url = new URL(config);
    const call = async (action, payload) => {
      const r = await fetch(url.origin + '/api', {method:'POST', redirect:'error', headers:{'content-type':'application/json', authorization:'Bearer '+url.hash.slice(1)}, body:JSON.stringify({action,payload}), signal:AbortSignal.timeout(10000)});
      if (!r.ok) {if(r.status===403)throw Error('ChainXray pairing expired or was replaced. Click Open Browser in the desktop app, then enable interception again.');if(r.status===429)throw Error('Pairing request limit reached. Click Open Browser to pair again.');throw Error('ChainXray engine error ('+r.status+').');}
      return r.json();
    };
    if(message.kind==='cx-check'){const config=await call('intercept_poll',{id:'connection-check'});return {status:'ready',expectedChainId:config.expectedChainId??null};}
    if(message.kind==='cx-auto-enable'){
      const health=await call('intercept_poll',{id:'connection-check'});
      const report=await activateChainXray(sender.tab,health);
      await chrome.storage.session.set({['tab-status-'+sender.tab.id]:{...report,version:'0.1.8'}});
      return {status:'ready',...report};
    }
    const {id} = await call('intercept', {request:message.request, chainId:message.chainId,origin:sender.url});
    for (let i=0;i<300;i++) {
      const result = await call('intercept_poll',{id});
      if(result.status !== 'held') return result;
      await new Promise(r=>setTimeout(r,1000));
    }
    return {status:'drop'};
  })().then(respond, e=>respond({status:'error', error:'ChainXray connection: '+String(e)}));
  return true;
});
