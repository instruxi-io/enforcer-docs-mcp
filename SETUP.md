# Set up Enforcer with an AI agent

Instructions for setting up Enforcer, an identity and authorization platform.
Every call below has been run against the live sandbox. Responses are real,
trimmed to the fields that matter.

You will finish with: an account, an API key your agent can use, and a real
authorization decision you can watch change.

---

## Step 1 — Read the documentation

Index: <https://docs.instruxi.dev/llms.txt>
Full: <https://docs.instruxi.dev/llms-full.txt>

## Step 2 — Get a token

Request a one-time code:

```http
POST https://api.instruxi.dev/api/v1/enforcer/auth/otp/request
Content-Type: application/json

{"email":"YOUR@EMAIL","tenant_code":"DLXZ-57TL-FS75"}
```

Then exchange it. The code arrives by email:

```http
POST https://api.instruxi.dev/api/v1/enforcer/auth/login
Content-Type: application/json

{"provider":"email_otp","email":"YOUR@EMAIL","otp":"THE_CODE","tenant_code":"DLXZ-57TL-FS75"}
```

Keep `data.token`. **It expires in 15 minutes** — if a later step returns
`401 token_expired`, come back here rather than debugging the call.

## Step 3 — Confirm who you are

```http
GET https://api.instruxi.dev/api/v1/enforcer/auth/me
Authorization: Bearer $TOKEN
```

Note your `role.slug`. A new signup in the sandbox is `user`, and that matters
at step 6.

## Step 4 — Mint an API key for your agent

```http
POST https://api.instruxi.dev/api/v1/enforcer/api-keys
Authorization: Bearer $TOKEN
Content-Type: application/json

{"name":"agent"}
```

The plaintext key is in that response only and is never retrievable again.
Store it now.

Any account can mint its own key — you do not need to be an admin for this.

## Step 5 — Point your agent at the MCP server

```
https://api.instruxi.dev/mcp
```

It accepts either an `X-API-Key` header or OAuth 2.1. A client that speaks
OAuth needs no key at all: the `401` carries `WWW-Authenticate` naming the
resource metadata, which names the authorization server, and the client takes
it from there.

## Step 6 — Know the policy that governs you

The sandbox already has an active tenant policy. It is the one shown in full
under [A complete, working policy](#a-complete-working-policy) below, and it
says two things: anyone in the tenant may **read** a payment, and only an
elevated account may **write** or **manage** one.

Reading policies through the API needs the `tenant read` permission, which a
`developer` or `tenant_admin` has and a new `user` does not:

```http
GET https://api.instruxi.dev/api/v1/enforcer/admin/tenant-policies/active
Authorization: Bearer $TOKEN
```

```json
{"success":true,"data":{"version":2,"status":"active","declared_types":["payment"]}}
```

As a `user` the same call returns `403` with
`{"error":"forbidden","message":"requires tenant read"}`. That is the gate
working, not a fault. You can still watch the policy decide, which is the next
step and needs no special permission.

## Step 7 — Watch it decide

Ask the same question twice, changing only the action:

```http
POST https://api.instruxi.dev/api/v1/enforcer/authz/check
Authorization: Bearer $TOKEN
Content-Type: application/json

{"action":"read","resource":{"type":"payment","id":"pay_123"}}
```

```json
{"success":true,"allow":true,"reason":"tenant policy"}
```

Now send `"action":"write"`. As an ordinary `user`, the answer flips, and the
reason is the policy's own words:

```json
{"success":true,"allow":false,"reason":"changing a payment needs an elevated account in this tenant"}
```

As a `tenant_admin` the same write stays `{"allow":true,"reason":"tenant policy"}`.
Same question, same resource, different authority: that is the whole product
in one call.

---

## Writing a policy, when you have tenant admin

Policies are [Rego](https://www.openpolicyagent.org/docs/latest/policy-language/).
Three things the API will refuse if you get them wrong:

**The package name is derived from your tenant id**, with dashes replaced by
underscores, because a dash is subtraction in Rego:

```rego
package tenant.t_1497f7b8_150e_45fa_b257_cb3fe1dd45b1
```

**Import the vocabulary with an alias.** A bare `import data.enforcer.v1` binds
the name `v1`, which collides with the `import rego.v1` every policy needs, and
the module is refused:

```rego
import rego.v1
import data.enforcer.v1 as enforcer
```

**Write against the accessor's meaning, not its shape.** `enforcer.is_elevated`
survives a field rename; `input.accessor.permissions.admin_managed` does not.

### What a policy can see

```
input.accessor        the accessor document — use the enforcer.v1 helpers
input.action          read | write | manage
input.resource_type   the type, at the TOP level (not input.resource.type)
input.resource        {id, owner_id, tenant_id}
```

There is no `input.contexts`. A policy decides **who may do what to which
resource** — it cannot key on request-time values like an amount.

A `deny` that reads `input.resource` must also pin `input.resource_type` to a
type of your own. The platform builds lists for its own types before any row
exists, so a row-reading deny that could reach one would be skipped on every
list, and it is refused when you submit it rather than skipped in silence.

### A complete, working policy

```rego
package tenant.t_YOUR_TENANT_ID_WITH_UNDERSCORES

import rego.v1
import data.enforcer.v1 as enforcer

# The resource types this policy is authoritative for. On a type you declare,
# your allow rules are the answer, and no matching allow means DENY.
declared_types := ["payment"]

allow if {
	input.resource_type == "payment"
	input.action == "read"
}

allow if {
	input.resource_type == "payment"
	input.action in {"write", "manage"}
	enforcer.is_elevated
}

deny contains reason if {
	input.resource_type == "payment"
	input.action in {"write", "manage"}
	not enforcer.is_elevated
	reason := "changing a payment needs an elevated account in this tenant"
}

# Your own tests. These are RUN before the version may be activated, so a
# policy that does not do what you say it does cannot go live.
test_read_allowed_for_an_ordinary_user if {
	allow with input as {"action": "read", "resource_type": "payment", "accessor": {"permissions": {}}}
}

test_write_denied_for_an_ordinary_user if {
	count(deny) > 0 with input as {"action": "write", "resource_type": "payment", "accessor": {"permissions": {}}}
}

test_write_allowed_for_an_admin if {
	allow with input as {"action": "write", "resource_type": "payment", "accessor": {"permissions": {"cross_tenant": true}}}
}
```

### Submitting it

```http
POST https://api.instruxi.dev/api/v1/enforcer/admin/tenant-policies/
Authorization: Bearer $TOKEN
Content-Type: application/json

{"source":"package tenant.t_...\n\nimport rego.v1\n..."}
```

`source` is the Rego itself, as a JSON string with real newlines escaped.

A submission is stored as a new **version** and validated: compiled, checked
against the builtin allowlist, and its own `test_` rules run. You get back
`status: valid` or `status: rejected` with a `validation_error` saying which
test failed. A rejected version is kept, so you can show someone what you sent.

Nothing is live until you activate it:

```http
POST https://api.instruxi.dev/api/v1/enforcer/admin/tenant-policies/2/activate
Authorization: Bearer $TOKEN
```

Activation moves a pointer and takes effect within a second or two. To roll
back, activate the previous version, even one that has since been retired. The
old text is still there, which is what lets a decision log from last Tuesday
cite a policy you can still read.

### What a tenant policy can and cannot decide

The platform always answers first. What your policy can do with that answer
depends on whether the type is one you declared:

| The resource type is… | Your policy may… |
|---|---|
| **declared** in `declared_types` (a type of your own, like `payment`) | decide it outright. Your `allow` grants, a `deny` refuses, and silence is a denial. |
| **not declared** | only **deny**. An `allow` is ignored, and if the platform already said no, your policy is not run at all. |
| a **platform type** (`account`, `tenant`, `group`, `api_key`, `policy`, …) | only **deny**. Declaring one is refused when you submit. |

So a tenant policy can narrow the platform everywhere, but it can only grant
on types it owns. It can never grant itself authority over accounts, keys or
policies, because declaring those is refused at submit and ignored again at
evaluation.

---

## When something returns an error

**A rejected policy is not an HTTP error.** Submitting returns `200` with the
version stored as `status: "rejected"` and the reason in `validation_error`.
That is deliberate: your draft is kept, so you can show someone exactly what you
sent and what we refused. Check `status`, not the status code.

| Where | You see | What it means |
|---|---|---|
| any call | `401 token_expired` | The step-2 token lasts 15 minutes. Get another. |
| reading policies | `403 requires tenant read` | Listing or reading policies needs `developer` or `tenant_admin`. `/authz/check` does not. |
| submitting, activating | `403 requires tenant admin` | Changing policy needs `tenant_admin`. A `user` hits `requires tenant read` first, because the read gate covers the whole route group. |
| `validation_error` | `could not parse: … rego_parse_error: package expected` | `source` must be the Rego text itself, not a placeholder. |
| `validation_error` | ``policy must declare `package tenant.t_<your tenant id>` `` | The package name is derived from your tenant id. The message names the exact one to use. |
| `validation_error` | `rego_compile_error: import must not shadow import rego.v1` | Alias the vocabulary: `import data.enforcer.v1 as enforcer`. |
| `validation_error` | ``policy calls `is_superuser`, which data.enforcer.v1 does not provide`` | A misspelled or invented helper. It would otherwise never match, silently. |
| `validation_error` | ``` `account` is a platform resource type: a tenant policy may deny on it, but cannot declare authority over it``` | Take it out of `declared_types`. You can still write `deny` rules for it. |
| `validation_error` | ``a `deny` rule reads `input.resource`, which does not exist yet when a list query runs…`` | Add `input.resource_type == "<your type>"` to the rule, or make it depend only on `input.accessor`. |
| `validation_error` | `N of the policy's M tests failed` | Your own `test_` rules ran and one did not hold. |
| checking | `503` rather than `403` | We could not decide (your policy failed to evaluate, or a lookup was down). Retry. A `403` is always a real no. |

Each message above was produced by submitting the mistake to the validator and
reading the response, not written from memory.
