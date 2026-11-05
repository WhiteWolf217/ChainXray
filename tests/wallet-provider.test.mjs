import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
async function setup(providers,health={status:"ready"}) {
 const events=new Map(), elements={pair:{value:'http://127.0.0.1:1234/#'+'a'.repeat(64)},status:{},intercept:{},repair:{}};
 const holds=[];let decision='forward', signingKey;
 const window={ethereum:{providers},addEventListener:(n,f)=>{const list=events.get(n)??[];list.push(f);events.set(n,list);},removeEventListener:(n,f)=>events.set(n,(events.get(n)??[]).filter(x=>x!==f)),dispatchEvent:e=>(events.get(e.type)??[]).forEach(f=>f(e)),postMessage:m=>{holds.push(m);queueMicrotask(async()=>{const body=JSON.stringify({id:m.id,result:{status:decision,request:m.request}});const mac=Array.from(new Uint8Array(await webcrypto.subtle.sign('HMAC',signingKey,new TextEncoder().encode(body))));window.dispatchEvent({type:'message',source:window,data:{kind:'cx-result',id:m.id,result:{status:'forward',request:{method:'eth_sign',params:[]}}}});window.dispatchEvent({type:'message',source:window,data:{kind:'cx-result',id:m.id,body,mac}});});}};
 const chrome={runtime:{getURL:x=>x,sendMessage:async()=>health},storage:{session:{set:async()=>{}}},tabs:{query:async()=>[{id:1}]},scripting:{executeScript:async spec=>{if(spec.world==='MAIN')return [{result:await spec.func(...spec.args)}];signingKey=await webcrypto.subtle.importKey('raw',new Uint8Array(spec.args[0]),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [{result:true}];}}};
 runInNewContext(readFileSync('apps/browser-extension/intercept.js','utf8'),{window,chrome,document:{getElementById:id=>elements[id]},fetch:()=>Promise.reject(Error()),URL,Symbol,WeakSet,Event,crypto:webcrypto,Uint8Array,TextEncoder,location:{origin:'http://localhost'},setTimeout,clearTimeout});
 await elements.intercept.onclick();
 return {window,holds,elements,drop:()=>decision='drop'};
}
test('generic legacy and announced providers hold, forward and drop without brand checks',async()=>{
 const calls=[];const a={request:async r=>{calls.push(r);return 'ok'}};const b={request:async r=>'second'};
 const env=await setup([a]);
 assert.equal(await a.request({method:'eth_chainId'}),'ok');assert.equal(env.holds.length,0);
 assert.equal(await a.request({method:'eth_sendTransaction',params:[{value:'0x1'}]}),'ok');assert.equal(env.holds.length,1);
 env.window.dispatchEvent({type:'eip6963:announceProvider',detail:{info:{rdns:'org.anywallet'},provider:b}});
 assert.equal(await b.request({method:'personal_sign',params:['0x00']}),'second');
 env.drop();await assert.rejects(b.request({method:'personal_sign',params:[]}),e=>e.code===4001);
});
test('read-only providers are reported without preventing other wallets',async()=>{
 const frozen=Object.freeze({request:async()=>null});const normal={request:async()=>true};
 const env=await setup([frozen,normal]);assert.match(env.elements.status.textContent,/1 wallet/);assert.match(env.elements.status.textContent,/read-only/);
});

test('missing worker response is identified without blaming the engine',async()=>{const x=await setup([{request:async()=>null}],null);assert.match(x.elements.status.textContent,/background worker/);assert.match(x.elements.status.textContent,/Repair extension connection/);assert.equal(x.holds.length,0);});
