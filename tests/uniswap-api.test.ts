import {test} from 'node:test';
import assert from 'node:assert/strict';
import {quoteInput,configureUniswapApi,requestUniswapQuote} from '../engine/uniswap-api.ts';
const a='0x1111111111111111111111111111111111111111',b='0x2222222222222222222222222222222222222222';
const input={chainId:1,tokenIn:a,tokenOut:b,swapper:a,amount:'1000000'};
test('quote input validates raw amounts and only sends allowlisted fields',()=>{
 assert.deepEqual(quoteInput({...input,key:'secret',url:'http://attacker'}).protocols,['V3']);
 assert.equal('key' in quoteInput({...input,key:'secret'}),false);
 for(const amount of ['0','-1','1.1','1e18'])assert.throws(()=>quoteInput({...input,amount}));
 assert.throws(()=>quoteInput({...input,swapper:'bad'}));
 assert.throws(()=>quoteInput({...input,slippageTolerance:0.555}));
});
test('live transport uses fixed endpoint, keeps key out of evidence, and handles rejection',async()=>{
 configureUniswapApi('test-secret');
 const response=await requestUniswapQuote(input,async(url,options)=>{
  assert.equal(url,'https://trade-api.gateway.uniswap.org/v1/quote');
  assert.equal((options!.headers as any)['x-api-key'],'test-secret');
  assert.equal(options!.redirect,'error');
  return new Response(JSON.stringify({routing:'CLASSIC',quote:{output:{amount:'123'}}}));
 });
 assert.ok(!JSON.stringify(response).includes('test-secret'));
 await assert.rejects(requestUniswapQuote(input,async()=>new Response('secret',{status:401})),/rejected the API key/);
 await assert.rejects(requestUniswapQuote(input,async()=>{throw Error('secret');}),/could not be reached/);
 await assert.rejects(requestUniswapQuote(input,async()=>new Response('{}')),/classic Uniswap quote/);
 configureUniswapApi('');
});
