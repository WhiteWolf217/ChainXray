import test from 'node:test';
import assert from 'node:assert/strict';
import { InterceptQueue } from '../engine/intercept.ts';
test('requests stay held until explicit resolution; edited requests forward once',()=>{
 const q=new InterceptQueue(); const {id}=q.add({method:'eth_sendTransaction',params:[{value:'0x1'}]},'http://localhost:3000');
 assert.equal(q.poll(id).status,'held');
 q.decide(id,'forward',{method:'eth_sendTransaction',params:[{value:'0x2'}]});
 assert.equal(q.poll(id).request.params[0].value,'0x2');
 assert.equal(q.poll(id).status,'drop');
});
test('expiry, clearing, drop and signed payload protection',()=>{
 const q=new InterceptQueue();const {id}=q.add({method:'eth_sendRawTransaction',params:['0x01']},'local');
 assert.throws(()=>q.decide(id,'forward',{method:'eth_sendRawTransaction',params:['0x02']}),/cannot be edited/);
 q.decide(id,'drop');assert.equal(q.poll(id).status,'drop');
 const next=q.add({method:'personal_sign',params:[]},'local');q.rows.get(next.id).created=0;
 assert.equal(q.poll(next.id).status,'drop');q.clear();assert.equal(q.list().length,0);
});
