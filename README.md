# Secure Signing Service

Lightweight signing service used to generate ECDSA signatures for pre-verified reward claims. The service accepts a pre-verified claim payload from an n8n workflow (or similar), constructs a packed message that matches the on-chain Solidity hashing, and returns a signature produced by the verifier wallet.

## Contents

- `server.js` — Express server that signs messages with the verifier private key
- `.env.example` — example environment variable showing `VERIFIER_PRIVATE_KEY`

## Purpose / contract

This service helps generate signatures that a smart contract can verify on-chain. It follows the same packing and hashing used by the Solidity contract's `_getMessageHash` function (i.e. `keccak256(abi.encodePacked(...))`) so the produced signatures are accepted by the contract.

Important: Do NOT send private keys to other services. Keep signer keys secret and rotate regularly.

## Requirements

- Node.js (14+) and npm
- The `VERIFIER_PRIVATE_KEY` environment variable must be set to a valid Ethereum private key (64 hex chars, with or without `0x` prefix).

## Install

Install dependencies:

```bash
npm install
```

## Environment

Create a `.env` or export the environment variable before running. Example in `.env.example`:

```
VERIFIER_PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE
```

Locally you can run (example):

```bash
VERIFIER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE npm start
```

Or:

```bash
node server.js
```

## HTTP Endpoint

POST /api/sign-claim

JSON body (required fields):

```json
{
  "userId": "<string>",
  "recipient": "0x...",
  "amount": "<number or numeric string>",
  "rawClaimId": "<string>"
}
```

Behavior:

- The service hashes `rawClaimId` to a bytes32 using keccak (equivalent to `utils.id(rawClaimId)`).
- Then it encodes and packs the values in the same order the contract expects: `['string','address','uint256','bytes32']` and computes `keccak256` of that packed message.
- The resulting message hash is signed and the signature is returned.

Response example:

```json
{ "signature": "0x..." }
```

Example curl (replace values):

```bash
curl -X POST http://localhost:3001/api/sign-claim \
  -H "Content-Type: application/json" \
  -d '{"userId":"alice","recipient":"0x123...","amount":"1000000000000000000","rawClaimId":"claim-0001"}'
```

## Verifying the signature (off-chain)

You can verify the signature produced by this service with ethers.js. Example Node snippet:

```js
const { utils } = require("ethers");

// reconstruct packed message the same way server/contract does
const claimIdBytes32 = utils.id(rawClaimId); // rawClaimId = 'claim-0001'
const encoded = utils.solidityPack(
  ["string", "address", "uint256", "bytes32"],
  [userId, recipient, amount, claimIdBytes32]
);
const hash = utils.keccak256(encoded);
const recovered = utils.verifyMessage(utils.arrayify(hash), signature);
console.log("Recovered address:", recovered);
```

On-chain the contract should call the same packing/hash and `ecrecover` flow to validate the signature.

## Security recommendations

- Never commit real private keys to source control. Use secrets manager or environment variables provided by your deployment platform.
- Prefer hardware/MPC or cloud KMS for production signer keys.
- Limit network access to this service and ensure the caller (e.g., n8n) is trusted and authenticated.
- Rotate keys and have a revocation/rotation plan.

## Deployment

This repo contains a `Dockerfile` and `fly.toml` (if you use Fly.io). Typical steps:

```bash
# build image
docker build -t signing-service:latest .

# run locally (make sure to pass the private key safely)
docker run -e VERIFIER_PRIVATE_KEY=0xYOUR_KEY -p 3001:3001 signing-service:latest
```

When deploying to a cloud provider, set `VERIFIER_PRIVATE_KEY` via the provider's secret store (do NOT put the key in the image).

## Notes

- The server expects pre-verified claim payloads. Do not rely on this service to validate user eligibility; perform checks upstream (n8n or other workflow).
- The message packing and types must match exactly between the signer, the verifier contract, and any client-side verification.

## Troubleshooting

- If the server exits with an error about `VERIFIER_PRIVATE_KEY` not set, ensure the env var is exported or passed into the process.
- If signatures don't verify on-chain, confirm the ordering and types used in packing and that `rawClaimId` is hashed the same way.

---

Generated README for the signing service.
