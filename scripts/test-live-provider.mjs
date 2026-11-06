import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {stageBrowserExtension} from '../engine/browser-extension.ts';
const temp=mkdtempSync(join(tmpdir(),'cx-live-'));
const proc=spawn(process.execPath,['engine/server.ts','--parent-pipe'],{windowsHide:true,stdio:['pipe','pipe','inherit'],env:{...process.env,CHAINXRAY_HOME:join(temp,'workspaces')}});
let context;
try {
 const url=await new Promise(r=>createInterface({input:proc.stdout}).once('line',r));
 const api=async(action,payload={})=>{const r=await fetch(new URL('/api',url),{method:'POST',headers:{authorization:'Bearer '+new URL(url).hash.slice(1),'content-type':'application/json'},body:JSON.stringify({action,payload})});if(!r.ok)throw Error(await r.text());return r.json()};
 await api('open',{name:'live-probe'});
 const extension=join(temp,'extension');stageBrowserExtension('apps/browser-extension',extension,await api('pair'));
 context=await chromium.launchPersistentContext(join(temp,'profile'),{executablePath:resolve('runtime/browsers/chromium-1248/chrome-win64/chrome.exe'),headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--load-extension=${resolve('runtime/metamask')},${extension}`]});
 const page=await context.newPage();
 await page.goto('https://app.uniswap.org/swap',{waitUntil:'domcontentloaded'});
 for(const mode of ['request','cached-original','sendAsync']){
  const method='eth_sendTransaction';
  await page.waitForFunction(()=>window[Symbol.for('chainxray.intercept')]?.connected>0);
  await page.evaluate(({method,mode})=>{
   window.probeResult=null;
   const address='0x1111111111111111111111111111111111111111';
   const request={method,params:[{from:address,to:address,value:'0x0'}]};
   if(mode==='sendAsync')window.ethereum.sendAsync({...request,id:42,jsonrpc:'2.0'},(error,result)=>window.probeResult=error?.code??result?.error?.code??'unexpected-forward');
   else {
    const fn=mode==='cached-original'?window[Symbol.for('chainxray.earlyProviders')].entries.get(window.ethereum).original:window.ethereum.request;
    fn.call(window.ethereum,request).then(()=>window.probeResult='unexpected-forward',e=>window.probeResult=e.code);
   }
  },{method,mode});
  let held;
  for(let i=0;i<100;i++){held=(await api('intercept_list'))[0];if(held)break;await new Promise(r=>setTimeout(r,100));}
  assert.equal(held?.request.method,method);
  assert.equal(await page.evaluate(()=>window[Symbol.for('chainxray.metamaskTransport')].held),mode==='request'?0:1);
  await api('intercept_decide',{id:held.id,decision:'drop'});
  await page.waitForFunction(()=>window.probeResult===4001);
  assert.equal((await api('intercept_list')).length,0);
  console.log('PASS real MetaMask on Uniswap: automatic hold and drop via '+mode);
  await page.reload({waitUntil:'domcontentloaded'});
 }
}finally{await context?.close();proc.stdin.end();}
