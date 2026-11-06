// Install a stable request function before the dapp can cache/bind it.
// Managed Uniswap tabs activate after engine pairing is checked.
(() => {
 const key=Symbol.for('chainxray.earlyProviders');
 if(window[key])return;
 const entries=new WeakMap();
 window[key]={entries};
 // MetaMask's page-to-extension channel also carries legacy/cached provider calls.
 const transport={handler:null,seen:0,held:0,lastMethod:null,lastError:null};
 const allowances=new Map();
 const fingerprint=request=>JSON.stringify([request.method,request.params??[]],(_,v)=>typeof v==='string'&&/^0x[0-9a-f]*$/i.test(v)?v.toLowerCase():v);
 transport.allow=request=>{
  const key=fingerprint(request),token={};const tokens=allowances.get(key)??new Set();tokens.add(token);allowances.set(key,tokens);
  const cleanup=()=>{tokens.delete(token);if(!tokens.size)allowances.delete(key);};
  const timer=setTimeout(cleanup,10000);
  return ()=>{clearTimeout(timer);cleanup();};
 };
 window[Symbol.for('chainxray.metamaskTransport')]=transport;
 const post=window.postMessage.bind(window);
 window.postMessage=function(message,...args){
  const request=message?.target==='metamask-contentscript'&&message?.data?.name==='metamask-provider'?message.data.data:null;
  if(request?.method){transport.seen++;transport.lastMethod=request.method;}
  if(!transport.handler||!request||request.id==null||! /^(eth_sendTransaction|wallet_sendTransaction|eth_signTransaction|eth_sendRawTransaction|eth_signTypedData(?:_v[134])?|personal_sign|eth_sign|wallet_sendCalls)$/.test(request.method))return post(message,...args);
  const tokens=allowances.get(fingerprint(request));
  if(tokens?.size){tokens.delete(tokens.values().next().value);if(!tokens.size)allowances.delete(fingerprint(request));return post(message,...args);}
  transport.held++;
  Promise.resolve().then(()=>transport.handler(request)).then(approved=>{
   post({...message,data:{...message.data,data:{...request,method:approved.method,params:approved.params}}},...args);
  },error=>{
   transport.lastError=String(error.message??error);
   post({target:'metamask-inpage',data:{name:'metamask-provider',data:{id:request.id,jsonrpc:request.jsonrpc??'2.0',error:{code:Number.isInteger(error.code)?error.code:-32000,message:transport.lastError}}}},location.origin);
  });
 };
 const wrap=provider=>{
  if(!provider||!['object','function'].includes(typeof provider)||entries.has(provider))return;
  const original=provider.request;if(typeof original!=='function')return;
  const entry={original,handler:null};
  const stable=function(request){return (entry.handler??original).call(provider,request);};
  try{provider.request=stable;if(provider.request===stable)entries.set(provider,entry);}catch{}
 };
 window.addEventListener('eip6963:announceProvider',e=>wrap(e.detail?.provider));
 const legacy=()=>{window.ethereum?.providers?.forEach(wrap);wrap(window.ethereum);};
 window.addEventListener('ethereum#initialized',legacy);
 legacy();window.dispatchEvent(new Event('eip6963:requestProvider'));
})();
