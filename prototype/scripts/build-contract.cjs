const fs=require('node:fs'),solc=require('solc');
const source=fs.readFileSync('contracts/RecycleProof.sol','utf8');
const input={language:'Solidity',sources:{'RecycleProof.sol':{content:source}},settings:{evmVersion:'paris',optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}};
const output=JSON.parse(solc.compile(JSON.stringify(input)));
for(const e of output.errors||[]) {console.log(e.formattedMessage);if(e.severity==='error')process.exitCode=1}
if(process.exitCode)process.exit(process.exitCode);
const c=output.contracts['RecycleProof.sol'].RecycleProof;
fs.mkdirSync('dist/vendor',{recursive:true});
fs.copyFileSync('node_modules/ethers/dist/ethers.umd.min.js','dist/vendor/ethers.umd.min.js');
fs.copyFileSync('node_modules/ethers/LICENSE.md','dist/vendor/ethers-LICENSE.md');
fs.copyFileSync('contracts/RecycleProof.sol','dist/RecycleProof.sol');
fs.writeFileSync('dist/contract.json',JSON.stringify({compiler:solc.version(),abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,runtime:'0x'+c.evm.deployedBytecode.object},null,2)+'\n');
console.log('Compiled RecycleProof and bundled ethers locally.');
