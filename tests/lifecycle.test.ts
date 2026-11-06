import test from 'node:test';
import assert from 'node:assert/strict';
import {readLifecycle,walletOutcome,traceTransactionTree} from '../engine/lifecycle.ts';
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
test('both trace methods missing reports trace support failure without exposing raw provider text',async()=>{
 let count=0;
 await assert.rejects(readLifecycle('https://rpc.example/?key=secret','1',hash,true,(async()=>Response.json(++count===1?{result:'0x1'}:{error:{code:-32601,message:'Invalid method secret'}})) as any),(error:any)=>error.category==='unsupported'&&error.rpcCode===-32601&&error.method==='trace_transaction'&&!error.message.includes('secret'));
});

const flatCall=(path:number[],extra:any={})=>({type:'call',traceAddress:path,transactionHash:hash,action:{callType:'call',from:'0x01',to:'0x02',input:'0x12345678',value:'0x0',gas:'0x100'},result:{gasUsed:'0x10',output:'0x'},...extra});
test('Erigon trace fallback preserves nested calls, revert output, creation and selfdestruct',async()=>{
 const methods:string[]=[];
 const entries=[flatCall([1]),flatCall([0,0],{type:'create',action:{from:'0x02',init:'0x6000',value:'0x0'},result:{address:'0x03',code:'0x6001',gasUsed:'0x20'}}),flatCall([]),flatCall([0],{error:'Reverted',result:{output:'0xdeadbeef',gasUsed:'0x30'}}),flatCall([1,0],{type:'suicide',action:{address:'0x02',refundAddress:'0x04',balance:'0x10'}})];
 const fetcher=async(_url:any,options:any)=>{const {method,params}=JSON.parse(options.body);methods.push(method);if(method==='eth_chainId')return Response.json({result:'0xaa36a7'});if(method==='debug_traceTransaction')return Response.json({error:{code:-32601,message:'unavailable'}});assert.deepEqual(params,[hash]);return Response.json({result:entries});};
 const result=await readLifecycle('https://rpc.example','11155111',hash,true,fetcher as any);
 assert.equal(result.status,'traced');assert.equal(result.source,'rpc-trace_transaction');
 assert.deepEqual(methods,['eth_chainId','debug_traceTransaction','trace_transaction']);
 assert.deepEqual(result.calls.map(c=>c.method),methods);
 assert.equal(result.trace.calls[0].error,'Reverted');assert.equal(result.trace.calls[0].output,'0xdeadbeef');
 assert.equal(result.trace.calls[0].calls[0].type,'CREATE');assert.equal(result.trace.calls[0].calls[0].to,'0x03');
 assert.equal(result.trace.calls[1].calls[0].type,'SELFDESTRUCT');assert.equal(result.trace.calls[1].calls[0].value,'0x10');
});
test('Geth tracing remains supported and rate limits do not trigger alternate trace calls',async()=>{
 for(const limited of [false,true]){
  const methods:string[]=[];
  const task=readLifecycle('https://rpc.example','1',hash,true,(async(_url:any,options:any)=>{const {method}=JSON.parse(options.body);methods.push(method);return Response.json(method==='eth_chainId'?{result:'0x1'}:limited?{error:{code:-32005,message:'secret'}}:{result:{type:'CALL',calls:[]}});}) as any);
  if(limited)await assert.rejects(task,(error:any)=>error.category==='rate-limit');else assert.equal((await task).source,'rpc-callTracer');
  assert.deepEqual(methods,['eth_chainId','debug_traceTransaction']);
 }
});
test('flat traces reject missing roots, orphaned calls, duplicate paths and incorrect transactions',()=>{
 for(const entries of [[],[flatCall([0])],[flatCall([]),flatCall([0,0])],[flatCall([]),flatCall([])],[flatCall([],{transactionHash:'0x'+'b'.repeat(64)})],[flatCall([]),flatCall([2])]]){
  assert.throws(()=>traceTransactionTree(entries,hash),/invalid or incomplete/);
 }
});
