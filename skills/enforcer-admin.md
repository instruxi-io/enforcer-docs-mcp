# Enforcer Admin

Tenant setup, user/group/role management, connections, terms, and email. All admin endpoints require a JWT with an admin role.

## Tenant Lifecycle

Create a tenant → configure its connections → create admin users → optionally set up terms and policies → users can register/login.

Tenants can be activated/deactivated. A deactivated tenant's users cannot authenticate. Deleting a tenant is destructive and cascades.

## Connections

Connections wire external service integrations per tenant. Each connection has a **capability** (what it does) and a **provider** (which service fulfills it).

Examples:
- Auth: `google_oauth` (Google client ID/secret), `privy` (Privy app ID)
- Storage: `s3`, `gcs`, `storj` (each with their own credentials)
- SMS: `twilio` (for phone verification)
- Email: `sendgrid` (for OTPs, invitations, bulk email)

The capabilities endpoint lists all available types and providers. Connection credentials are encrypted at rest using the instance-wide encryption key.

A tenant's features are gated by its connections — no Twilio connection means no phone verification, no storage connection means file endpoints return errors.

## User Management

Admins can create users directly, invite pre-created users, resolve users by email/address/Privy ID, change roles, move users between tenants, activate/deactivate, and delete. Bulk operations (activate, deactivate, delete) are available for managing large user sets.

Verify-contact lets an admin mark a user's contact (email/phone) as verified without the user going through the OTP flow.

## Groups

Admin groups are managed entities for organizing users. Admins create groups, add/remove users, and can query which groups a user belongs to. The suggestions endpoint helps find users not yet in a group.

Batch operations let you add a user to multiple groups at once. You can also remove a user from all groups in one call.

Groups serve as targets for sharing intents (see `/enforcer-files`) and verification challenges.

## Roles

Simple RBAC: create named roles, assign them to users. Roles are referenced in JWT claims and OPA policies for authorization decisions. CRUD with pagination.

## Terms Management

Admin-side terms of service lifecycle: create, update, delete. Terms have a type field (e.g., "tos", "privacy_policy") so you can manage multiple documents independently. Users accept/revoke via the user-facing terms endpoints (see `/enforcer-auth`).

## Group Challenge Staging

The admin workflow for group verification challenges:

1. Create or select a group with the target users
2. Stage a group challenge — this creates verification sessions for each group member
3. Members complete their verification (email/phone) through the normal verification flow
4. Admin monitors progress via verification session queries

This is useful for compliance gates: "all members of this group must verify their phone number before proceeding."

## Bulk Email

Send email to users within the tenant. Requires an email connection (e.g., SendGrid) configured for the tenant.

---

Use `list_endpoints(tag: "Admin Users")`, `list_endpoints(tag: "Admin Groups")`, `list_endpoints(tag: "Admin Roles")`, `list_endpoints(tag: "Admin Tenants")`, and `list_endpoints(tag: "Connections")` from the `enforcer-docs` MCP server to discover endpoints. Then `get_endpoint(operationId)` for request/response shapes.
