import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,readFileSync,appendFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {stageBrowserExtension} from '../engine/browser-extension.ts';
test('extension updates change worker URL and preserve pairing',()=>{
 const root=mkdtempSync(join(tmpdir(),'cx-stage-')),source=join(root,'source'),destination=join(root,'installed');
 cpSync(resolve('apps/browser-extension'),source,{recursive:true});
 const worker=()=>JSON.parse(readFileSync(join(destination,'manifest.json'),'utf8')).background.service_worker;
 stageBrowserExtension(source,destination,'first');const original=worker();
 stageBrowserExtension(source,destination,'second');assert.equal(worker(),original);
 assert.equal(JSON.parse(readFileSync(join(destination,'pair.json'),'utf8')).pair,'second');
 appendFileSync(join(source,'activation.js'),'\n// updated activation\n');
 stageBrowserExtension(source,destination,'third');assert.notEqual(worker(),original);
 const code=readFileSync(join(destination,worker()),'utf8');
 assert.match(code,/importScripts\('activation-[a-f0-9]+\.js'\)/);
});
