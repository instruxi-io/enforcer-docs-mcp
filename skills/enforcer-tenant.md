---
name: enforcer-tenant
description: "Create a new enforcer tenant or update an existing tenant's config (branding, app_url/payment_link_url, auth/wallet provider, join policy, status) over the REST API with curl. The user pastes tenant details in free text; you resolve the tenant, show a before→after diff, confirm, then PATCH/POST and verify. Trigger: 'update tenant', 'create tenant', 'new tenant', 'configure tenant', 'update ekko tenant', 'update instruxi tenant', 'set tenant app_url / payment_link_url / logo', 'change tenant details', 'tenant settings'"
---

# Enforcer Tenant — create & update over REST

Conversational tenant editor. The user pastes details for one or more tenants;
you map them onto the Admin Tenants API, **show the proposed change, confirm,
then apply with `curl` and verify by reading the tenant back.**

This skill talks to the REST API only — no direct DB writes. Endpoint paths and
request/response shapes come from the **`enforcer-docs` MCP server**, not memory.

## Always discover, never hardcode

The spec is the source of truth. Before composing any request:

1. `list_endpoints(tag: "Admin Tenants")` — find the create / get / list / update
   operations and their `operationId`s.
2. `get_endpoint(operationId: "...")` — get the exact method, path, and body.
3. `get_schema(name: "...")` — resolve the create/update request bodies.
4. `list_auth_schemes` — confirm the auth header.

If the MCP server isn't available, fall back to the live spec at
`https://<host>/swagger/doc.json`, but prefer the MCP.

## Environments & auth

| Env | Host |
|-----|------|
| Dev | `enforcer-v2-dev.instruxi.dev` |
| Staging | `enforcer-v2-staging.instruxi.dev` |
| Prod | `enforcer-v2-prod.instruxi.dev` (serves `app.megprimepay.com` et al.) |

**Always ask which environment** unless the user is explicit. Prod is live —
treat every prod write as a confirm-first operation.

Admin tenant endpoints require an **admin-role** credential, sent as either:
- `Authorization: Bearer <jwt>` (admin-role JWT), or
- `X-API-Key: <key>` (admin-scoped API key).

Get tokens/keys per env from the `reference_api_keys` memory. Set up the shell:

```bash
HOST=enforcer-v2-prod.instruxi.dev      # pick the right env
TOKEN=...                               # admin JWT or API key
AUTH=(-H "Authorization: Bearer $TOKEN") # or: AUTH=(-H "X-API-Key: $TOKEN")
BASE="https://$HOST/api/v1/enforcer"     # confirm the prefix via get_endpoint
```

> The base path prefix (`/api/v1/enforcer`) and the exact tenant route differ by
> deployment — **verify with `get_endpoint` before sending.** Don't trust this
> example blindly.

## Tenant fields (domain knowledge the spec won't give you)

| field | meaning / allowed values |
|-------|--------------------------|
| `name` | display name, unique, required on create |
| `code` | join key for `/auth/join-tenant`; Privy tenants use `privy-<appid>` |
| `description` | free text |
| `active` / `status` | active \| inactive \| suspended (create takes `active` bool; status enum in CHECK) |
| `logo_url` / `banner_url` / `thumbnail_url` | branding; http(s) URL **or** a `data:` URI (the API normalizes) |
| `theme_colors` | palette object |
| `app_url` | **canonical tenant PWA base URL** for check-in (`/device-checkin/<token>`), invites (`/join/<code>`), and the payment-CTA fallback. Prefer setting this. |
| `payment_link_url` | base for the fulfillment **"Open payment link"** email CTA (`/send?fulfillment_id=…`); empty omits the button |
| `auth_provider` | null=inherit, else `native` \| `privy` |
| `wallet_provider` | null=inherit, else `mpc` \| `privy` (and NOT `native`+`privy` together) |
| `default_is_discoverable` | null=inherit (false), else bool |
| `self_join_policy` | `open` \| `invite_only` (default invite_only) |
| `require_signed_checkins` | bool; true rejects unsigned location check-ins |

### `app_url` vs `payment_link_url` — don't conflate

Two different fields: `app_url` is the whole PWA base (check-in + invite links),
`payment_link_url` is the payment-CTA base. If the user gives one URL and means
"the app", set **`app_url`** (and `payment_link_url` to the same if they want the
payment CTA too). Known prod values: `https://app.megprimepay.com` (MegPrime prod,
code `privy-cml89r5xo028ql10cg1txr9v5`), `https://pwa.instruxi.dev` (Instruxi).

### Update body is tri-state

The update (PATCH) request treats each field as: **omitted = no change**,
**`""` = clear**, **value = set**. Only include the fields the user actually gave.

## Procedure — update an existing tenant

1. **Parse** the pasted text into `{field: value}`. Map loose labels: "logo" →
   `logo_url`, "app"/"pwa url" → `app_url`, "payment url" → `payment_link_url`,
   "active/inactive" → status. Ask about anything ambiguous; don't invent values.
   Validate enums/URLs locally (see allowed values above) before sending.
2. **Resolve** the tenant id. Use the list/get operation (discover it via
   `list_endpoints`) to find the tenant by name or code and read its current
   values:
   ```bash
   curl -s "${AUTH[@]}" "$BASE/admin/tenants?q=ekko" | jq '.data[] | {id,name,code,app_url,payment_link_url,status}'
   ```
   Echo back `name / code / id` and confirm it's the right tenant.
3. **Diff & confirm.** Show a table of only the changing fields (current → new).
   Get an explicit yes before any prod write.
4. **Apply** with the update operation (confirm method/path via `get_endpoint`):
   ```bash
   curl -s -X PATCH "${AUTH[@]}" -H "Content-Type: application/json" \
     "$BASE/admin/tenants/$TENANT_ID" \
     -d '{"app_url":"https://pwa.instruxi.dev"}' | jq .
   ```
5. **Verify** — GET the tenant again (or read the response `data`) and confirm the
   fields match. Report back. Note: link changes only affect **newly issued**
   check-in/invite emails; already-sent links were baked at issue time.

## Procedure — create a new tenant

Use the create operation (`POST`, discover via `list_endpoints(tag:"Admin
Tenants")`). Creating through the API runs the create usecase, which also
bootstraps the tenant's Kafka topics — so always create via the API, never by
other means.

```bash
curl -s -X POST "${AUTH[@]}" -H "Content-Type: application/json" \
  "$BASE/admin/tenants" \
  -d '{
    "name":"Acme",
    "description":"Acme Corp",
    "app_url":"https://app.acme.example",
    "payment_link_url":"https://app.acme.example",
    "auth_provider":"native",
    "active":true
  }' | jq .
```

Confirm the create body shape with `get_schema` first (field names/required-ness
can change). After create, read the tenant back and confirm.

## Handling a multi-tenant paste

When the user pastes details for several tenants ("update ekko and instruxi"),
process them **one at a time**: resolve → diff → confirm → apply → verify for
each, so a mistake in one doesn't ride into another. Summarize all results at the
end.

## Safety checklist

- Confirm the **environment** and show a **before→after diff** before any prod write.
- Touch **only** the fields the user supplied (tri-state PATCH).
- Validate enums and URL fields up front; strip trailing slashes on URL bases.
- To deactivate a tenant set status inactive — don't delete (delete cascades and
  is destructive).
- Pull the exact endpoint + body from the `enforcer-docs` MCP, not from this file.
