import {readFileSync,existsSync,statSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const script=readFileSync('src-tauri/target/release/nsis/x64/installer.nsi','utf8');
const root='src-tauri/resources';
for(const relative of ['node.exe','engine/server.mjs','dist/index.html','runtime/solc.exe','runtime/VC_redist.x64.exe','apps/browser-extension/popup.html','apps/browser-extension/popup.css','runtime/browsers/chromium-1248/chrome-win64/chrome.exe','runtime/metamask/manifest.json','node_modules/@foundry-rs/anvil-win32-amd64/bin/anvil.exe','node_modules/@foundry-rs/forge-win32-amd64/bin/forge.exe']){
 // Wallet distributions can put their manifest in an extracted subdirectory.
 if(relative==='runtime/metamask/manifest.json'&&!existsSync(join(root,relative))){assert.match(script,/runtime\\metamask\\[^"\n]*manifest\.json/);continue;}
 assert.ok(existsSync(join(root,relative)),`Missing staged payload: ${relative}`);
 assert.ok(script.includes(relative.replaceAll('/','\\')),`Missing installer payload: ${relative}`);
}
assert.ok(script.includes('/oname=WebView2Loader.dll'), 'Native WebView2 loader must be installed beside the application');
assert.ok(script.includes('!define INSTALLMODE "perMachine"'));
assert.ok(script.includes('MicrosoftEdgeWebview2Setup.exe'));
assert.ok(!script.includes('chromium_headless_shell-'));
assert.ok(!script.includes('/oname=resources\\runtime\\metamask.zip'));
assert.ok(!script.includes('/oname=resources\\apps\\browser-extension\\pair.json'));
const binary=readFileSync('src-tauri/target/release/chainxray.exe');
assert.equal(binary.toString('ascii',0,2),'MZ');
assert.equal(binary.readUInt16LE(binary.readUInt32LE(0x3c)+4),0x8664,'Application must be x64');
if(process.argv[2]){assert.ok(statSync(process.argv[2]).size>10_000_000);assert.equal(readFileSync(process.argv[2]).toString('ascii',0,2),'MZ');}
console.log('Installer payload verified: x64 app, WebView2 loader/bootstrapper, Node, Chromium, wallet, extension, VC runtime and local lab tools.');
