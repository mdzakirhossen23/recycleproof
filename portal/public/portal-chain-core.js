/* Validation shared by the wallet interface and its checks. */
(function(root){
 const lower=x=>String(x).toLowerCase();
 function compare(batch,stored,ethers){
  if(lower(stored.collector)===lower(ethers.ZeroAddress))return false;
  if(lower(stored.collectionHash)!==lower('0x'+batch.collection_hash))throw Error('Collection hash differs from the portal record. Do not publish a receipt.');
  if(stored.grams!==ethers.parseUnits(String(batch.weight),3))throw Error('On-chain weight differs from the portal record.');
  return true;
 }
 function receipt(batch,stored,wallet,ethers){
  if(!compare(batch,stored,ethers))throw Error('Publish the collection first.');
  if(batch.status!=='received'||!batch.receipt_hash)throw Error('The nominated recycler must confirm receipt in the portal first.');
  if(lower(stored.recycler)!==lower(wallet))throw Error('Switch to the nominated recycler wallet: '+stored.recycler);
  if(stored.received&&lower(stored.receiptHash)!==lower('0x'+batch.receipt_hash))throw Error('On-chain receipt differs from the portal record.');
  return !stored.received;
 }
 const api={compare,receipt};if(typeof module==='object'&&module.exports)module.exports=api;else root.RP_CHAIN_CHECK=api;
})(typeof window==='object'?window:globalThis);
