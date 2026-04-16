# Enforcer KV

Tenant-scoped key-value store with TTL support. Available over HTTP and gRPC.

## Concepts

Keys are scoped by tenant AND user. Two users in the same tenant cannot see each other's keys. Two users in different tenants with the same key name have fully isolated storage.

Internally, Redis keys follow the pattern `{instanceID}:{prefix}kv:{tenantHash}:{userID}:{key}` — but this is invisible to callers. You just work with key names.

## Operations

**Core**: set (with optional TTL), get, delete, exists, list keys.

**Batch**: mset, mget, mdelete — operate on multiple keys in one round-trip. Use these when a page load needs several keys.

**Atomic increment**: increment a numeric value without read-modify-write races. Preserves existing TTL.

**Stats**: per-user statistics on key count and usage.

**TTL management**: get remaining TTL for a key, update TTL on an existing key. TTL is in seconds; pass 0 or omit for no expiry.

## gRPC

The KV service is also available over gRPC on a separate port. Methods mirror the HTTP API. Authentication uses gRPC metadata: `authorization: Bearer <jwt>` or `x-api-key: <key>`. Proto definitions are in the Enforcer repo.

Use gRPC when you need lower latency or streaming. HTTP is fine for most use cases.

## Common Patterns

**Feature flags**: store a JSON blob keyed by feature name, fetch on each request.

**Session/cache data**: set with TTL matching the session lifetime. Use exists for fast presence checks.

**Rate limiting / counters**: atomic increment for request counts, usage tracking.

**Batch preload**: mget all keys a page needs in one call instead of N sequential gets.

## Gotchas

- TTL applies to Redis only. If there's a Postgres audit record, it persists independently of Redis TTL expiry.
- Keys are user-scoped, not tenant-scoped. There's no "shared tenant keyspace" — each user has their own namespace. For shared state, use a service account with an API key.
- The list endpoint is paginated. Large key sets need cursor-based iteration.

## Health Endpoints

Enforcer exposes three health endpoints (no auth required): a general health check, a Kubernetes liveness probe, and a readiness probe that verifies DB/Redis/Kafka connectivity. Use these for monitoring and orchestration.

---

Use `list_endpoints(tag: "KV")` and `list_endpoints(tag: "Health")` from the `enforcer-docs` MCP server to discover endpoints. Then `get_endpoint(operationId)` for request/response shapes.
