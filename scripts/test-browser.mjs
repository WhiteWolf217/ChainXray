import {chromium} from 'playwright-core';
import {resolve} from 'node:path';
import {mkdirSync} from 'node:fs';
const extensions=[resolve('runtime/metamask'),resolve('apps/browser-extension')];
mkdirSync('.browser-smoke',{recursive:true});
const context=await chromium.launchPersistentContext(resolve('.browser-smoke'),{executablePath:resolve('runtime/browsers/chromium-1248/chrome-win64/chrome.exe'),headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${extensions.join(',')}`,`--load-extension=${extensions.join(',')}`]});
try {
 await context.waitForEvent('serviceworker',{timeout:30000}).catch(()=>{});
 const page=await context.newPage();await page.goto('chrome://extensions');
 const names=await page.locator('extensions-item').evaluateAll(items=>items.map(x=>x.shadowRoot?.querySelector('#name')?.textContent?.trim()));
 console.log(JSON.stringify(names));
 if(!names.some(n=>n?.includes('MetaMask')) || !names.some(n=>n?.includes('ChainXray')))throw Error('Both extensions must load');
}finally{await context.close();}
