// MetaMask Connect's ChromeTransport bypasses window.ethereum via a direct runtime port.
globalThis.activateChainXraySdk=async function(tab,health){
 const secret=Array.from(crypto.getRandomValues(new Uint8Array(32)));
 const [bridge]=await chrome.scripting.executeScript({target:{tabId:tab.id},args:[secret],func:async secret=>{
  if(globalThis.cxSdkBridge)return false;
  const key=await crypto.subtle.importKey('raw',new Uint8Array(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  globalThis.cxSdkBridge=true;
  const released=new Set();
  window.addEventListener('message',async event=>{
   if(event.source===window&&event.data?.kind==='cx-sdk-outcome'&&released.delete(event.data.sourceEvidence)){
    try{await chrome.runtime.sendMessage({kind:'cx-outcome',outcome:event.data});}catch{}return;
   }
   if(event.source!==window||event.data?.kind!=='cx-sdk-hold')return;
   const {id,request,chainId}=event.data;
   let result;
   try{result=await chrome.runtime.sendMessage({kind:'cx-intercept',request,chainId,hook:'metamask-sdk'});if(result?.status==='forward'&&result.sourceEvidence)released.add(result.sourceEvidence);}
   catch(error){result={status:'error',error:'SDK interception connection failed: '+String(error)};}
   const body=JSON.stringify({id,result:result??{status:'error',error:'SDK interception worker did not respond'}});
   const mac=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body))));
   window.postMessage({kind:'cx-sdk-result',id,body,mac},location.origin);
  });return true;
 }});
 if(bridge?.result===false)return {alreadyEnabled:true};
 const [injection]=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',args:[secret,health.expectedChainId??null],func:async(secret,expectedChainId)=>{
  const key=await crypto.subtle.importKey('raw',new Uint8Array(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const report={connected:false,held:0,lastMethod:null,lastError:null};window[Symbol.for('chainxray.sdkIntercept')]=report;
  const sensitive=/^(eth_sendTransaction|wallet_sendTransaction|eth_sendRawTransaction|eth_signTransaction|eth_signTypedData(?:_v[134])?|personal_sign|eth_sign|wallet_sendCalls)$/;
  const attach=async()=>{
   const pending=window.__METAMASK_CONNECT_MULTICHAIN_SINGLETON__;if(!pending)return false;
   const sdk=await pending;if(typeof sdk?.invokeMethod!=='function')return false;
   const original=sdk.invokeMethod;
   sdk.invokeMethod=async function(envelope){
    const request=envelope?.request;report.lastMethod=request?.method??null;
    if(!request||!sensitive.test(request.method))return original.call(this,envelope);
    try{
     const scope=/^eip155:([0-9]+)$/.exec(envelope.scope??'');
     const chainId=scope?'0x'+BigInt(scope[1]).toString(16):null;
     if(expectedChainId&&chainId!==expectedChainId)throw Object.assign(Error('ChainXray SDK session requires Ethereum Sepolia.'),{code:4901});
     const id=crypto.randomUUID();report.held++;
     const decision=await new Promise(resolve=>{
      const listener=async event=>{
       if(event.source!==window||event.data?.kind!=='cx-sdk-result'||event.data.id!==id)return;
       try{const {body,mac}=event.data;if(typeof body!=='string'||!Array.isArray(mac)||mac.length!==32)return;
        if(!await crypto.subtle.verify('HMAC',key,new Uint8Array(mac),new TextEncoder().encode(body)))return;
        const parsed=JSON.parse(body);if(parsed.id!==id)return;clearTimeout(timer);window.removeEventListener('message',listener);resolve(parsed.result);
       }catch{}
      };
      const timer=setTimeout(()=>{window.removeEventListener('message',listener);resolve({status:'error',error:'SDK interception timed out'});},300000);
      window.addEventListener('message',listener);window.postMessage({kind:'cx-sdk-hold',id,chainId,request:{method:request.method,params:request.params??[]}},location.origin);
     });
     if(decision?.status==='error')throw Object.assign(Error(decision.error),{code:-32000});
     if(decision?.status!=='forward')throw Object.assign(Error('Request dropped by ChainXray'),{code:4001});
     try{
      const result=await original.call(this,{...envelope,request:decision.request});
      if(decision.sourceEvidence)window.postMessage({kind:'cx-sdk-outcome',sourceEvidence:decision.sourceEvidence,status:'returned',hash:/^(eth_sendTransaction|wallet_sendTransaction|eth_sendRawTransaction)$/.test(request.method)&&typeof result==='string'&&/^0x[0-9a-f]{64}$/i.test(result)?result:null},location.origin);
      return result;
     }catch(error){if(decision.sourceEvidence)window.postMessage({kind:'cx-sdk-outcome',sourceEvidence:decision.sourceEvidence,status:'error',code:Number.isInteger(error.code)?error.code:null},location.origin);throw error;}
    }catch(error){report.lastError=String(error.message??error);throw error;}
   };
   if(sdk.invokeMethod===original)throw Error('MetaMask SDK method is read-only');
   report.connected=true;return true;
  };
  let busy=false;
  const timer=setInterval(async()=>{if(busy)return;busy=true;try{if(await attach())clearInterval(timer);}catch(error){report.lastError=String(error);clearInterval(timer);}finally{busy=false;}},250);
  return report;
 }});return injection?.result;
};
