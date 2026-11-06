import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
test('MetaMask transport holds before delivery, preserves RPC identity on forward and replies on drop',async()=>{
 const delivered=[];
 const window={postMessage:(...args)=>delivered.push(args),addEventListener:()=>{},dispatchEvent:()=>{}};
 runInNewContext(readFileSync('apps/browser-extension/early-provider.js','utf8'),{window,Symbol,WeakMap,Event,location:{origin:'https://app.uniswap.org'}});
 const channel=window[Symbol.for('chainxray.metamaskTransport')];
 let release;
 channel.handler=()=>new Promise(resolve=>release=resolve);
 const message={target:'metamask-contentscript',data:{name:'metamask-provider',data:{id:77,jsonrpc:'2.0',method:'eth_sendTransaction',params:[{value:'0x1'}]}}};
 window.postMessage(message,'https://app.uniswap.org');
 await Promise.resolve();assert.equal(delivered.length,0);
 release({method:'eth_sendTransaction',params:[{value:'0x2'}]});
 await new Promise(r=>setImmediate(r));
 assert.equal(delivered.length,1);assert.equal(delivered[0][0].data.data.id,77);assert.equal(delivered[0][0].data.data.params[0].value,'0x2');
 channel.handler=async()=>{throw Object.assign(Error('Dropped'),{code:4001});};
 window.postMessage(message,'https://app.uniswap.org');
 await new Promise(r=>setImmediate(r));
 assert.equal(delivered.length,2);assert.equal(delivered[1][0].target,'metamask-inpage');assert.equal(delivered[1][0].data.data.id,77);assert.equal(delivered[1][0].data.data.error.code,4001);
});
async function setup(providers,health={status:"ready"},early=false) {
 const events=new Map(), elements={pair:{value:'http://127.0.0.1:1234/#'+'a'.repeat(64)},status:{},intercept:{},repair:{}};
 const holds=[];let decision='forward', signingKey;
 const window={ethereum:{providers},addEventListener:(n,f)=>{const list=events.get(n)??[];list.push(f);events.set(n,list);},removeEventListener:(n,f)=>events.set(n,(events.get(n)??[]).filter(x=>x!==f)),dispatchEvent:e=>(events.get(e.type)??[]).forEach(f=>f(e)),postMessage:m=>{holds.push(m);queueMicrotask(async()=>{const body=JSON.stringify({id:m.id,result:{status:decision,request:m.request}});const mac=Array.from(new Uint8Array(await webcrypto.subtle.sign('HMAC',signingKey,new TextEncoder().encode(body))));window.dispatchEvent({type:'message',source:window,data:{kind:'cx-result',id:m.id,result:{status:'forward',request:{method:'eth_sign',params:[]}}}});window.dispatchEvent({type:'message',source:window,data:{kind:'cx-result',id:m.id,body,mac}});});}};
 const chrome={runtime:{getURL:x=>x,sendMessage:async()=>health},storage:{session:{set:async()=>{}}},tabs:{query:async()=>[{id:1}]},scripting:{executeScript:async spec=>{if(spec.world==='MAIN')return [{result:await spec.func(...spec.args)}];signingKey=await webcrypto.subtle.importKey('raw',new Uint8Array(spec.args[0]),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [{result:true}];}}};
 if(early)runInNewContext(readFileSync('apps/browser-extension/early-provider.js','utf8'),{window,Symbol,WeakMap,Event,setTimeout,clearTimeout});
 const cached=providers.map(p=>p.request.bind(p));
 runInNewContext(readFileSync('apps/browser-extension/activation.js','utf8')+'\n'+readFileSync('apps/browser-extension/intercept.js','utf8'),{window,chrome,document:{getElementById:id=>elements[id]},fetch:()=>Promise.reject(Error()),URL,Symbol,WeakSet,Event,crypto:webcrypto,Uint8Array,TextEncoder,location:{origin:'http://localhost'},setTimeout,clearTimeout});
 await elements.intercept.onclick();
 return {window,holds,elements,cached,drop:()=>decision='drop'};
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
test('Sepolia sessions block wrong networks and hold supported testnet requests',async()=>{
 let chain='0x1',sent=0;
 const wallet={request:async r=>r.method==='eth_chainId'?chain:(sent++,'ok')};
 const env=await setup([wallet],{status:'ready',expectedChainId:'0xaa36a7'});
 await assert.rejects(wallet.request({method:'eth_sendTransaction',params:[]}),e=>e.code===4901);
 assert.equal(env.holds.length,0);assert.equal(sent,0);
 chain='0xaa36a7';assert.equal(await wallet.request({method:'personal_sign',params:[]}), 'ok');
 assert.equal(env.holds[0].chainId,'0xaa36a7');assert.equal(sent,1);
});
test('Sepolia network change while held prevents wallet execution',async()=>{
 let reads=0,sent=0;
 const wallet={request:async r=>r.method==='eth_chainId'?(++reads===1?'0xaa36a7':'0x1'):(sent++,'ok')};
 await setup([wallet],{status:'ready',expectedChainId:'0xaa36a7'});
 await assert.rejects(wallet.request({method:'personal_sign',params:[]}),e=>e.code===4901);
 assert.equal(sent,0);
});
test('early Uniswap hook intercepts a request bound before popup activation',async()=>{
 let sent=0;
 const wallet={request:async()=>{sent++;return 'ok';}};
 const env=await setup([wallet],{status:'ready'},true);
 env.drop();
 await assert.rejects(env.cached[0]({method:'eth_sendTransaction',params:[{value:'0x1'}]}),e=>e.code===4001);
 assert.equal(sent,0);assert.equal(env.holds.length,1);
 await assert.rejects(env.cached[0]({method:'wallet_sendCalls',params:[{version:'2.0.0',calls:[]}]}),e=>e.code===4001);
 assert.equal(sent,0);assert.equal(env.holds.length,2);
});
test('MetaMask provider is held even when its native transport bypasses window.postMessage',async()=>{
 let executed=0;const wallet={isMetaMask:true,request:async()=>{executed++;return 'wallet executed';}};
 const env=await setup([wallet],{status:'ready'},true);env.drop();
 await assert.rejects(env.cached[0]({method:'eth_sendTransaction',params:[]}),e=>e.code===4001);
 assert.equal(executed,0);assert.equal(env.holds.length,1);
});
