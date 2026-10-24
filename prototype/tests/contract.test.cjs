const {test}=require('node:test'),assert=require('node:assert/strict'),ganache=require('ganache');
const {BrowserProvider,ContractFactory,id,ZeroHash,ZeroAddress}=require('ethers');
const artifact=require('../dist/contract.json');
test('registry enforces unique IDs, nominated recycler, immutable receipt and evidence commitments',async()=>{
  const rpc=ganache.provider({logging:{quiet:true},chain:{chainId:80002,hardfork:'merge'}});
  try {
    const provider=new BrowserProvider(rpc),collector=await provider.getSigner(0),recycler=await provider.getSigner(1),outsider=await provider.getSigner(2);
    const c=await new ContractFactory(artifact.abi,artifact.bytecode,collector).deploy();await c.waitForDeployment();
    assert.equal(await provider.getCode(await c.getAddress()),artifact.runtime);
    const batch=id('demo-batch'),evidence=id('collection'),receipt=id('receipt');
    await assert.rejects(c.register(batch,ZeroAddress,1000,evidence));
    await assert.rejects(c.register(batch,await collector.getAddress(),1000,evidence));
    await assert.rejects(c.register(batch,await recycler.getAddress(),0,evidence));
    await assert.rejects(c.register(batch,await recycler.getAddress(),1000,ZeroHash));
    await (await c.register(batch,await recycler.getAddress(),12500,evidence)).wait();
    let stored=await c.batches(batch);assert.equal(stored.grams,12500n);assert.equal(stored.collectionHash,evidence);assert.equal(stored.received,false);
    await assert.rejects(c.register(batch,await recycler.getAddress(),1,evidence));
    await assert.rejects(c.connect(outsider).confirmReceipt(batch,receipt));
    await assert.rejects(c.confirmReceipt(batch,receipt));
    await assert.rejects(c.connect(recycler).confirmReceipt(id('unknown'),receipt));
    await assert.rejects(c.connect(recycler).confirmReceipt(batch,ZeroHash));
    await (await c.connect(recycler).confirmReceipt(batch,receipt)).wait();
    stored=await c.batches(batch);assert.equal(stored.received,true);assert.equal(stored.receiptHash,receipt);
    await assert.rejects(c.connect(recycler).confirmReceipt(batch,id('changed')));
    assert.equal((await c.queryFilter(c.filters.Registered())).length,1);
    assert.equal((await c.queryFilter(c.filters.Received())).length,1);
  } finally {await rpc.disconnect()}
});
