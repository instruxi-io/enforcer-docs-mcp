# Enforcer Auth

Authentication, authorization, identity verification, and terms of service.

## Authentication Flows

Enforcer supports multiple auth methods. All produce a JWT + refresh token pair. The JWT encodes the account ID, tenant ID, and role.

### Email OTP (default)
Send an OTP to the user's email, then verify it. Simplest flow — no external provider needed.

### Registration
Register creates an account and sends an activation email. The user must activate before logging in. Admins can also invite pre-created users via a separate activation flow.

### Google OAuth
Exchange a Google OAuth token for an Enforcer JWT. Requires the tenant to have a `google_oauth` connection configured (see `/enforcer-admin`).

### SIWE (Sign-In with Ethereum)
Request a nonce for the user's Ethereum address → user signs it client-side → submit the signature to get a JWT. Nonces are single-use and can be explicitly invalidated.

### Passkeys (WebAuthn)
Two-phase flow for both registration and login: begin (get a challenge) → finish (submit the signed challenge). Server-side relying party.

### Privy
Privy manages its own login UI and wallet. The user authenticates with Privy client-side, then exchanges the Privy JWT for an Enforcer JWT. On first login, Enforcer auto-creates the tenant and account if the Privy app ID is registered.

### Token Refresh
JWTs are short-lived (15m default). Use the refresh endpoint to get a new pair without re-authenticating.

### JWKS
Enforcer publishes its public keys at `/.well-known/jwks.json` so external services can verify JWTs without calling Enforcer.

## Privy vs Default Auth

**Default auth** — Enforcer owns the full login flow. Use when you control the login UI and want maximum flexibility (passkeys, SIWE, email OTP, Google).

**Privy auth** — Privy owns the login UI; Enforcer trusts Privy's JWT and maps it to an account. Use when you want Privy's embedded wallet experience and social logins. Privy app IDs are stored as tenant connections.

## API Keys

For server-to-server / programmatic access. Keys are long-lived, scoped to a tenant, and can be activated/deactivated without deletion. Use `X-API-Key` header instead of Bearer. The raw key value is returned only at creation time — store it securely.

## Authorization (OPA)

Enforcer uses Open Policy Agent for fine-grained policy evaluation. You can create tenant-scoped policies and then authorize actions against them. The authorize endpoint evaluates the policy using the caller's JWT claims as input and returns allow/deny.

## Verification

Identity verification for progressive trust:

**Email verification** — send OTP → confirm. Also available via Privy for Privy-auth tenants.

**Phone verification** — send SMS OTP → confirm. Requires the tenant to have an SMS connection (e.g., Twilio) configured.

**Group challenge** — an admin stages a verification challenge for a group. Members of that group complete their individual verification sessions. Useful for compliance gates (e.g., "all members of Group X must verify their phone before accessing feature Y").

Verification sessions track status per user and are queryable.

## Terms of Service

Admins create terms (see `/enforcer-admin`). Users can list available terms, accept them, check their acceptance status, and revoke acceptance. Terms have types (e.g., "privacy_policy", "tos") so you can require acceptance of multiple independent documents.

---

Use `list_endpoints(tag: "Authentication")`, `list_endpoints(tag: "Verification")`, `list_endpoints(tag: "API Keys")`, and `list_endpoints(tag: "Terms")` from the `enforcer-docs` MCP server to discover endpoints. Then `get_endpoint(operationId)` for request/response shapes.
