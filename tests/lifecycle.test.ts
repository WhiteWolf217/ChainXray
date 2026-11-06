import test from 'node:test';
import assert from 'node:assert/strict';
import {readLifecycle,walletOutcome} from '../engine/lifecycle.ts';
import {publicFinding} from '../engine/public-findings.ts';
const hash='0x'+'a'.repeat(64);
test('wallet outcomes discard signatures and arbitrary page fields',()=>{
 const result=walletOutcome({sourceEvidence:'capture',status:'returned',hash,signature:'secret',seed:'secret'});
 assert.equal(result.hash,hash);assert.ok(!JSON.stringify(result).includes('secret'));
 const preview=publicFinding({kind:'wallet_outcome',output:{...result,secret:'hidden'}});
 assert.ok(!JSON.stringify(preview).includes(hash));assert.ok(!JSON.stringify(preview).includes('hidden'));
});
test('receipt reads check chain, preserve method timings and distinguish pending from mined',async()=>{
 const methods:string[]=[];
 const fetcher=async(_url:any,options:any)=>{const request=JSON.parse(options.body);methods.push(request.method);return Response.json({result:request.method==='eth_chainId'?'0xaa36a7':{transactionHash:hash,status:'0x0',logs:[]}});};
 const result=await readLifecycle('https://rpc.example/?key=private','11155111',hash,false,fetcher as any);
 assert.equal(result.status,'reverted');assert.deepEqual(methods,['eth_chainId','eth_getTransactionReceipt']);assert.ok(!JSON.stringify(result).includes('private'));
 await assert.rejects(readLifecycle('https://rpc.example','1',hash,false,fetcher as any),/network does not match/);
 const pending=await readLifecycle('https://rpc.example','1',hash,false,(async(_u:any,o:any)=>Response.json({result:JSON.parse(o.body).method==='eth_chainId'?'0x1':null})) as any);
 assert.equal(pending.status,'pending');
});
test('unsupported trace and unsafe endpoint produce bounded errors without credentials',async()=>{
 await assert.rejects(readLifecycle('http://example.com','1',hash),/HTTPS/);
 let count=0;await assert.rejects(readLifecycle('https://rpc.example/?key=private','1',hash,true,(async()=>Response.json(++count===1?{result:'0x1'}:{error:{message:'private'}})) as any),/does not provide/);
});
test('method-not-found reports trace support failure without exposing raw provider text',async()=>{
 let count=0;
 await assert.rejects(readLifecycle('https://rpc.example/?key=secret','1',hash,true,(async()=>Response.json(++count===1?{result:'0x1'}:{error:{code:-32601,message:'Invalid method debug_traceTransaction secret'}})) as any),(error:any)=>error.category==='unsupported'&&error.rpcCode===-32601&&error.message.includes('debug_traceTransaction')&&!error.message.includes('secret'));
});
