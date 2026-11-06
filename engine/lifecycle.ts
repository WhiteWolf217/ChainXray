export class LifecycleRpcError extends Error {
 readonly method:string;readonly category:string;readonly rpcCode:number|null;
 constructor(publicMessage:string,method:string,category:string,rpcCode:number|null=null){super(publicMessage);this.name='LifecycleRpcError';this.method=method;this.category=category;this.rpcCode=rpcCode;}
}
export function walletOutcome(p:any){
 if(!p||typeof p.sourceEvidence!=='string'||!['returned','error'].includes(p.status))throw Error('Invalid wallet outcome');
 if(p.hash!=null&&!/^0x[0-9a-f]{64}$/i.test(p.hash))throw Error('Invalid transaction hash');
 return {sourceEvidence:p.sourceEvidence,status:p.status,hash:p.status==='returned'?p.hash??null:null,code:p.status==='error'&&Number.isSafeInteger(p.code)?p.code:null,source:'page-observed',note:'Wallet response observed by the page hook. Not proof of mining. Signatures are not stored.'};
}
export async function readLifecycle(rpc:string,chain:string,hash:string,trace:boolean|'transaction'=false,fetcher:typeof fetch=fetch){
 const url=new URL(rpc);
 if(url.username||url.password||url.hash||!(url.protocol==='https:'||(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))))throw Error('Use HTTPS RPC or a local HTTP RPC without embedded username/password');
 if(!/^0x[0-9a-f]{64}$/i.test(hash)||!/^\d+$/.test(chain))throw Error('Known chain and transaction hash required');
 const calls:any[]=[];
 const call=async(method:string,params:any[])=>{
  const start=Date.now();let response;
  try{
   const res=await fetcher(url,{method:'POST',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(20000)});
   if(!res.ok)throw new LifecycleRpcError(`${method} failed with HTTP ${res.status}${res.status===429?' (rate limited)':''}.`,method,res.status===429?'rate-limit':'http');const reader=res.body?.getReader();if(!reader)throw Error();let size=0;const parts:Uint8Array[]=[];
   try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>2_000_000)throw Error();parts.push(item.value);}}finally{await reader.cancel();}
   response=JSON.parse(Buffer.concat(parts).toString());
  }catch(error){if(error instanceof LifecycleRpcError)throw error;throw new LifecycleRpcError(`${method}: connection failed, timed out, or returned an invalid/oversized response.`,method,'transport');}
  if(response.error){const code=Number.isSafeInteger(response.error.code)?response.error.code:null;throw new LifecycleRpcError(code===-32601?`${method} is not supported by this RPC (JSON-RPC -32601).`:code===-32005?`${method} was rate limited by the RPC (JSON-RPC -32005).`:`RPC does not provide this result for ${method}${code!==null?' (JSON-RPC '+code+')':''}; execution data may be unavailable.`,method,code===-32601?'unsupported':code===-32005?'rate-limit':'rpc',code);}
  calls.push({method,params,durationMs:Date.now()-start});return response.result;
 };
 const actual=await call('eth_chainId',[]);
 if(typeof actual!=='string'||!/^0x[0-9a-f]+$/i.test(actual)||BigInt(actual)!==BigInt(chain))throw Error('RPC network does not match the captured transaction');
 if(trace==='transaction')return {status:'transaction',hash,calls,transaction:await call('eth_getTransactionByHash',[hash]),source:'rpc-transaction'};
 if(trace){const result=await call('debug_traceTransaction',[hash,{tracer:'callTracer',timeout:'10s'}]);if(!result||typeof result!=='object'||!result.type)throw Error('RPC did not return a callTracer tree');return {status:'traced',hash,calls,trace:result,source:'rpc-callTracer'};}
 const receipt=await call('eth_getTransactionReceipt',[hash]);
 if(receipt!==null&&(!receipt||receipt.transactionHash?.toLowerCase()!==hash.toLowerCase()||!['0x0','0x1'].includes(receipt.status)))throw Error('Invalid receipt returned by RPC');
 return {status:receipt===null?'pending':receipt.status==='0x1'?'confirmed':'reverted',hash,calls,receipt,source:'rpc-receipt',note:'Receipt reflects this RPC observation; confirmation depth and reorg finality are not tracked.'};
}
