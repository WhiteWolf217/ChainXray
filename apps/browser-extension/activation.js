globalThis.activateChainXray=async function(tab,health){
    if(typeof activateChainXraySdk==='function')await activateChainXraySdk(tab,health);
    const secret=Array.from(crypto.getRandomValues(new Uint8Array(32)));
    const bridge=await chrome.scripting.executeScript({target:{tabId:tab.id}, args:[secret], func:async(secret)=>{
      if(globalThis.cxBridge) return false;
      globalThis.cxBridge=true;
      const signingKey=await crypto.subtle.importKey('raw',new Uint8Array(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
      window.addEventListener('message', async e=>{
        if(e.source!==window || e.data?.kind!=='cx-hold') return;
        const id=e.data.id;
        let result;
        try { result=await chrome.runtime.sendMessage({kind:'cx-intercept',request:e.data.request,chainId:e.data.chainId}); }
        catch { result={status:'error',error:'Extension connection lost. Repair the extension connection, reload the dapp and enable interception again.'}; }
        const body=JSON.stringify({id,result:result??{status:'error',error:'No response from the extension background worker. Repair extension connection and reload the dapp.'}});
        const mac=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',signingKey,new TextEncoder().encode(body))));
        window.postMessage({kind:'cx-result',id,body,mac},location.origin);
      });
      return true;
    }});
    if(bridge[0]?.result===false) return {alreadyEnabled:true};
    const injection = await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',args:[secret,health.expectedChainId??null],func:async(secret,expectedChainId)=>{
      const verify=crypto.subtle.verify.bind(crypto.subtle);
      const verificationKey=await crypto.subtle.importKey('raw',new Uint8Array(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
      const key=Symbol.for('chainxray.intercept');
      if(window[key]) return window[key];
      const report={connected:0,unsupported:0};
      window[key]=report;
      const wrapped=new WeakSet();
      const transport=window[Symbol.for('chainxray.metamaskTransport')];
      let metamask;
      const review=async(request,readChain)=>{
          let chainId=null;
          if(expectedChainId){chainId=await readChain();if(chainId!==expectedChainId)throw Object.assign(new Error('ChainXray Sepolia session: select Ethereum Sepolia (11155111) in your wallet.'),{code:4901});}
          const id=crypto.randomUUID();
          const result=await new Promise(resolve=>{
            const listener=async e=>{if(e.source!==window || e.data?.kind!=='cx-result' || e.data.id!==id) return;
              try {const {body,mac}=e.data;if(typeof body!=='string'||!Array.isArray(mac)||mac.length!==32)return;
                if(!await verify('HMAC',verificationKey,new Uint8Array(mac),new TextEncoder().encode(body)))return;
                const decision=JSON.parse(body);if(decision.id!==id)return;
                clearTimeout(timer);window.removeEventListener('message',listener);resolve(decision.result);
              }catch{}
            };
            const timer=setTimeout(()=>{window.removeEventListener('message',listener);resolve({status:'error',error:'Interception timed out after five minutes.'});},300000);
            window.addEventListener('message',listener);
            window.postMessage({kind:'cx-hold',id,chainId,request:{method:request.method,params:request.params??[]}},location.origin);
          });
          if(result?.status==='error')throw Object.assign(new Error(result.error),{code:-32000});
          if(result?.status!=='forward')throw Object.assign(new Error('Request dropped by ChainXray'),{code:4001});
          if(expectedChainId&&await readChain()!==expectedChainId)throw Object.assign(new Error('Wallet network changed while held. Switch to Sepolia and create a new request.'),{code:4901});
          return result.request;
      };
      if(transport)transport.handler=request=>review(request,()=>{
        if(!metamask)throw Error('MetaMask provider not discovered. Reload the dapp.');
        return metamask.original.call(metamask.provider,{method:'eth_chainId'});
      });
      const wrap=provider=>{
        if(!provider || (typeof provider!=='object' && typeof provider!=='function') || wrapped.has(provider)) return;
        const early=window[Symbol.for('chainxray.earlyProviders')]?.entries.get(provider);
        const original=early?.original??provider.request;
        if(typeof original!=='function') return;
        if(transport&&provider.isMetaMask)metamask={provider,original};
        const intercepted=async function(request){
          if(!/^(eth_sendTransaction|wallet_sendTransaction|eth_signTransaction|eth_sendRawTransaction|eth_signTypedData(?:_v[134])?|personal_sign|eth_sign|wallet_sendCalls)$/.test(request.method)) return original.call(provider,request);
          const approved=await review(request,()=>original.call(provider,{method:'eth_chainId'}));
          const cleanup=provider.isMetaMask?transport?.allow(approved):null;
          try{return await original.call(provider,approved);}finally{cleanup?.();}
        };
        try { if(early)early.handler=intercepted;else{provider.request=intercepted;if(provider.request!==intercepted)throw Error('Read-only provider');} wrapped.add(provider); report.connected++; }
        catch { report.unsupported++; }

      };
      window.addEventListener('eip6963:announceProvider',e=>{wrap(e.detail?.provider);});
      window.dispatchEvent(new Event('eip6963:requestProvider'));
      const legacy=()=>{if(Array.isArray(window.ethereum?.providers)) window.ethereum.providers.forEach(wrap);wrap(window.ethereum);};
      legacy();
      window.addEventListener('ethereum#initialized',legacy);
      return report;
    }});
return injection[0]?.result;
};
