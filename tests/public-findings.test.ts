import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicFinding,queryFindings,configureArkiv,arkivStatus} from '../engine/public-findings.ts';
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
