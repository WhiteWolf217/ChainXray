import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicFinding,queryFindings,configureArkiv,arkivStatus,arkivQueryError,checkArkivConnection,publishFinding} from '../engine/public-findings.ts';
test('desktop Arkiv settings return status and address without exposing credentials',()=>{
 const key='0x'+'01'.repeat(32);
 const state=configureArkiv({testKey:key,accessKey:'private-access-token'});
 assert.equal(state.configured,true);
 assert.match(state.publisher!,/^0x[0-9a-f]{40}$/i);
 assert.ok(!JSON.stringify(state).includes(key));
 assert.ok(!JSON.stringify(arkivStatus()).includes('private-access-token'));
 assert.throws(()=>configureArkiv({testKey:'invalid',accessKey:''}),/valid dedicated/);
 assert.equal(arkivStatus().publisher,state.publisher);
 configureArkiv({clear:true});
});
test('public preview excludes private evidence even when nested values contain secrets',()=>{
 const result=publicFinding({input:{origin:'https://private.example',signature:'SECRET',params:[{from:'PRIVATE'}]},output:{uniswap:{parameters:{recipient:'PRIVATE'},warnings:['SECRET']}}});
 assert.deepEqual(Object.keys(result),['protocol','category','summary']);
 assert.ok(!JSON.stringify(result).includes('SECRET'));
 assert.ok(!JSON.stringify(result).includes('PRIVATE'));
 assert.throws(()=>publicFinding({output:{}}));
});
test('invalid publisher is rejected before any network call',async()=>{await assert.rejects(queryFindings('invalid'),/publisher wallet/);});
test('Arkiv read errors expose a diagnosis without leaking credential-bearing URLs',()=>{
 const inner={status:401,message:'https://private.example/SECRET'};
 assert.match(arkivQueryError({cause:inner}).message,/rejected access/);
 assert.ok(!arkivQueryError({cause:inner}).message.includes('SECRET'));
 assert.match(arkivQueryError({status:429}).message,/rate limit/);
 assert.match(arkivQueryError({name:'TimeoutError'}).message,/timed out/);
});

test('MetaMask key format is normalized and partial updates preserve the other credential',()=>{
 try{
  const state=configureArkiv({testKey:'  '+'01'.repeat(32)+'  ',accessKey:'first-token'});
  assert.equal(state.configured,true);
  assert.equal(configureArkiv({testKey:'',accessKey:'second-token'}).publisher,state.publisher);
  assert.equal(configureArkiv({testKey:'02'.repeat(32),accessKey:''}).accessKeyConfigured,true);
  for(const accessKey of ['ark_live_abc…xyz','ark_live_abc...xyz','https://rpc.example/key','curl --json secret']){
   assert.throws(()=>configureArkiv({testKey:'',accessKey}),/full Arkiv access key/);
  }
  assert.equal(arkivStatus().configured,true);
 }finally{configureArkiv({clear:true});}
});

test('read connection checks Rabdi query and publisher balance without signing',async()=>{
 configureArkiv({testKey:'01'.repeat(32),accessKey:'test-access-token'});
 const calls:string[]=[];
 const fetchFn=async(url:any,options:any)=>{
  assert.ok(String(url).endsWith('/test-access-token'));
  const body=JSON.parse(options.body);calls.push(body.method);
  assert.ok(!body.method.includes('send'));
  const result=body.method==='eth_chainId'?'0x76edaf':body.method==='eth_getBalance'?'0x8ac7230489e80000':{data:[],blockNumber:'0x1'};
  return new Response(JSON.stringify({jsonrpc:'2.0',id:body.id,result}));
 };
 try{
  const result=await checkArkivConnection(fetchFn);
  assert.equal(result.chainId,7794095);
  assert.equal(result.balance,'10');
  assert.equal(result.readable,true);
  assert.equal(calls.length,3);
  assert.ok(!JSON.stringify(result).includes('test-access-token'));
 }finally{configureArkiv({clear:true});}
});

test('publisher preflight rejects empty accounts before signing and errors remain safe',async()=>{
 configureArkiv({testKey:'01'.repeat(32),accessKey:'test-token'});
 const calls:string[]=[];
 try{
  await assert.rejects(publishFinding({protocol:'ethereum',category:'debug-lifecycle',summary:'Test'},async(_url,options)=>{
   const body=JSON.parse(options!.body as string);calls.push(body.method);
   return new Response(JSON.stringify({jsonrpc:'2.0',id:body.id,result:body.method==='eth_chainId'?'0x76edaf':'0x0'}));
  }),/needs test GLM/);
  assert.deepEqual(calls,['eth_chainId','eth_getBalance']);
  assert.match(arkivQueryError({cause:{name:'InsufficientFundsError',message:'SECRET'}},'publish').message,/needs test GLM/);
  assert.match(arkivQueryError({name:'TimeoutError'},'publish').message,/before retrying/);
  assert.ok(!arkivQueryError({cause:{message:'SECRET'}},'publish').message.includes('SECRET'));
 }finally{configureArkiv({clear:true});}
});

test('Arkiv query trims public addresses and maps rejected access without leaking keys',async()=>{
 configureArkiv({testKey:'',accessKey:'test-query-token'});
 try{
  const page=await queryFindings('  0x1111111111111111111111111111111111111111  ',async(_url,options)=>{
   const body=JSON.parse(options!.body as string);
   assert.equal(body.method,'arkiv_query');
   return new Response(JSON.stringify({jsonrpc:'2.0',id:body.id,result:{data:[],blockNumber:'0x10'}}));
  });
  assert.equal(page.entities.length,0);
  assert.equal(page.blockNumber,16n);
  await assert.rejects(queryFindings('0x1111111111111111111111111111111111111111',async()=>new Response('SECRET',{status:403})),error=>{
   assert.match((error as Error).message,/rejected access/);
   assert.ok(!(error as Error).message.includes('SECRET'));
   assert.ok(!(error as Error).message.includes('test-query-token'));
   return true;
  });
 }finally{configureArkiv({clear:true});}
});
