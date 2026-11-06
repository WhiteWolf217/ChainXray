import {cpSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

// Chrome can retain an unpacked extension's old service-worker script across restarts.
// Give changed worker code (including its imported activation code) a new URL.
export function stageBrowserExtension(source:string,destination:string,pair:string){
 mkdirSync(destination,{recursive:true});
 cpSync(source,destination,{recursive:true});
 const activation=readFileSync(join(source,'activation.js'),'utf8');
 const background=readFileSync(join(source,'background.js'),'utf8');
 const sdk=readFileSync(join(source,'sdk-activation.js'),'utf8');
 const digest=createHash('sha256').update(activation).update(background).update(sdk).digest('hex').slice(0,16);
 const activationName=`activation-${digest}.js`,workerName=`background-${digest}.js`;
 writeFileSync(join(destination,activationName),activation);
 const sdkName=`sdk-activation-${digest}.js`;writeFileSync(join(destination,sdkName),sdk);
 writeFileSync(join(destination,workerName),background.replace("importScripts('activation.js')",`importScripts('${activationName}')`).replace("importScripts('sdk-activation.js')",`importScripts('${sdkName}')`));
 const manifest=JSON.parse(readFileSync(join(source,'manifest.json'),'utf8'));
 manifest.background.service_worker=workerName;
 writeFileSync(join(destination,'manifest.json'),JSON.stringify(manifest,null,2));
 writeFileSync(join(destination,'pair.json'),JSON.stringify({pair}));
}
