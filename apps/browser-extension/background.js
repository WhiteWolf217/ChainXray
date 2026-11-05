chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!['cx-intercept','cx-check'].includes(message.kind) || (message.kind==='cx-intercept' && !sender.tab)) return;
  (async () => {
    const stored=await chrome.storage.session.get(['pair','managedPair']);
    let config=stored.pair;
    if(stored.managedPair){try{const r=await fetch(chrome.runtime.getURL('pair.json'),{cache:'no-store'});if(r.ok)config=(await r.json()).pair;}catch{}} 
    if (!config) throw Error('Pair ChainXray first');
    const url = new URL(config);
    const call = async (action, payload) => {
      const r = await fetch(url.origin + '/api', {method:'POST', redirect:'error', headers:{'content-type':'application/json', authorization:'Bearer '+url.hash.slice(1)}, body:JSON.stringify({action,payload}), signal:AbortSignal.timeout(10000)});
      if (!r.ok) {if(r.status===403)throw Error('ChainXray pairing expired or was replaced. Click Open Browser in the desktop app, then enable interception again.');if(r.status===429)throw Error('Pairing request limit reached. Click Open Browser to pair again.');throw Error('ChainXray engine error ('+r.status+').');}
      return r.json();
    };
    if(message.kind==='cx-check'){await call('intercept_poll',{id:'connection-check'});return {status:'ready'};}
    const {id} = await call('intercept', {request:message.request, origin:sender.url});
    for (let i=0;i<300;i++) {
      const result = await call('intercept_poll',{id});
      if(result.status !== 'held') return result;
      await new Promise(r=>setTimeout(r,1000));
    }
    return {status:'drop'};
  })().then(respond, e=>respond({status:'error', error:'ChainXray connection: '+String(e)}));
  return true;
});
