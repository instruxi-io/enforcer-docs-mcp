# Enforcer Files

Object storage and resource sharing. Supports S3, GCS, and Storj backends configured per tenant.

## Storage Model

Enforcer uses **presigned URLs** — files never flow through the Enforcer API server. The client requests an upload/download URL from Enforcer, then interacts directly with the storage backend (S3/GCS/Storj). Enforcer tracks file metadata in Postgres.

### Upload Flow
1. Request a presigned upload URL from Enforcer
2. PUT the file directly to the returned URL
3. Enforcer records the metadata (name, size, content type, owner, tenant)

### Download Flow
1. Request a presigned download URL from Enforcer (by file ID)
2. GET the file directly from the returned URL

This architecture means large file transfers don't bottleneck on the API server.

## File Management

Standard CRUD on file metadata: list (paginated), get by ID, update metadata, delete (removes from storage + DB), copy, move, and move-to-trash.

Files are stored at `{instanceID}/t/{tenantHash}/u/{userID}/{fileName}` — but this path is internal. Clients never construct it; the presigned URL abstracts it away.

## Storage Backends

The backend is configured per tenant via connections (see `/enforcer-admin`). Each needs its own credentials:

- **S3** — any S3-compatible service (AWS, MinIO, etc.)
- **GCS** — Google Cloud Storage (service account JSON)
- **Storj** — Storj DCS (access grant)

If no storage connection is configured for a tenant, storage endpoints return an error.

## Sharing

Sharing intents let users grant access to resources (typically files) to other users or groups within the same tenant.

### Concepts

A **sharing intent** says "user A grants user B (or group G) access to resource X with permission level Y, optionally expiring at time T."

- Creating an intent shares the resource
- Revoking an intent removes access
- Access checks evaluate whether a user has a valid (non-expired, non-revoked) intent for a resource

### Workflows

**Share a file**: create a sharing intent specifying the resource ID, target user/group, and permission level.

**Check access**: before serving a resource, call the access-check endpoint to verify the requester has a valid intent.

**List my shares**: query what you've shared (outbound) or what others shared with you (inbound).

**Revoke**: revoke a single intent by ID, or revoke all intents for a resource (owner cleanup).

### Scoping

Sharing intents are tenant-scoped. You cannot share resources across tenants. The sharing list endpoint (admin view) shows all intents within a tenant.

## Gotchas

- Presigned URLs have a TTL (typically minutes). Don't store them — request a fresh one each time.
- Deleting a file removes the storage object AND the DB record. Sharing intents referencing a deleted file become orphaned.
- The object key in presigned URLs is sanitized server-side to prevent path traversal.

---

Use `list_endpoints(tag: "Storage")` and `list_endpoints(tag: "Sharing")` from the `enforcer-docs` MCP server to discover endpoints. Then `get_endpoint(operationId)` for request/response shapes.
