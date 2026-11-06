import {sepolia,mainnet,base,arbitrum,optimism,polygon} from 'viem/chains';
import {LifecycleRpcError} from './lifecycle.ts';
export class TransactionTracker {
  configs=new Map<string,string>(); states=new Map<string,any>(); busy=false; generation=0;
  timer:ReturnType<typeof setInterval>;
  private rows:()=>any[];
  private read:(id:string,rpc:string,trace:boolean)=>Promise<any>;
  constructor(rows:()=>any[],read:(id:string,rpc:string,trace:boolean)=>Promise<any>,interval=10000){this.rows=rows;this.read=read;this.timer=setInterval(()=>void this.tick(),interval);this.timer.unref();}
  reset(){this.generation++;this.configs.clear();this.states.clear();}
  enableDefaults(){for(const chain of [sepolia,mainnet,base,arbitrum,optimism,polygon])this.configs.set(String(chain.id),chain.id===sepolia.id?'https://ethereum-sepolia-rpc.publicnode.com':chain.rpcUrls.default.http[0]);}
  dispose(){this.reset();clearInterval(this.timer);}
  configure(chain:string,rpc:string){
    if(!/^\d+$/.test(chain)||BigInt(chain)<=0n)throw Error('Choose a known chain first');
    if(!rpc){this.generation++;this.configs.delete(chain);for(const [id,s] of this.states)if(s.chain===chain)this.states.delete(id);return;}
    const url=new URL(rpc);
    if(url.username||url.password||url.hash||!(url.protocol==='https:'||(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))))throw Error('Use HTTPS RPC or a local HTTP endpoint');
    this.generation++;this.configs.set(chain,rpc);for(const [id,s] of this.states)if(s.chain===chain)this.states.delete(id);
  }
  status(){return {chains:[...this.configs.keys()],transactions:[...this.states.values()]};}
  async tick(){
    if(this.busy)return;this.busy=true;const generation=this.generation;
    try{for(const row of this.rows().filter(r=>r.kind==='wallet_outcome'&&r.output.hash)){
      if(generation!==this.generation)break;
      const id=row.input.sourceEvidence, chain=String(row.chainId),rpc=this.configs.get(chain);
      if(!rpc)continue;
      const state=this.states.get(id)??{sourceEvidence:id,chain,attempts:0,status:'waiting'};
      if(state.done)continue;
      this.states.set(id,state);state.attempts++;state.status='checking';state.error=null;
      try{
        const receipt=await this.read(id,rpc,false);if(generation!==this.generation)break;
        state.lastChecked=new Date().toISOString();state.status=receipt.output.status;
        if(state.status!=='pending'){
          state.traceStatus='loading';
          try{await this.read(id,rpc,true);if(generation!==this.generation)break;state.traceStatus='ready';}
          catch(error){state.traceStatus=error instanceof LifecycleRpcError&&error.category==='unsupported'?'unsupported':'unavailable';state.error=error instanceof LifecycleRpcError?'Receipt loaded. '+error.message:'Receipt loaded, but ChainXray could not process the contract trace.';state.traceError=error instanceof LifecycleRpcError?{method:error.method,category:error.category,code:error.rpcCode}:{category:'processing'};}
          state.done=true;
        }
      }catch(error){state.status='read-error';state.error=error instanceof LifecycleRpcError?error.message:'Could not read this transaction. Check the RPC endpoint and network.';}
      if(state.attempts>=60&&!state.done){state.done=true;state.status='paused';state.error='Tracking paused after 60 checks. Save RPC settings again to resume.';}
    }}finally{this.busy=false;}
  }
}
