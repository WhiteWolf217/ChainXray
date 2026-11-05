import { decodeFunctionData, encodeFunctionData, parseAbi } from 'viem';

// Uniswap v3 SwapRouter interface; matching calldata does not authenticate a deployment.
export const uniswapAbi = parseAbi([
 'function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)',
 'function exactOutputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountOut,uint256 amountInMaximum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountIn)',
 'function exactInput((bytes path,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum) params) payable returns (uint256 amountOut)',
 'function exactOutput((bytes path,address recipient,uint256 deadline,uint256 amountOut,uint256 amountInMaximum) params) payable returns (uint256 amountIn)',
]);
export function analyzeUniswap(calldata: any) {
 try {
  const decoded = decodeFunctionData({abi:uniswapAbi,data:calldata});
  const p:any = decoded.args[0];
  return {interface:'Uniswap v3 SwapRouter',deploymentVerified:false,functionName:decoded.functionName,
   parameters:p,amountUnits:'raw token units',
   warnings:[...(p.amountOutMinimum === 0n ? ['Minimum output is zero; no minimum-output protection.'] : [])],
   note:'ABI match only. Verify router address and chain independently. Recipient may intentionally differ from sender.'};
 } catch { return null; }
}
export function mutateUniswap(calldata:any, changes:any) {
 const decoded = decodeFunctionData({abi:uniswapAbi,data:calldata});
 const p:any = {...decoded.args[0]};
 for(const [key,value] of Object.entries(changes)) {
  if(!['recipient','deadline','amountOutMinimum','amountInMaximum'].includes(key) || !(key in p)) throw Error('Unsupported swap mutation: '+key);
  p[key] = key === 'recipient' ? value : BigInt(String(value));
 }
 return encodeFunctionData({abi:uniswapAbi,functionName:decoded.functionName,args:[p]} as any);
}
