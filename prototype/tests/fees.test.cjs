const {test}=require('node:test'),assert=require('node:assert/strict'),fees=require('../dist/fees.js');
const g=n=>BigInt(n)*1_000_000_000n;
test('raises reported 1.5 Gwei tip above the 25 Gwei RPC minimum',()=>{
  assert.deepEqual(fees({maxPriorityFeePerGas:1_500_000_000n,maxFeePerGas:g(3)},g(2)),{maxPriorityFeePerGas:g(30),maxFeePerGas:g(34)});
});
test('preserves higher live tips and max fees',()=>{
  assert.deepEqual(fees({maxPriorityFeePerGas:g(45),maxFeePerGas:g(200)},g(10)),{maxPriorityFeePerGas:g(45),maxFeePerGas:g(200)});
});
test('handles legacy fee suggestions and rising base fees',()=>{
  assert.deepEqual(fees({maxPriorityFeePerGas:null,maxFeePerGas:null,gasPrice:g(40)},g(100)),{maxPriorityFeePerGas:g(30),maxFeePerGas:g(230)});
  assert.deepEqual(fees({},null),{maxPriorityFeePerGas:g(30),maxFeePerGas:g(30)});
});
