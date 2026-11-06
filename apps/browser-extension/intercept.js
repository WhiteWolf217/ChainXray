document.getElementById('repair').onclick=()=>{document.getElementById('status').textContent='Close all managed Chrome windows, then use Open Browser in ChainXray. In-place reload can disable this command-line extension.';};
fetch(chrome.runtime.getURL('pair.json')).then(r=>r.json()).then(c=>{document.getElementById('pair').value=c.pair;}).catch(()=>{});
chrome.tabs.query({active:true,currentWindow:true}).then(async([tab])=>{
 if(!tab?.url?.startsWith('https://app.uniswap.org/'))return;
 const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:()=>{
  const hook=window[Symbol.for('chainxray.intercept')],channel=window[Symbol.for('chainxray.metamaskTransport')];
  const sdk=window[Symbol.for('chainxray.sdkIntercept')];
  return {connected:hook?.connected??0,channel:!!channel?.handler,seen:channel?.seen??0,held:channel?.held??0,lastMethod:channel?.lastMethod,lastError:channel?.lastError,sdk:sdk?{connected:sdk.connected,held:sdk.held,lastMethod:sdk.lastMethod,lastError:sdk.lastError}:null};
 }});
 const state=result?.result;
 document.getElementById('status').textContent=state?.connected?'ChainXray v0.1.8: interception active for '+state.connected+' wallet provider(s). '+(state.sdk?.connected?'MetaMask SDK active; held '+state.sdk.held+'. ':'')+(state.channel?'MetaMask message channel active. Seen '+state.seen+' requests; held '+state.held+'. Last method: '+(state.lastMethod??'none')+'. ':'')+(state.lastError?'Last error: '+state.lastError:''):'ChainXray v0.1.8: interception is not ready. Click Enable to check the connection.';
}).catch(()=>{});
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
    const report=await activateChainXray(tab,health);
    if(report?.alreadyEnabled){status.textContent='ChainXray v0.1.8: interception already active on this tab. Reload to reconnect.';return;}

    status.textContent=report?.connected ? 'ChainXray v0.1.8 connected. Interception enabled for '+report.connected+' wallet provider(s). '+(health.expectedChainId?'Ethereum Sepolia required. ':'')+'Choose your wallet in the dapp. Reload this tab to disable.' : 'Listening for wallet providers. No compatible writable provider found yet. Unlock your wallet, then enable again before connecting the dapp.';
    if(report?.unsupported) status.textContent+=' Some providers are read-only and could not be intercepted.';
  } catch(e) {status.textContent=String(e);}
};
