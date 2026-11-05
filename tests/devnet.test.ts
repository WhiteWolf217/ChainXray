import test from 'node:test';
import assert from 'node:assert/strict';
import {toRlp} from 'viem';
import {submit} from '../engine/devnet.ts';
test('devnet submission requires human confirmation, matching chains and a node response',async(t)=>{
 process.env.CHAINXRAY_DEVNET_CHAIN='31337';
 process.env.CHAINXRAY_DEVNET_RPC='http://127.0.0.1:1';
 const addr='0x1111111111111111111111111111111111111111';
 const raw='0x06'+toRlp(['0x7a69','0x',addr,[['0x01','0x',addr,['0x10','0x'],'0x','0x']],[],['0x','0x'],[]]).slice(2);
 const calls:string[]=[];
 t.mock.method(globalThis,'fetch',async(_,options)=>{
   const {method}=JSON.parse(options.body);calls.push(method);
   return Response.json(method==='eth_chainId'?{result:'0x7a69'}:{error:{code:-32000,message:'nonce consumed'}});
 });
 try{
 await assert.rejects(submit({raw}),/confirmation/);
 assert.deepEqual(calls,[]);
 const outcome=await submit({raw,confirmation:'SUBMIT 31337'});
 assert.equal(outcome.admitted,false);
 assert.deepEqual(calls,['eth_chainId','eth_sendRawTransaction']);
 }finally{delete process.env.CHAINXRAY_DEVNET_CHAIN;delete process.env.CHAINXRAY_DEVNET_RPC;}
});
