import {createPublicClient,createWalletClient,ExpirationTime} from '@arkiv-network/sdk';
import {defineSchema,str} from '@arkiv-network/sdk/schema';
import {rabdi} from '@arkiv-network/sdk/chains';
import {http,isAddress} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
let sessionTestKey='',sessionAccessKey='';
const testKey=()=>sessionTestKey||process.env.CHAINXRAY_ARKIV_TEST_KEY;
const accessKey=()=>sessionAccessKey||process.env.ARKIV_ACCESS_KEY||'';
export function arkivStatus(){
 const key=testKey();
 let publisher:string|null=null;
 if(key){try{publisher=privateKeyToAccount(key as any).address;}catch{}}
 return {configured:Boolean(publisher),publisher,accessKeyConfigured:Boolean(accessKey()),chainId:7794095};
}
export function configureArkiv(value:unknown){
 const p=value as any;
 if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Expected Arkiv settings');
 if(p.clear===true){sessionTestKey='';sessionAccessKey='';return arkivStatus();}
 const key=p.testKey,access=p.accessKey;
 if(typeof key!=='string'||typeof access!=='string'||access.length>512||/[\r\n]/.test(access))throw Error('Invalid Arkiv settings');
 if(key){try{if(!/^0x[0-9a-f]{64}$/i.test(key))throw Error();privateKeyToAccount(key as any);}catch{throw Error('Enter a valid dedicated Rabdi test private key');}}
 sessionTestKey=key;sessionAccessKey=access.trim();
 return arkivStatus();
}
export const Findings=defineSchema('chainxray.findings.v1',{protocol:str().indexed(),category:str().indexed(),summary:str()});
// Deliberate allowlist: never export requests, addresses, signatures or free-form evidence.
export function publicFinding(row:any){
 if(!row) throw Error('Select evidence first');
 const swap=row.output?.uniswap;
 if(!swap) throw Error('Select a decoded Uniswap swap');
 return {protocol:'uniswap-v3',category:swap.warnings?.length?'zero-minimum-output':'swap-review',summary:swap.warnings?.length?'A decoded swap specified zero minimum output. This is an observation, not proof of exploitation.':'A Uniswap v3-compatible swap was inspected locally. Router identity is unverified.'};
}
export async function publishFinding(value:ReturnType<typeof publicFinding>){
 const key=testKey();
 if(!key) throw Error('Configure a funded dedicated Rabdi test account in Shared Findings.');
 const client=createWalletClient({chain:rabdi({accessKey:accessKey()}),transport:http(undefined,{timeout:15000,retryCount:0}),account:privateKeyToAccount(key as any)});
 return client.createEntity(Findings,value,{expiration:ExpirationTime.fromDays(7)}).catch(()=>{throw Error('Arkiv publication failed. Check access key, test-account funds and connectivity. A timeout may occur after submission; query the publisher before retrying.');});
}
export async function queryFindings(owner:string){
 if(!isAddress(owner)) throw Error('Enter the publisher wallet address');
 const client=createPublicClient({chain:rabdi({accessKey:accessKey()}),transport:http(undefined,{timeout:15000,retryCount:0})});
 return client.select({$key:true,protocol:true,category:true,summary:true}).from(Findings).ownedBy(owner).limit(25).fetch().catch(()=>{throw Error('Arkiv query failed. Check access key and connectivity.');});
}
