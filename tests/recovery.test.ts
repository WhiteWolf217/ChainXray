import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {controller} from '../engine/actions.ts';
test('legacy recovery checks the forwarded transaction before linking a hash',async()=>{
 const run=controller(mkdtempSync(join(tmpdir(),'cx-recovery-'))),originalFetch=globalThis.fetch;
 const hash='0x'+'a'.repeat(64),from='0x'+'1'.repeat(40),to='0x'+'2'.repeat(40);let sender='0x'+'3'.repeat(40);
 globalThis.fetch=(async(_url:any,options:any)=>{const {method}=JSON.parse(options.body);return Response.json({result:method==='eth_chainId'?'0xaa36a7':method==='eth_getTransactionByHash'?{hash,from:sender,to,value:'0x1',input:'0x'}:null});}) as any;
 try{
  await run('open',{name:'legacy'});
  const request={method:'eth_sendTransaction',params:[{from,to,value:'0x1',data:'0x'}],captureChainId:'0xaa36a7'};
  const source=await run('capture',{...request,interception:{id:'legacy-1',status:'held'}});
  await run('capture',{...request,interception:{id:'legacy-1',status:'forward'}});
  await assert.rejects(run('recover_transaction',{sourceEvidence:source.id,hash}),/does not match/);
  sender=from;const record=await run('recover_transaction',{sourceEvidence:source.id,hash});assert.equal(record.output.hash,hash);assert.equal(record.output.source,'manual-hash-rpc-verified');
 }finally{await run('close');globalThis.fetch=originalFetch;}
});
