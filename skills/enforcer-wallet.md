# Enforcer Wallet

Custodial cryptocurrency wallet management, signing operations, and backup/restore via Shamir's Secret Sharing.

## Architecture

Wallets are server-side custodial. Private keys never leave the server — all signing happens server-side. This means the client builds transactions and submits them for signing, but never handles raw keys (unless explicitly exporting).

Each wallet belongs to a user within a tenant. A user can have multiple wallets across different chains.

## Wallet Lifecycle

**Create**: create a wallet for a user, specifying the chain and provider. The system generates a key pair and stores it encrypted.

**Addresses**: each wallet can generate multiple addresses. Use these for receiving funds on different contexts (e.g., per-customer deposit addresses).

**Status**: wallets can be activated/deactivated via status updates.

**Delete**: destructive — removes the wallet and its keys. Back up first.

## Supported Chains & Providers

Query the supported-chains and supported-providers endpoints to discover what's available. Chain IDs follow standard conventions (1 = Ethereum Mainnet, 11155111 = Sepolia, etc.).

## Balance

Query native token balance or multi-asset balance (multiple tokens/assets) for a wallet. Balances are fetched from the chain in real-time.

## Signing

All signing is server-side. The client submits what needs to be signed; the server applies the wallet's private key and returns the signature.

**Transaction signing**: submit a transaction object → get back a signed transaction. Does NOT broadcast — you handle that.

**Send transaction**: sign AND broadcast in one step. Returns the transaction hash.

**Personal sign** (EIP-191): sign a human-readable message. Used for off-chain authentication and attestations.

**Typed data** (EIP-712): sign structured data with domain separator. Used for gasless approvals, permit signatures, etc.

**Raw sign**: sign an arbitrary hash with secp256k1. Low-level — use when the higher-level methods don't fit.

**EIP-7702 authorization**: sign a delegation authorization for account abstraction (code delegation).

**UserOperation signing** (ERC-4337): sign a UserOperation for ERC-4337 account abstraction bundlers.

## Signing Sessions

Every signing operation creates a session record. Query sessions by wallet to get a full audit trail of what was signed, when, and the result.

## Wallet Policies

Attach policies to wallets for guardrails: spending limits, whitelisted destination addresses, required approval flows, etc. Policies are evaluated before signing — a violation rejects the signing request.

## Key Export

Export returns the raw private key. This is irreversible from a security standpoint — once exported, Enforcer can't guarantee the key's security. The operation is audit-logged. Use for migration scenarios only.

## Backup & Restore (Shamir's Secret Sharing)

Backup splits the private key into N shares with a K-of-N threshold. Any K shares can reconstruct the key; fewer than K reveal nothing.

**Backup flow**: create a backup specifying total shares (N) and threshold (K). Distribute shares to different custodians (user, recovery service, hardware device).

**Restore flow**: collect K shares → submit them to the restore endpoint → wallet is reconstructed.

**Manage**: list backups per wallet, get backup metadata (share count, threshold — NOT the shares themselves), delete backups.

## Common Patterns

**Custodial wallet on signup**: create wallet during registration → generate address → user receives funds there.

**Transaction flow**: build TX client-side → `sign` → broadcast via your RPC, OR use `send-transaction` for one-step.

**Account abstraction**: build UserOp → `sign-user-operation` → submit to bundler endpoint.

**Compliance backup**: create wallet → immediately backup with 2-of-3 shares → user keeps one, org keeps one, recovery service keeps one.

## Gotchas

- Signing is synchronous. Large batch signing should be parallelized client-side.
- Nonce management for send-transaction is automatic. For sign-only flows, you manage nonces yourself.
- Export and backup are separate features. Export gives you the raw key; backup gives you Shamir shares. Don't confuse them.

---

Use `list_endpoints(tag: "Wallet")` and `list_endpoints(tag: "Backup")` from the `enforcer-docs` MCP server to discover endpoints. Then `get_endpoint(operationId)` for request/response shapes.
