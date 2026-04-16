# Enforcer Me

User profile, preferences, contacts, invites, groups (self-service), and support.

## User Profile

The "me" endpoints let authenticated users manage their own account without admin intervention.

**Get/update profile**: view and edit your own profile fields (display name, avatar, bio, etc.).

**Preferences**: key-value user preferences (notification settings, UI theme, language, etc.). Separate from KV store — preferences are account metadata, not application data.

**List users**: search and list other users within your tenant. The public view endpoint returns a limited profile for any user by ID without requiring admin role.

**Privy sync**: if using Privy auth, sync wallet data from Privy into Enforcer's records. Claim-privy-id links an existing Enforcer account to a Privy identity.

## Contacts

A user's personal address book within the tenant.

**CRUD**: create, read, update, delete individual contacts. Contacts reference other users in the tenant.

**Lookup & resolve**: lookup finds users by name/email for adding as contacts. Resolve finds a user by wallet address (useful for crypto-native UIs).

**Suggestions**: returns users in your tenant who aren't already in your contacts — a "people you may know" list.

**Import**: bulk import contacts from an external source (CSV-style).

**Link**: link a custom (manually created) contact to a real user account when that person joins the platform.

**Bulk delete**: remove multiple contacts at once.

## Invites

Users can invite others to join the tenant.

**Create**: send an invite (generates an invitation that the recipient can accept).

**List**: view your outgoing invites.

**Stats**: see how many invites you've sent, accepted, pending, expired.

**Cancel**: revoke a pending invite.

Invites are distinct from admin user creation — invites are peer-to-peer, admin creation is top-down.

## User Groups (Self-Service)

Users can create and manage their own groups independently of admin groups.

**Create/update/delete**: users own groups they create. Ownership can be transferred.

**Public groups**: groups marked as public are visible to all users in the tenant. Users can join/leave public groups without an invite.

**Private groups**: require an explicit invite from the group owner. Owner can invite users and remove members.

**Memberships**: list your group memberships, join, leave, add to multiple groups in batch.

**Group members**: list who's in a group, view the "people" view (richer profile data).

The admin group endpoints (see `/enforcer-admin`) manage groups from above; these endpoints let users self-organize from below.

## Support

Users can send a support/contact email to the tenant admin. Requires an email connection configured for the tenant.

---

Use `list_endpoints(tag: "Users")`, `list_endpoints(tag: "Contacts")`, `list_endpoints(tag: "User Groups")`, and `list_endpoints(tag: "Invites")` from the `enforcer-docs` MCP server to discover endpoints. Then `get_endpoint(operationId)` for request/response shapes.
