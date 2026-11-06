// UI contract check with mocked API responses; no wallet or live quote is used.
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
const executablePath = [join('runtime','browsers','chromium-1248','chrome-win64','chrome.exe'), ...[process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean).map(p => join(p,'Microsoft','Edge','Application','msedge.exe'))].find(existsSync);
assert.ok(executablePath, 'Install the bundled browser or Edge first');
const server = await preview({preview:{host:'127.0.0.1',port:0}});
let browser;
try {
  browser = await chromium.launch({executablePath,headless:true});
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const wallet='0x'+'1'.repeat(40), target='0x'+'2'.repeat(40);
  let configured=false, submitted;
  const rows=[{id:'capture-123',kind:'capture',time:'2026-11-06',input:{origin:'https://app.uniswap.org',method:'eth_sendTransaction',params:[{from:wallet,to:target,data:'0xd0e30db0',value:'0x1'}],interception:{status:'drop'}},output:{functionName:'deposit'}}];
  await page.route('**/api',async route=>{
    const {action,payload}=route.request().postDataJSON();
    let response={};
    if(action==='state')response={workspace:'ui-check',workspaces:['ui-check'],rows,lab:{}};
    else if(action==='uniswap_status')response={configured};
    else if(action==='tracking_status')response={chains:[],transactions:[]};
    else if(action==='uniswap_configure'){configured=true;response={configured};}
    else if(action==='uniswap_quote'){submitted=payload;response={id:'quote-1',input:payload,output:{receivedAt:'now',response:{routing:'CLASSIC',quote:{}},note:'Mock UI quote'}};}
    else if(action==='arkiv_status')response={configured:true,publisher:wallet,accessKeyConfigured:true};
    else if(action==='arkiv_check')response={chainId:7794095,publisher:wallet,balance:'10',readable:true};
    else throw Error('Unexpected API action: '+action);
    await route.fulfill({json:response});
  });
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('heading',{name:'Start a debugging session'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'AI Investigator',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Local lab',exact:true}).isVisible(),false);
  await page.getByRole('button',{name:'Request Flow',exact:true}).click();
  await page.getByRole('button',{name:/4. Destination/}).click();
  await page.getByText(/Requested function: deposit/).waitFor();
  await page.getByText('Dropped: this request was rejected before wallet approval.').waitFor();
  rows[0].input.interception={id:'held-1',status:'held',hook:'metamask-sdk'};
  rows[0].chainId='11155111';
  rows.push({id:'outcome-1',kind:'wallet_outcome',time:'2026-11-06T01:00:00Z',input:{sourceEvidence:'capture-123'},output:{status:'returned',hash:'0x'+'a'.repeat(64)}},
    {id:'receipt-1',kind:'receipt_read',time:'2026-11-06T01:00:01Z',input:{sourceEvidence:'capture-123'},output:{status:'reverted',receipt:{blockNumber:'0x10',gasUsed:'0x5208',logs:[]}}},
    {id:'trace-1',kind:'trace_read',time:'2026-11-06T01:00:02Z',input:{sourceEvidence:'capture-123'},output:{status:'traced',trace:{type:'CALL',to:target,error:'execution reverted',decoded:{functionName:'swap'},decodedError:{errorName:'InsufficientOutput',args:['100','90']},calls:[]}}});
  await page.getByText('Transaction reverted',{exact:true}).waitFor();
  await page.getByText('InsufficientOutput',{exact:true}).waitFor();
  assert.equal(await page.locator('.call-failed').count(),1);
  await page.getByRole('heading',{name:'Contract execution flow'}).waitFor();
  if(process.env.CHAINXRAY_UI_SCREENSHOT){await page.getByRole('heading',{name:'Request Flow',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:process.env.CHAINXRAY_UI_SCREENSHOT});}
  await page.getByRole('button',{name:'Uniswap API',exact:true}).click();
  await page.getByLabel('Uniswap API key',{exact:true}).fill('ui-test-only');
  await page.getByRole('button',{name:'Connect API',exact:true}).click();
  await page.getByText('1. API connection · Connected',{exact:true}).waitFor();
  await page.getByText('Amount calculator · convert token amounts to raw units',{exact:true}).click();
  await page.getByLabel('Token amount',{exact:true}).fill('0.001');
  await page.getByRole('button',{name:'Use converted amount'}).click();
  assert.equal(await page.getByLabel('Sell amount (raw token units)',{exact:true}).inputValue(),'1000000000000000');
  await page.getByLabel('Sell token contract',{exact:true}).fill(wallet);
  await page.getByLabel('Buy token contract',{exact:true}).fill(target);
  await page.getByLabel('Wallet address',{exact:true}).fill(wallet);
  await page.getByRole('button',{name:'Fetch and save quote'}).click();
  await page.getByRole('heading',{name:'3. Quote saved'}).waitFor();
  assert.equal(submitted.amount,'1000000000000000');
  assert.equal(submitted.swapper,wallet);
  await page.getByRole('button',{name:'Share findings',exact:true}).click();
  await page.getByText('Arkiv connection',{exact:true}).click();
  await page.getByRole('button',{name:'Test connection',exact:true}).click();
  await page.getByText('Rabdi reads verified',{exact:true}).waitFor();
  await page.getByText('Reads verified',{exact:true}).waitFor();
  if(process.env.CHAINXRAY_ARKIV_SCREENSHOT)await page.locator('.arkiv-connection').screenshot({path:process.env.CHAINXRAY_ARKIV_SCREENSHOT});
  assert.deepEqual(errors,[]);
  console.log('Workflow UI passed: guided start, navigation, flow inspection, API quote and Arkiv connection diagnostics.');
} finally {
  await browser?.close();
  await new Promise(resolve=>server.httpServer.close(resolve));
}
