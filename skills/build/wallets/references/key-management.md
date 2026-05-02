# Key Management

Private keys are the only thing standing between an attacker and the funds they control. This file is the operational discipline: where keys live, who can use them, how to rotate, and how AI agents specifically should hold keys without becoming an instant compromise vector.

For wallet *types* (EOA vs Safe vs 4337 vs 7702), see `SKILL.md` and the other references in this folder. This file is about the secret material itself.

## The hierarchy of "where the key lives"

```
WORST                                                                  BEST
─────────────────────────────────────────────────────────────────────────────
plaintext in code   →  env var   →  encrypted   →  hardware  →  HSM/KMS/TEE
                                     keystore       wallet       (split + sealed)
                                     (.json,        (Ledger,      (AWS KMS,
                                      pwd-locked)   Trezor)       GCP, Turnkey,
                                                                   Privy TEE)
```

A key gets **less** dangerous as you move right because:
1. It can't be exfiltrated by reading a file.
2. Signing requires user confirmation (hardware) or attestation (TEE/KMS).
3. Compromise of one machine ≠ compromise of the key.

## Local development

For testnets and Anvil, use Foundry's encrypted keystore. Never `--private-key 0xabc...` on the command line — it ends up in shell history.

```bash
# One-time: import an existing key, encrypted
cast wallet import deployer --interactive
# → keystore at ~/.foundry/keystores/deployer

# Or generate a new one
cast wallet new --keystore-dir ~/.foundry/keystores --name deployer

# Use it (prompts for password, or use --password-file)
forge script Deploy.s.sol --account deployer --sender 0x... --rpc-url $RPC --broadcast
cast send 0x... "fn()" --account deployer
```

The keystore is `aes-128-ctr` encrypted with PBKDF2 (Geth keystore v3 format). Strong password = strong protection. Weak password = file-grep + GPU = pwned.

## Production deployment keys

Three patterns, ranked:

### 1. Hardware wallet (recommended for solo)

```bash
forge script Deploy.s.sol --ledger --hd-paths "m/44'/60'/0'/0/0" \
  --rpc-url $RPC --broadcast --sender 0x...
```

Pros: key never leaves the device. Cons: requires physical confirmation per tx (good for security, slow for many deploys); Ledger's "blind signing" warnings are easy to misread.

### 2. KMS / cloud signer

| Provider | Notes |
|---|---|
| AWS KMS | secp256k1 keys, sign via API. Use with `@aws-sdk/client-kms` + custom viem account. |
| GCP Cloud KMS | Same shape; ETH signer libraries exist. |
| Turnkey | Purpose-built for crypto; raw keys never leave their TEE. |
| Privy server wallets | Hosted; same TEE pattern. |
| Fireblocks | Enterprise; MPC + policy engine. |

Pros: key cannot be exported. Auditable. Permission scoping. Cons: vendor dependency, latency.

### 3. Multisig with KMS-backed signers

Best of both: deploy with a Safe whose signers are KMS-backed. No single signer can deploy alone; KMS audit trail records every signature; rotating a compromised signer is one Safe tx.

## What to do with the deployer after deployment

The deployer key is the most dangerous key in the project. After deployment:

1. **Transfer ownership of every deployed contract** to a multisig. `setOwner`, `transferOwnership`, `acceptAdmin` (per OZ AccessControl).
2. **Grant DEFAULT_ADMIN_ROLE to multisig**, revoke from deployer.
3. **Confirm deployer has no privileged role**:
   ```bash
   cast call $CONTRACT "hasRole(bytes32,address)(bool)" \
     0x0000000000000000000000000000000000000000000000000000000000000000 $DEPLOYER --rpc-url $RPC
   # MUST return false
   ```
4. **Drain the deployer**. Send remaining gas to the multisig. Empty wallet = boring target.
5. **Document the deployer's checksummed address** in the README so users can verify it's now powerless.

## Wallets for AI agents

The agent's wallet is permanently online and signs without human review. Treat it as **already compromised** — design around that.

### Pattern: Limited-funds operating wallet

```
Master Multisig (Safe, 2-of-3)
  │
  ├── owns all funds, all contracts
  └── refills agent wallet up to a cap weekly via Safe Allowance Module

Agent Operating Wallet (EOA, single key)
  │
  └── signs day-to-day txs, holds only weekly burn
```

If the agent key leaks: attacker drains one week of operating funds, not the treasury. Master never signed a tx with the leaked key. Rotate by updating the Allowance Module recipient.

### Pattern: Session-key delegation

```
User Smart Account (4337 or 7702-delegated EOA)
  │
  ├── grants session key to agent for: contract X, function Y, value cap Z
  └── revokes session key when done (or after expiry)
```

Agent never holds the master key. Compromise = scoped to the session.

### Anti-patterns

- **Reusing the deployer key as the agent's runtime key**. Now an LLM with file-system access has owner privileges over your protocol.
- **Single key with full multisig signing rights**. The agent IS the multisig — you've recreated an EOA with extra steps.
- **Encrypting with a weak passphrase the agent itself knows**. If the agent can decrypt, anyone who reads the agent's memory can decrypt.
- **Letting the agent generate the key**. LLM-generated entropy has been broken before (insufficient entropy → predictable keys → drained). Use `crypto.randomBytes(32)` from a real CSPRNG; better, use a hosted KMS that exposes only signing.

## Backup and recovery

Hardware wallets ship with a 12/24-word seed phrase (BIP-39). Rules:

1. **Write it on paper or steel** — never in a password manager, cloud note, or photograph.
2. **Two physical backups**, geographically separated.
3. **Test recovery** before funding. Restore the seed onto a second device, verify addresses match.
4. **Passphrase (BIP-39 25th word)** for plausibly-deniable cold storage. Different passphrase = different wallet from the same seed.

For multisig (Safe) recovery, see `references/safe-multisig.md` — the recovery patterns there assume *you have already lost a signer key*. The seed-phrase rules above apply to each signer.

## Rotation

Rotating an EOA = transferring funds to a new wallet (cannot rotate in place — the address IS the public key hash). For protocol roles:

```solidity
// AccessControl pattern
contract.grantRole(ADMIN_ROLE, newSigner);
contract.revokeRole(ADMIN_ROLE, oldSigner);

// Safe pattern
safe.swapOwner(prevOwner, oldOwner, newOwner);  // see safe-multisig.md
```

Schedule rotation:
- Annual for cold keys.
- Quarterly for hot keys.
- Immediately on any anomaly (suspected leak, ex-employee, lost device).

## Detecting compromise

Watch for:
- **Outgoing tx you didn't send**. Set address-watcher alerts (Tenderly, OpenZeppelin Defender, custom Forta/Goldsky subgraph).
- **Approvals you didn't grant**. Run `revoke.cash` periodically; it lists every active token approval.
- **Failed sign attempts** on your hardware wallet (somebody has your PIN guess attempts).
- **Unexpected nonce jumps**. If your account sends 10 txs while you slept, something is wrong.

When you detect compromise:
1. From a clean device, transfer all funds to a new (also clean) wallet.
2. Revoke every token approval the compromised key granted.
3. If the compromised key is a Safe signer, replace it via the multisig.
4. Never reuse the compromised key, ever, for anything. Burn the seed too if applicable.

## Secret hygiene in the repo

```bash
# .gitignore (every project)
.env
.env.*
*.key
*.pem
*.keystore
broadcast/      # Foundry's deploy artifacts contain RPC URLs
cache/

# Pre-commit hook (example: .git/hooks/pre-commit)
#!/usr/bin/env bash
if git diff --cached -U0 | grep -E '0x[a-fA-F0-9]{64}|g\.alchemy\.com/v2/[A-Za-z0-9_-]+' >/dev/null; then
  echo "Possible secret detected. Use git diff --cached to inspect, --no-verify to override."
  exit 1
fi
```

Tools to layer on top:
- **`gitleaks`** — pre-commit + CI; broad regex coverage.
- **`trufflehog`** — scans git history; good for finding *already-committed* leaks.
- **GitHub secret scanning** — auto-revokes some provider keys; not a substitute for prevention.

## Mistakes that cost money

- **Sharing seed in a screenshot to a "support agent"** — there is no real support that asks for your seed.
- **Pasting a key into a fake Foundry script** — read the script before running it; especially scripts pasted from chats.
- **Approving `unlimited` allowance to a malicious contract** — always set finite allowance for unknown contracts.
- **Signing an opaque blob** — if a dApp asks for an EIP-712 signature you can't read, decode it (`viem.recoverTypedDataAddress` for symmetry checks; Etherscan's signature decoder for the structured data).
- **Reusing a key across mainnet, testnets, and dev** — testnet faucets, public RPCs, and forked-chain experiments leak metadata. Use disposable keys for dev.
- **Storing keys in a password manager that syncs to cloud unencrypted** — verify your manager's encryption model.
- **Buying a hardware wallet from a third-party seller** — only first-party (Ledger.com, Trezor.io). Tampered devices have shipped before.

## What to read next

- `references/safe-multisig.md` — operational layer above raw keys
- `references/aa-and-7702.md` — session keys and delegation as alternatives to bare-key signing
- `addresses/references/safe-and-aa.md` — verified addresses for the contracts your keys interact with
- BIP-39 spec: https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki
- AWS KMS for ETH (example signer integration): https://github.com/lucashenning/aws-kms-ethereum-signing
