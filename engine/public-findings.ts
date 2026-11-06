import {createPublicClient,createWalletClient,ExpirationTime} from '@arkiv-network/sdk';
import {defineSchema,str} from '@arkiv-network/sdk/schema';
import {rabdi} from '@arkiv-network/sdk/chains';
import {http,isAddress,formatEther} from 'viem';
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
 if(typeof p.testKey!=='string'||typeof p.accessKey!=='string')throw Error('Invalid Arkiv settings');
 let key=p.testKey.trim();const access=p.accessKey.trim();
 if(key&&!/^0x/i.test(key))key='0x'+key;
 if(key)key='0x'+key.slice(2);
 if(access&&(access.length>512||/\s|…|\.\.\.|[/:]/.test(access)))throw Error('Paste the full Arkiv access key using the Hub copy button, not a shortened key, RPC URL or curl command.');
 if(key){try{if(!/^0x[0-9a-f]{64}$/i.test(key))throw Error();privateKeyToAccount(key as any);}catch{throw Error('Enter a valid dedicated Rabdi test private key');}}
 // Password fields are cleared after saving; a later partial update must retain the other credential.
 if(key)sessionTestKey=key;
 if(access)sessionAccessKey=access;
 return arkivStatus();
}
export const Findings=defineSchema('chainxray.findings.v1',{protocol:str().indexed(),category:str().indexed(),summary:str()});
// Deliberate allowlist: never export requests, addresses, signatures or free-form evidence.
export function publicFinding(row:any){
 if(!row) throw Error('Select evidence first');
 if(['wallet_outcome','receipt_read','trace_read'].includes(row.kind)){
  const status=['returned','error','pending','confirmed','reverted','traced'].includes(row.output?.status)?row.output.status:'unknown';
  const hook=['metamask-sdk','injected-provider','metamask-message-channel'].includes(row.output?.hook)?row.output.hook:'unknown';
  return {protocol:'ethereum',category:'debug-lifecycle',summary:`A local debugging session using ${hook} recorded a ${status} event. Wallet responses are page observations; RPC results reflect a single provider. No raw request, signature, address or hash is included.`};
 }
 const swap=row.output?.uniswap;
 if(!swap) throw Error('Select a decoded Uniswap swap');
 return {protocol:'uniswap-v3',category:swap.warnings?.length?'zero-minimum-output':'swap-review',summary:swap.warnings?.length?'A decoded swap specified zero minimum output. This is an observation, not proof of exploitation.':'A Uniswap v3-compatible swap was inspected locally. Router identity is unverified.'};
}
export async function checkArkivConnection(fetchFn:typeof fetch=fetch){
 const client=createPublicClient({chain:rabdi({accessKey:accessKey()}),transport:http(undefined,{timeout:15000,retryCount:0,fetchFn})});
 try{
  const chainId=await client.getChainId();
  if(chainId!==7794095)throw Error('Unexpected Arkiv network');
  const publisher=arkivStatus().publisher;
  const balance=publisher?formatEther(await client.getBalance({address:publisher as `0x${string}`})):null;
  await client.select({$key:true,protocol:true,category:true,summary:true}).from(Findings).ownedBy((publisher??'0x1111111111111111111111111111111111111111') as `0x${string}`).limit(1).fetch();
  return {chainId,publisher,balance,readable:true};
 }catch(error){throw arkivQueryError(error);}
}
export async function publishFinding(value:ReturnType<typeof publicFinding>,fetchFn:typeof fetch=fetch){
 const key=testKey();
 if(!key) throw Error('Configure a funded dedicated Rabdi test account in Shared Findings.');
 try{
  const client=createWalletClient({chain:rabdi({accessKey:accessKey()}),transport:http(undefined,{timeout:15000,retryCount:0,fetchFn}),account:privateKeyToAccount(key as any)});
  if(await client.getChainId()!==7794095)throw Error('Unexpected Arkiv network');
  if(await client.getBalance({address:client.account.address})===0n)throw Error('Insufficient funds');
  return await client.createEntity(Findings,value,{expiration:ExpirationTime.fromDays(7)});
 }catch(error){throw arkivQueryError(error,'publish');}
}
export async function queryFindings(owner:string,fetchFn:typeof fetch=fetch){
 owner=owner.trim();
 if(!isAddress(owner)) throw Error('Enter the publisher wallet address');
 const client=createPublicClient({chain:rabdi({accessKey:accessKey()}),transport:http(undefined,{timeout:15000,retryCount:0,fetchFn})});
 return client.select({$key:true,protocol:true,category:true,summary:true}).from(Findings).ownedBy(owner).limit(25).fetch().catch(error=>{throw arkivQueryError(error);});
}
export function arkivQueryError(error:unknown,operation:'query'|'publish'='query'){
 const suffix=operation==='publish'?' If submission may have started, query this publisher before retrying to avoid duplicates.':'';
 const fail=(message:string)=>Error(message+suffix);
 let current:any=error;
 for(let depth=0;current&&depth<10;depth++,current=current.cause){
  const status=current.status??current.statusCode;
  if(status===401||status===403)return fail('Arkiv rejected access. Re-enter the full Rabdi access key from Arkiv Hub under Arkiv connection and click Use for this session.');
  if(status===429)return fail('Arkiv rate limit reached. Use an Arkiv Hub access key or wait before retrying.');
  if(current.code===-32601)return fail('Arkiv RPC does not support the requested method. Check SDK/network compatibility.');
  const details=[current.name,current.shortMessage,current.details,current.message].join(' ');
  if(/Unexpected Arkiv network/i.test(details))return fail('The RPC returned a different network. Expected Rabdi chain 7794095.');
  if(operation==='publish'&&/insufficient funds|InsufficientFunds/i.test(details))return fail('The configured publisher needs test GLM on Rabdi to pay publication fees. Fund the Publisher address shown in Arkiv connection.');
  if(operation==='publish'&&/reverted|ContractFunctionReverted/i.test(details))return fail('Arkiv rejected the publication during contract execution. Use Test connection, then check the publisher transaction in the Rabdi explorer.');
  if(/timeout|timed out/i.test(details))return fail('Arkiv request timed out. Wait and retry; if using public access, configure an Arkiv Hub access key.');
 }
 return fail(operation==='publish'?'Arkiv publication failed. Use Test connection to check access and publisher balance.':'Arkiv read request failed. Use Test connection to check access. You can clear session settings and query with only your public publisher address; queries require no private key.');
}
