import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicFinding,queryFindings} from '../engine/public-findings.ts';
test('public preview excludes private evidence even when nested values contain secrets',()=>{
 const result=publicFinding({input:{origin:'https://private.example',signature:'SECRET',params:[{from:'PRIVATE'}]},output:{uniswap:{parameters:{recipient:'PRIVATE'},warnings:['SECRET']}}});
 assert.deepEqual(Object.keys(result),['protocol','category','summary']);
 assert.ok(!JSON.stringify(result).includes('SECRET'));
 assert.ok(!JSON.stringify(result).includes('PRIVATE'));
 assert.throws(()=>publicFinding({output:{}}));
});
test('invalid publisher is rejected before any network call',async()=>{await assert.rejects(queryFindings('invalid'),/publisher wallet/);});
