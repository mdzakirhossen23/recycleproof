# RecycleProof

Recycling handover traceability for the IEEE ClimateChain Global Hackathon 2026.

**Track: Sustainable Supply Chains.** Live app: https://recycle.baharsoftbd.com/ · Sample preview: https://recycle.baharsoftbd.com/?demo=1

**Demo video (4:55):** https://youtu.be/TjVTP_1dTa4

## Try the hosted demo

Open the sample preview without login, or follow the testing-account instructions shown on the hosted login page. This source ships no account passwords. Create your own Controller, Collector and Recycler accounts when deploying. Keep owner setup keys and mail credentials private. Browsing and contract checks need no wallet; publishing requires the correct portal account, a nominated wallet, Amoy test POL and user approval.

## Working features

Controller approval; collection registration; optional photos; recycler receipt/mismatch reporting; per-batch SHA-256 evidence; material passports; reports; five languages and Arabic RTL; ten themes; responsive phone/tablet/desktop layouts; separate signed collection and receipt commitments. The interface compares portal hashes and weight with the contract and disables proofs already published.

## Demonstrated portal evidence

RP-2026-1: 5 kg PET test data, portal collector Zakir, nominated recycler Rahim, receipt RCV-001. Both commitments matched current contract state in the readiness check. This is a software demonstration, not independently verified physical recycling.

- Network: Polygon Amoy, chain ID 80002; test POL only.
- Registry: https://amoy.polygonscan.com/address/0x03BDF96627Cc061676F316Ea07100a2387Fb6F2d
- Collection: https://amoy.polygonscan.com/tx/0x4344741b4af30257109b5340170b4890ce1312e4f23f39517de08b6d5071456d
- Receipt: https://amoy.polygonscan.com/tx/0x26a7a8b6aa3db22121f8ff3979aafad8165d8c538655d87123f2aad8465e9c94

The earlier 12.5 kg DEMO-DHA-001 prototype is a separate illustrative entry.

## Source layout and tests

- `portal/public/`: shared PHP/SQLite portal and browser UI.
- `prototype/`: Solidity registry, artifact, build scripts and contract tests.
- `tests/`: portal evidence checks and form-guidance tests.

From this folder:

    node tests/chain-validation.cjs
    node tests/form-guidance.cjs
    cd prototype
    npm ci
    npm test

Contract tests use local Ganache, not real wallets or funds. A native compatibility warning can fall back to JavaScript. Read `portal/README.md` for implementation boundaries.

## Deploy your own copy

1. Serve HTTPS with PHP 8.1+, PDO SQLite, fileinfo and OpenSSL. Set the private database directory in `portal/public/api.php` outside the public document root.
2. Upload `portal/public/`. Adapt the cPanel-specific PHP handler in `.htaccess` for your server. Keep ZIPs, databases and private configuration blocked.
3. Generate a private random owner setup key and put only its SHA-256 hash in `owner-config.php`, using `owner-config.example.php`. Finish first-owner setup privately, then register/approve Collector and Recycler accounts. The hosted demo accounts are not automatically seeded in this source.
4. The frontend targets the deployed Amoy registry above. For your own contract, use the contract build/deployment scripts and update the frontend registry address/artifact consistently. Approve deployment in your own wallet.
5. Optional SMTP settings currently target mail.example.com:465 and noreply@example.com. Adapt `mailer.php` for your provider. Mail credentials belong in private storage, never the repository. Inbox delivery remains unverified in this demo.

The one-time account-replacement recovery tool is disabled without its separate private, expiring configuration. That configuration is deliberately excluded.

## Limitations

Blockchain records statements; it does not independently establish weight, material quality, actual recycling, ethical sourcing or carbon savings. No carbon credits or AI classifier are claimed. Portal identities are not cryptographically bound to wallets. Transaction URLs are saved per browser/user; shared portal hashes are server-side. Shared public Controller credentials suit a disposable judging workspace, not private production records. Actual iOS/Android hardware and mobile-wallet signing need further testing.

## Contributions

Project owner: Zakir. UI/design collaboration: Bahar. AI assisted implementation, design iteration, documentation and submission preparation. Understand the project and disclose contributions accurately when submitting.

No private owner keys, recovery tokens, databases, SMTP credentials or wallet keys are included. No account passwords are shipped in this source.

See THIRD_PARTY.md for bundled library licenses.
