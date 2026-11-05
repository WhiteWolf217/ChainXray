export function dappTarget(input:unknown){
 if(typeof input!=='string'||input.length>2048)throw Error('Enter an HTTPS dapp URL');
 let url:URL;try{url=new URL(input);}catch{throw Error('Enter a full HTTPS dapp URL');}
 if(url.protocol!=='https:'||url.username||url.password)throw Error('Live dapps must use HTTPS without embedded credentials');
 return url.href;
}
