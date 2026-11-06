import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
async function setup(){
 const events=new Map(),calls=[],holds=[];let signingKey,decision='drop';
 const sdk={invokeMethod:async envelope=>{calls.push(envelope);return 'sdk-result';}};
 const window={__METAMASK_CONNECT_MULTICHAIN_SINGLETON__:Promise.resolve(sdk),addEventListener:(n,f)=>events.set(n,[...(events.get(n)??[]),f]),removeEventListener:(n,f)=>events.set(n,(events.get(n)??[]).filter(x=>x!==f)),postMessage:message=>{
  holds.push(message);queueMicrotask(async()=>{const body=JSON.stringify({id:message.id,result:{status:decision,request:{...message.request,params:[{value:'0x2'}]}}});const mac=Array.from(new Uint8Array(await webcrypto.subtle.sign('HMAC',signingKey,new TextEncoder().encode(body))));for(const f of events.get('message')??[])await f({source:window,data:{kind:'cx-sdk-result',id:message.id,body,mac}});});
 }};
 const chrome={scripting:{executeScript:async spec=>{
  if(spec.world==='MAIN')return [{result:await spec.func(...spec.args)}];
  signingKey=await webcrypto.subtle.importKey('raw',new Uint8Array(spec.args[0]),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [{result:true}];
 }}};
 const context={window,chrome,crypto:webcrypto,Uint8Array,TextEncoder,Symbol,BigInt,location:{origin:'https://app.uniswap.org'},setTimeout,clearTimeout,setInterval:fn=>{queueMicrotask(fn);return 1;},clearInterval:()=>{}};
 runInNewContext(readFileSync('apps/browser-extension/sdk-activation.js','utf8'),context);
 await context.activateChainXraySdk({id:1},{expectedChainId:'0xaa36a7'});await new Promise(r=>setImmediate(r));
 return {sdk,calls,holds,forward:()=>decision='forward'};
}
test('MetaMask SDK invocation is held and dropped before its direct Chrome port executes',async()=>{
 const {sdk,calls,holds}=await setup();
 await assert.rejects(sdk.invokeMethod({scope:'eip155:11155111',request:{method:'eth_sendTransaction',params:[{value:'0x1'}]}}),e=>e.code===4001);
 assert.equal(calls.length,0);assert.equal(holds.length,1);assert.equal(holds[0].chainId,'0xaa36a7');
});
test('SDK forwarding preserves scope and envelope, and sends edited parameters exactly once',async()=>{
 const env=await setup();env.forward();
 assert.equal(await env.sdk.invokeMethod({scope:'eip155:11155111',request:{method:'wallet_sendTransaction',params:[{value:'0x1'}]},marker:'preserved'}),'sdk-result');
 assert.equal(env.calls.length,1);assert.equal(env.calls[0].scope,'eip155:11155111');assert.equal(env.calls[0].marker,'preserved');assert.equal(env.calls[0].request.params[0].value,'0x2');
});
test('SDK wrong-network calls are blocked and read requests pass through',async()=>{
 const env=await setup();await assert.rejects(env.sdk.invokeMethod({scope:'eip155:1',request:{method:'personal_sign',params:[]}}),e=>e.code===4901);
 assert.equal(env.holds.length,0);assert.equal(env.calls.length,0);
 assert.equal(await env.sdk.invokeMethod({scope:'eip155:11155111',request:{method:'eth_accounts'}}),'sdk-result');assert.equal(env.calls.length,1);
});
