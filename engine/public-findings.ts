import {createPublicClient,createWalletClient,ExpirationTime} from '@arkiv-network/sdk';
import {defineSchema,str} from '@arkiv-network/sdk/schema';
import {rabdi} from '@arkiv-network/sdk/chains';
import {http,isAddress} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
export const Findings=defineSchema('chainxray.findings.v1',{protocol:str().indexed(),category:str().indexed(),summary:str()});
// Deliberate allowlist: never export requests, addresses, signatures or free-form evidence.
export function publicFinding(row:any){
 if(!row) throw Error('Select evidence first');
 const swap=row.output?.uniswap;
 if(!swap) throw Error('Select a decoded Uniswap swap');
 return {protocol:'uniswap-v3',category:swap.warnings?.length?'zero-minimum-output':'swap-review',summary:swap.warnings?.length?'A decoded swap specified zero minimum output. This is an observation, not proof of exploitation.':'A Uniswap v3-compatible swap was inspected locally. Router identity is unverified.'};
}
export async function publishFinding(value:ReturnType<typeof publicFinding>){
 const key=process.env.CHAINXRAY_ARKIV_TEST_KEY;
 if(!key) throw Error('Configure CHAINXRAY_ARKIV_TEST_KEY with a funded dedicated Rabdi test account, then restart.');
 const client=createWalletClient({chain:rabdi({accessKey:process.env.ARKIV_ACCESS_KEY??''}),transport:http(undefined,{timeout:15000,retryCount:0}),account:privateKeyToAccount(key as any)});
 return client.createEntity(Findings,value,{expiration:ExpirationTime.fromDays(7)});
}
export async function queryFindings(owner:string){
 if(!isAddress(owner)) throw Error('Enter the publisher wallet address');
 const client=createPublicClient({chain:rabdi({accessKey:process.env.ARKIV_ACCESS_KEY??''}),transport:http(undefined,{timeout:15000,retryCount:0})});
 return client.select({$key:true,protocol:true,category:true,summary:true}).from(Findings).ownedBy(owner).limit(25).fetch();
}
