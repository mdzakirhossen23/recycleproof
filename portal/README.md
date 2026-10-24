# RecycleProof

A five-language recycling custody portal with wallet-signed evidence on Polygon Amoy. Live app: https://recycle.baharsoftbd.com/

## Runtime and data
PHP 8.1+ with PDO SQLite and fileinfo. The deployed database and photos remain in `/home/baharsof/recycleproof-private`, outside the public document root. Account approval and per-batch permissions are enforced on the server. The first controller requires an owner setup key. Never publish `owner-config.php`, that key, database files, user credentials or wallet secrets.

## Workflow
1. The owner creates the Controller account once.
2. Collectors and recyclers sign up and remain pending until the controller approves them.
3. A collector registers material, weight, location and the nominated recycler. The server creates a SHA-256 evidence hash.
4. The nominated recycler confirms receipt or flags a mismatch.
5. On Blockchain evidence, the collector nominates the recipient wallet and anchors the collection hash; the recycler anchors the receipt hash with the separate nominated wallet. MetaMask asks the user to approve transactions on Amoy.
6. Check blockchain compares contract state with the portal's current evidence hash and weight. Duplicate IDs and receipts are rejected by the deployed contract.

## Evidence boundary
The old `blockchain/` prototype has its own browser-local ledger. The portal's Blockchain evidence page now reads the shared server batches directly. The verified prototype batch `DEMO-DHA-001` is illustrative and remains separate from portal records. No physical recycling, carbon credits, avoided emissions or AI classification are claimed. Transaction links are stored on the current device per portal user; contract state is the verification source and links are not a shared server transaction index. Wallet addresses are nominated by the publishing user; the server does not cryptographically bind a portal identity to an Ethereum address.

## Current live dependencies
Controller setup and active Collector/Recycler accounts are required for a full new portal handover. The owner sets their password in the browser. New portal on-chain transactions have not yet been completed end to end. Public RPC services may rate limit; read-only contract queries use an alternate provider fallback. Wallet transactions still use the user's configured Amoy wallet connection.

## Interface
English by default, with Bengali, Arabic (RTL), Dutch and German. Five coordinated themes. Centered resizable application window; page content fits and lists paginate. Login/signup forms highlight invalid fields and the next action.
