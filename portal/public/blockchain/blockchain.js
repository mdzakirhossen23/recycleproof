/* Wallet keys never enter this application. All signatures stay in the wallet. */
(() => {
  const chainId=80002, chainHex='0x13882', explorer='https://amoy.polygonscan.com', storageKey='recycleproof-amoy-v1';
  const E=window.ethers, el=id=>document.getElementById(id);
  let state={address:'',transactions:[]}, provider=null, signer=null, account='',working=false,artifactPromise;
  try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved&&Array.isArray(saved.transactions))state=saved}catch{el('chainMessage').textContent='Blockchain settings could not be read.'}
  function save(){localStorage.setItem(storageKey,JSON.stringify(state))}
  function say(text){el('chainMessage').textContent=text}
  function artifact(){return artifactPromise??=fetch('contract.json').then(r=>{if(!r.ok)throw Error('Contract artifact could not be loaded.');return r.json()})}
  function message(e){if(e.code===4001||e.code==='ACTION_REJECTED')return 'Wallet request cancelled. No confirmation was recorded.';return e.reason||e.shortMessage||e.message||'Wallet request failed.'}
  async function action(fn){if(working)return;working=true;document.querySelectorAll('.chainpanel button').forEach(b=>b.disabled=true);try{await fn()}catch(e){say(message(e))}finally{working=false;document.querySelectorAll('.chainpanel button').forEach(b=>b.disabled=false);showTransactions()}}
  async function connect(){
    if(!E)throw Error('Wallet library could not load. Reload this page.');
    if(!window.ethereum)throw Error('No wallet extension found. Open this site in Chrome, Edge or Firefox with MetaMask installed, then connect again.');
    const accounts=await window.ethereum.request({method:'eth_requestAccounts'});
    if(!accounts.length)throw Error('Unlock your wallet and connect an account.');
    let current=await window.ethereum.request({method:'eth_chainId'});
    if(Number(current)!==chainId){try{await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:chainHex}]})}catch(e){if(e.code!==4902&&e.data?.originalError?.code!==4902)throw e;await window.ethereum.request({method:'wallet_addEthereumChain',params:[{chainId:chainHex,chainName:'Polygon Amoy Testnet',nativeCurrency:{name:'Test POL',symbol:'POL',decimals:18},rpcUrls:['https://polygon-amoy.drpc.org'],blockExplorerUrls:[explorer]}]});await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:chainHex}]})}}
    if(Number(await window.ethereum.request({method:'eth_chainId'}))!==chainId)throw Error('Switch to Polygon Amoy before continuing.');
    provider=new E.BrowserProvider(window.ethereum);signer=await provider.getSigner();account=await signer.getAddress();
    el('chainBadge').textContent='AMOY CONNECTED';el('walletInfo').textContent='Connected: '+account+' · Test POL: '+E.formatEther(await provider.getBalance(account));
  }
  async function requireWallet(){await connect();if(Number((await provider.getNetwork()).chainId)!==chainId)throw Error('Only Amoy testnet is supported.')}
  async function transactionFees(){const [data,block]=await Promise.all([provider.getFeeData(),provider.getBlock('latest')]);if(!block||block.baseFeePerGas==null)throw Error('Could not read the current Amoy base fee. Refresh and try again.');return window.recycleProofAmoyFees(data,block.baseFeePerGas)}
  async function registry(address=state.address){if(!address||!E.isAddress(address))throw Error('Deploy a registry or enter its address first.');const a=await artifact();const code=await provider.getCode(address);if(code.toLowerCase()!==a.runtime.toLowerCase())throw Error('This address does not contain the expected RecycleProof contract on Amoy.');return new E.Contract(address,a.abi,signer)}
  function batchId(reference){return E.id(reference.trim().toLowerCase())}
  function selectedBatch(){const ref=el('chainBatch').value,b=batches().find(b=>b.reference===ref);if(!b)throw Error('Choose a local batch first.');return b}
  function evidence(reference,type){const event=events.find(e=>e.reference===reference&&e.type===type);if(!event)throw Error(type==='received'?'Confirm receipt in the local batch ledger first.':'Collection evidence is missing.');return event}
  function updateBatches(){const select=el('chainBatch'),old=select.value;select.replaceChildren();for(const b of batches()){const option=document.createElement('option');option.value=b.reference;option.textContent=b.reference+' · '+b.weight+' kg';select.append(option)}if(!select.options.length){const option=document.createElement('option');option.value='';option.textContent='Register or load a batch first';select.append(option)}if([...select.options].some(o=>o.value===old))select.value=old}
  function showTransactions(){
    const info=el('registryInfo');info.replaceChildren();if(state.address&&/^0x[0-9a-fA-F]{40}$/.test(state.address)){info.append('Selected registry · ');const a=document.createElement('a');a.href=explorer+'/address/'+state.address;a.target='_blank';a.rel='noopener noreferrer';a.textContent=state.address;info.append(a)}else info.textContent='No registry deployed or selected.';
    el('contractAddress').value=state.address||'';const list=el('chainTransactions');list.replaceChildren();for(const tx of [...state.transactions].reverse()){if(!/^0x[0-9a-fA-F]{64}$/.test(tx.hash))continue;const row=document.createElement('div');row.className='event';row.append(tx.kind+' · '+(tx.reference||'Registry')+' · '+tx.status+' ');const link=document.createElement('a');link.href=explorer+'/tx/'+tx.hash;link.textContent='View transaction ↗';link.target='_blank';link.rel='noopener noreferrer';row.append(link);list.append(row)}
  }
  async function inspect(){
    if(!provider||!state.address){el('chainState').textContent='Connect a wallet and select a registry to inspect blockchain evidence.';return}
    const b=selectedBatch(),c=await registry(),stored=await c.batches(batchId(b.reference));
    if(stored.collector===E.ZeroAddress){el('chainState').textContent='This batch reference is not registered in the selected registry.';return}
    const collection=evidence(b.reference,'registered'),matches=stored.collectionHash.toLowerCase()==='0x'+collection.hash;
    const receipt=events.find(e=>e.reference===b.reference&&e.type==='received');
    el('chainState').textContent=(matches?'Collection hash matches local evidence.':'WARNING: Collection hash does not match local evidence.')+' Collector: '+stored.collector+'. Recycler: '+stored.recycler+'. '+(stored.received?(receipt&&stored.receiptHash.toLowerCase()==='0x'+receipt.hash?'Receipt hash matches local evidence.':'Receipt is recorded; local receipt evidence is missing or different.'):'Receipt has not been confirmed on-chain.')+' Physical recycling is not verified.';
    el('recyclerAddress').value=stored.recycler;
  }
  async function recover(){
    for(const tx of state.transactions.filter(t=>t.status==='pending')){const receipt=await provider.getTransactionReceipt(tx.hash);if(!receipt)continue;tx.status=receipt.status===1?'confirmed':'reverted';tx.block=receipt.blockNumber;if(tx.kind==='Deploy registry'&&receipt.status===1&&receipt.contractAddress){await registry(receipt.contractAddress);state.address=receipt.contractAddress}save()}
    showTransactions();
  }
  function unresolved(){if(state.transactions.some(t=>t.status==='pending'))throw Error('A transaction is pending. Use Refresh / recover transaction before sending another.');}
  async function track(tx,kind,reference='',address=''){
    state.transactions.push({hash:tx.hash,kind,reference,address,status:'pending',chainId});save();showTransactions();say('Transaction submitted. Waiting for a confirmed block; do not submit again.');
    try{const receipt=await tx.wait(1,90000);if(!receipt)throw Error('Confirmation is still pending.');await recover();if(receipt.status!==1)throw Error('Transaction reverted. No blockchain evidence was added.');say('Transaction confirmed on Polygon Amoy. See the explorer link below.')}catch(e){await recover();throw e}
  }
  el('connectWallet').onclick=()=>action(async()=>{await connect();await recover();say('Wallet connected to Amoy. Use free test POL for gas.');if(el('chainBatch').value&&state.address)await inspect()});
  el('deployContract').onclick=()=>action(async()=>{await requireWallet();await recover();unresolved();if(state.address)throw Error('A registry is already selected. Reuse it, or enter a different existing registry.');const a=await artifact();say('Approve deploying the test registry in your wallet.');const contract=await new E.ContractFactory(a.abi,a.bytecode,signer).deploy(await transactionFees());await track(contract.deploymentTransaction(),'Deploy registry');showTransactions()});
  el('useContract').onclick=()=>action(async()=>{const address=el('contractAddress').value.trim();await requireWallet();await recover();unresolved();await registry(address);state.address=E.getAddress(address);save();showTransactions();say('Contract bytecode verified on Amoy.');if(el('chainBatch').value)await inspect()});
  el('publishCollection').onclick=()=>action(async()=>{await requireWallet();await recover();unresolved();if(!await valid())throw Error('Local evidence history has changed. Fix the evidence before publishing.');const b=selectedBatch(),event=evidence(b.reference,'registered'),c=await registry(),receiver=el('recyclerAddress').value.trim();if(!E.isAddress(receiver)||receiver===E.ZeroAddress||receiver.toLowerCase()===account.toLowerCase())throw Error('Enter a valid, different recycler wallet address.');const grams=Math.round(Number(b.weight)*1000);const stored=await c.batches(batchId(b.reference));if(stored.collector!==E.ZeroAddress)throw Error('This reference already exists in this registry. Inspect it instead of registering again.');say('Approve publishing the collection hash and nominated recycler in your wallet.');const tx=await c.register(batchId(b.reference),receiver,grams,'0x'+event.hash,await transactionFees());await track(tx,'Collection',b.reference,state.address);await inspect()});
  el('publishReceipt').onclick=()=>action(async()=>{await requireWallet();await recover();unresolved();if(!await valid())throw Error('Local evidence history has changed.');const b=selectedBatch(),event=evidence(b.reference,'received'),collection=evidence(b.reference,'registered'),c=await registry(),stored=await c.batches(batchId(b.reference));if(stored.collector===E.ZeroAddress)throw Error('Publish the collection before its receipt.');if(stored.collectionHash.toLowerCase()!=='0x'+collection.hash)throw Error('Collection evidence does not match the registered batch.');if(stored.received)throw Error('Receipt is already confirmed on-chain.');if(stored.recycler.toLowerCase()!==account.toLowerCase())throw Error('Switch MetaMask to the nominated recycler account: '+stored.recycler);say('Approve publishing the receipt hash in your recycler wallet.');await track(await c.confirmReceipt(batchId(b.reference),'0x'+event.hash,await transactionFees()),'Receipt',b.reference,state.address);await inspect()});
  el('refreshChain').onclick=()=>action(async()=>{await requireWallet();await recover();if(el('chainBatch').value&&state.address)await inspect();say(state.transactions.some(t=>t.status==='pending')?'Transaction still pending. Check its explorer link; do not resubmit.':'Blockchain state refreshed.')});
  el('chainBatch').onchange=()=>action(async()=>{if(provider&&state.address)await inspect()});
  window.addEventListener('batches-changed',updateBatches);
  if(window.ethereum?.on){const changed=()=>{provider=null;signer=null;account='';el('chainBadge').textContent='RECONNECT WALLET';el('walletInfo').textContent='Account or network changed. Connect again before continuing.';el('chainState').textContent='Reconnect to refresh blockchain evidence.'};window.ethereum.on('accountsChanged',changed);window.ethereum.on('chainChanged',changed)}
  updateBatches();showTransactions();
})();
