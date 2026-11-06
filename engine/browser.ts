import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {stageBrowserExtension} from './browser-extension.ts';
function find(root: string, name: string): string | undefined {
  if (!existsSync(root)) return;
  for (const item of readdirSync(root, {withFileTypes:true})) {
    const path=join(root,item.name);
    if(item.isFile() && item.name===name) return path;
    if(item.isDirectory()) { const result=find(path,name); if(result) return result; }
  }
}
export async function openBrowser(pair: string, dappUrl: string) {
  const chrome=find(resolve('runtime/browsers'),'chrome.exe');
  const walletManifest=find(resolve('runtime/metamask'),'manifest.json');
  if(!chrome) throw Error('Bundled Chromium is missing. Rebuild the desktop browser package.');
  const home=resolve(process.env.CHAINXRAY_HOME ?? '.chainxray');
  const extension=join(home,'browser-extension');
  stageBrowserExtension(resolve('apps/browser-extension'),extension,pair);
  const wallet=walletManifest?.slice(0,-'manifest.json'.length);
  const extensions=[extension,...(wallet?[wallet]:[])].join(',');
  const child=spawn(chrome,[`--user-data-dir=${join(home,'browser-profile')}`,`--load-extension=${extensions}`,'--no-first-run','--no-default-browser-check',dappUrl],{stdio:'ignore'});
  await new Promise<void>((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
  child.unref();
  return {opened:true};
}
