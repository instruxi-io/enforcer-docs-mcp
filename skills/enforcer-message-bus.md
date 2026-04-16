# Enforcer Message Bus

Tenant-scoped Kafka messaging with audit trail, retry, and statistics.

## Concepts

Enforcer exposes Kafka as a managed message bus. Users publish messages to tenant-scoped topics without managing Kafka infrastructure directly. Every message is recorded in Postgres for auditing, retry, and queryability.

Kafka topics are prefixed with the tenant hash: `{tenantHash}.{baseTopic}`. This means tenants are fully isolated at the topic level — no cross-tenant message leakage.

## Publishing

Publish a message to a Kafka topic. The message is written to Kafka AND recorded in the Enforcer database. The database record tracks delivery status, timestamps, and metadata.

Use this for:
- Event-driven workflows (user signed up → publish event → downstream service consumes)
- Webhook-style notifications to external systems
- Audit-critical events where you need both real-time delivery and a persistent record

## Message Management

**List**: query messages with filters (topic, status, date range). Paginated.

**Get by ID**: retrieve a specific message's full payload and metadata.

**Delete**: remove a message record. Does NOT unpublish from Kafka (messages already consumed are unaffected).

## Audit

Every message has an audit trail:

**Tenant audit**: get all audit events across the tenant's messages. Useful for compliance dashboards.

**Message audit**: get audit events for a specific message — creation, delivery attempts, failures, retries.

## Retry

Failed messages (Kafka delivery failure, consumer rejection) can be retried:

**Retry a message**: re-publishes the message to Kafka. Creates a new audit entry. The message ID stays the same — downstream consumers should handle idempotency.

## Statistics

Per-tenant message stats: total messages, messages by status (delivered, failed, pending), throughput over time. Useful for monitoring and alerting.

## Common Patterns

**Event sourcing**: publish state-change events as messages. Downstream services consume from Kafka to build read models or trigger side effects.

**Webhook replacement**: instead of making HTTP calls to external systems (which fail silently), publish to Kafka and have a consumer handle delivery with retry.

**Audit log**: every message is recorded in Postgres. Query the messages endpoint for a searchable, filterable audit trail of all events.

## Gotchas

- Messages are published to Kafka synchronously. If Kafka is down, the publish call fails (it doesn't silently queue).
- The Kafka consumer group is prefixed by instance ID: `{instanceID}-{consumerGroupID}`. This prevents dev/staging/prod consumer group collision.
- Deleting a message removes the Postgres record only. The Kafka topic still has the message until retention expires.
- Retry re-publishes with the same payload. If you need to modify the payload, create a new message instead.

---

Use `list_endpoints(tag: "Messages")` from the `enforcer-docs` MCP server to discover endpoints. Then `get_endpoint(operationId)` for request/response shapes.
