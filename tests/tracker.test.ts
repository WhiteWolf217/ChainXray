import test from 'node:test';
import assert from 'node:assert/strict';
import {TransactionTracker} from '../engine/tracker.ts';
const rows=[{kind:'wallet_outcome',chainId:'11155111',input:{sourceEvidence:'capture'},output:{hash:'0x'+'a'.repeat(64)}}];
test('built-in networks enable Sepolia without user-entered RPC settings',()=>{
 const tracker=new TransactionTracker(()=>[],async()=>({}));try{tracker.enableDefaults();assert.ok(tracker.status().chains.includes('11155111'));assert.equal(new URL(tracker.configs.get('11155111')!).protocol,'https:');assert.ok(!JSON.stringify(tracker.status()).includes('https://'));}finally{tracker.dispose();}
});
test('automatic tracker waits for mining, traces once and keeps RPC credentials private',async()=>{
 let pending=true;const calls:boolean[]=[];
 const tracker=new TransactionTracker(()=>rows,async(_id,_rpc,trace)=>{calls.push(trace);return {output:{status:trace?'traced':pending?'pending':'reverted'}};});
 try{tracker.configure('11155111','https://rpc.example/?key=secret');await tracker.tick();assert.deepEqual(calls,[false]);pending=false;await tracker.tick();assert.deepEqual(calls,[false,false,true]);await tracker.tick();assert.equal(calls.length,3);assert.equal(tracker.status().transactions[0].status,'reverted');assert.equal(tracker.status().transactions[0].traceStatus,'ready');assert.ok(!JSON.stringify(tracker.status()).includes('secret'));}finally{tracker.dispose();}
});
test('trace failure preserves mined result, and resetting workspace cancels follow-up tracing',async()=>{
 const tracker=new TransactionTracker(()=>rows,async(_id,_rpc,trace)=>{if(trace)throw Error('unsupported');return {output:{status:'confirmed'}};});
 try{tracker.configure('11155111','https://rpc.example');await tracker.tick();assert.equal(tracker.status().transactions[0].status,'confirmed');assert.equal(tracker.status().transactions[0].traceStatus,'unavailable');tracker.reset();assert.deepEqual(tracker.status(),{chains:[],transactions:[]});}finally{tracker.dispose();}
 let resolve:any;let calls=0;const delayed=new TransactionTracker(()=>rows,()=>{calls++;return new Promise(r=>resolve=r);});
 try{delayed.configure('11155111','https://rpc.example');const task=delayed.tick();delayed.reset();resolve({output:{status:'confirmed'}});await task;assert.equal(calls,1);assert.equal(delayed.status().transactions.length,0);}finally{delayed.dispose();}
});
test('pending tracking stops at the bounded check limit',async()=>{
 const tracker=new TransactionTracker(()=>rows,async()=>({output:{status:'pending'}}));
 try{tracker.configure('11155111','https://rpc.example');for(let i=0;i<65;i++)await tracker.tick();assert.equal(tracker.status().transactions[0].attempts,60);assert.equal(tracker.status().transactions[0].status,'paused');}finally{tracker.dispose();}
});
