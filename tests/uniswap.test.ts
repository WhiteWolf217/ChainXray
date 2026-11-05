import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodeFunctionData} from 'viem';
import {uniswapAbi,analyzeUniswap,mutateUniswap} from '../engine/uniswap.ts';
const a='0x1111111111111111111111111111111111111111';
const b='0x2222222222222222222222222222222222222222';
test('swap inspection and recipient mutation preserve output protection',()=>{
 const data=encodeFunctionData({abi:uniswapAbi,functionName:'exactInputSingle',args:[{tokenIn:a,tokenOut:b,fee:3000,recipient:a,deadline:2000000000n,amountIn:100n,amountOutMinimum:90n,sqrtPriceLimitX96:0n}]});
 const original=analyzeUniswap(data)!;
 assert.equal(original.parameters.amountOutMinimum,90n);
 const edited=analyzeUniswap(mutateUniswap(data,{recipient:b}))!;
 assert.equal(edited.parameters.recipient,b);
 assert.equal(edited.parameters.amountOutMinimum,90n);
 assert.equal(edited.deploymentVerified,false);
 assert.equal(analyzeUniswap(mutateUniswap(data,{amountOutMinimum:'0'}))!.warnings.length,1);
 assert.throws(()=>mutateUniswap(data,{tokenIn:b}));
 assert.equal(analyzeUniswap('0x12345678'),null);
});
