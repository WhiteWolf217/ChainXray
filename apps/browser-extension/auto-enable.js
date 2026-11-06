chrome.runtime.sendMessage({kind:'cx-auto-enable'}).then(result=>{
 if(result?.status!=='ready')chrome.storage.session.set({['tab-error-'+location.origin]:result?.error??'Automatic interception unavailable'});
}).catch(error=>chrome.storage.session.set({['tab-error-'+location.origin]:'Activation failed: '+String(error)}));
