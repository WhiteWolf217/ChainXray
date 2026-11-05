import {address,object} from './validation.ts';
let sessionKey='';
export const uniswapApiConfigured=()=>Boolean(sessionKey||process.env.UNISWAP_API_KEY);
export function configureUniswapApi(key:unknown){
 if(typeof key!=='string'||key.length>512||/[\r\n]/.test(key))throw Error('Invalid API key');
 sessionKey=key.trim();
 return {configured:uniswapApiConfigured()};
}
export function quoteInput(value:unknown){
 const p=object(value);
 const chain=Number(p.chainId);
 if(!Number.isSafeInteger(chain)||chain<=0)throw Error('Enter a positive chain ID');
 const amount=String(p.amount??'');
 if(!/^[1-9][0-9]{0,77}$/.test(amount)||BigInt(amount)>2n**256n-1n)throw Error('Amount must be a positive integer in raw token units');
 const slippage=Number(p.slippageTolerance??0.5);
 if(!Number.isFinite(slippage)||slippage<0||slippage>100||Math.abs(slippage*100-Math.round(slippage*100))>0.000001)throw Error('Slippage must be 0–100 percent with at most two decimals');
 return {type:'EXACT_INPUT',tokenIn:address(p.tokenIn),tokenOut:address(p.tokenOut),swapper:address(p.swapper),amount,tokenInChainId:chain,tokenOutChainId:chain,slippageTolerance:slippage,protocols:['V3'],routingPreference:'BEST_PRICE'};
}
export async function requestUniswapQuote(value:unknown,fetcher:typeof fetch=fetch){
 const input=quoteInput(value),key=sessionKey||process.env.UNISWAP_API_KEY;
 if(!key)throw Error('Configure your Uniswap API key first');
 let res:Response;
 try{res=await fetcher('https://trade-api.gateway.uniswap.org/v1/quote',{
  method:'POST',redirect:'error',headers:{'content-type':'application/json','x-api-key':key,'x-universal-router-version':'2.1.2'},
  body:JSON.stringify(input),signal:AbortSignal.timeout(20000),
 });}catch{throw Error('Uniswap API could not be reached or timed out');}
 if(!res.ok){await res.body?.cancel();throw Error(res.status===401||res.status===403?'Uniswap rejected the API key':res.status===429?'Uniswap rate limit reached; try again later':`Uniswap quote failed (HTTP ${res.status}); verify tokens, chain, amount and liquidity`);}
 const reader=res.body?.getReader();if(!reader)throw Error('Empty Uniswap response');
 let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2000000)throw Error('Uniswap response exceeds 2 MB');chunks.push(value);}}finally{await reader.cancel();}
 let result:any;try{result=JSON.parse(Buffer.concat(chunks).toString());}catch{throw Error('Invalid Uniswap response');}
 if(!result.quote||result.routing!=='CLASSIC')throw Error('Expected a classic Uniswap quote');
 return {request:input,response:result,receivedAt:new Date().toISOString(),note:'Quote only; no transaction signed or broadcast. API simulation is not a local replay. Quotes change with market state.'};
}
