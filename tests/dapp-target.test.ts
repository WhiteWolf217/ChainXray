import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dappTarget} from '../engine/dapp-target.ts';
test('external browser target accepts HTTPS and rejects privileged schemes and credentials',()=>{
 assert.equal(dappTarget('https://app.uniswap.org/'),'https://app.uniswap.org/');
 for(const url of ['file:///C:/secret','javascript:alert(1)','--load-extension=abc','https://user:pass@example.org/','http://example.org',null])assert.throws(()=>dappTarget(url));
});
