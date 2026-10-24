/* Amoy fee policy: a 30 Gwei tip floor clears nodes requiring at least 25. */
(function(root){
  function amoyFees(feeData,baseFee){
    const floor=30_000_000_000n;
    const maxPriorityFeePerGas=feeData.maxPriorityFeePerGas>floor?feeData.maxPriorityFeePerGas:floor;
    const bufferedBase=(baseFee??0n)*2n+maxPriorityFeePerGas;
    const suggested=feeData.maxFeePerGas??feeData.gasPrice??0n;
    return {maxPriorityFeePerGas,maxFeePerGas:suggested>bufferedBase?suggested:bufferedBase};
  }
  if(typeof module==='object'&&module.exports)module.exports=amoyFees;
  else root.recycleProofAmoyFees=amoyFees;
})(typeof window==='object'?window:globalThis);
