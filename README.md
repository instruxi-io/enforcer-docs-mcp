# enforcer-docs-mcp

**Model Context Protocol server for the Enforcer API.** Lets AI agents discover endpoints, schemas, and auth requirements without loading the full 950KB OpenAPI spec into their context.

> **Public repo**, no account needed to read docs. Install instructions below are **auth-free**: the package ships as a release tarball on GitHub Releases.

---

## What is Enforcer?

Enforcer is a multi-tenant backend that provides authentication (passkeys, SIWE, OAuth), a key-value store, file storage (S3 / GCS / Storj), wallet management, and policy authorization. It exposes 200+ HTTP endpoints under 23 tags. See the live OpenAPI spec: https://enforcer-v2-dev.instruxi.dev/swagger/doc.json

This MCP server wraps that spec as tools so AI agents can progressively explore the API surface instead of ingesting the entire document.

---

## Install & configure (for AI agents / IDEs)

### Option A — via Claude Desktop / Claude Code / Cursor

Add to your MCP config (`~/Library/Application Support/Claude/claude_desktop_config.json`, `.cursor/mcp.json`, or `~/.config/claude-code/mcp.json`):

```json
{
  "mcpServers": {
    "enforcer-docs": {
      "command": "npx",
      "args": [
        "-y",
        "https://github.com/instruxi-io/enforcer-docs-mcp/releases/latest/download/instruxi-io-enforcer-docs-mcp.tgz"
      ]
    }
  }
}
```

Restart the client. No GitHub auth needed — the tarball is a public release asset.

### Option B — pin to a specific version

```json
{
  "mcpServers": {
    "enforcer-docs": {
      "command": "npx",
      "args": [
        "-y",
        "https://github.com/instruxi-io/enforcer-docs-mcp/releases/download/v0.1.0/instruxi-io-enforcer-docs-mcp-0.1.0.tgz"
      ]
    }
  }
}
```

### Option C — from GitHub Packages (requires GitHub PAT)

```bash
# ~/.npmrc
@instruxi-io:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<PAT with read:packages>
```

```json
{
  "mcpServers": {
    "enforcer-docs": {
      "command": "npx",
      "args": ["-y", "@instruxi-io/enforcer-docs-mcp"]
    }
  }
}
```

---

## Point at a different environment

The server defaults to the **dev** Enforcer instance. Override per-session with `ENFORCER_SWAGGER_URL`:

```json
{
  "mcpServers": {
    "enforcer-docs": {
      "command": "npx",
      "args": ["-y", "https://github.com/instruxi-io/enforcer-docs-mcp/releases/latest/download/instruxi-io-enforcer-docs-mcp.tgz"],
      "env": {
        "ENFORCER_SWAGGER_URL": "https://enforcer-v2-prod.instruxi.dev/swagger/doc.json"
      }
    }
  }
}
```

Known URLs:
- `https://enforcer-v2-dev.instruxi.dev/swagger/doc.json` (default)
- `https://enforcer-v2-staging.instruxi.dev/swagger/doc.json`
- `https://enforcer-v2-prod.instruxi.dev/swagger/doc.json`

If the live fetch fails, the server falls back to the bundled `swagger.json` snapshot (refreshed on every release).

---

## Tools exposed

| Tool | Description |
|------|-------------|
| `list_endpoints` | Paginated endpoint summaries. Filter by `tag`, `method`, `search`. Returns `operationId`, method, path, summary, tags. |
| `get_endpoint` | Full operation details for a given `operationId`: parameters, request/response schemas with refs resolved, security. |
| `list_tags` | All API tags with endpoint counts. |
| `get_schema` | Component schema by `name`, with nested `$ref`s resolved. |
| `list_auth_schemes` | API security schemes (how authentication works). |
| `get_spec_info` | Spec metadata: title, version, host, counts, source (live URL or embedded). |

### Typical agent workflow

1. `get_spec_info` — verify the server is alive and which environment it's pointed at.
2. `list_tags` — find the logical grouping (Auth, KV, Files, Wallet, …).
3. `list_endpoints(tag: "KV")` — narrow to the relevant endpoints.
4. `get_endpoint(operationId: "…")` — grab request/response shape for the specific call you want to make.
5. `get_schema(name: "…")` — resolve any referenced types.
6. `list_auth_schemes` — understand how to authenticate before calling the API.

---

## Environment variables

| Var | Default | Purpose |
|-----|---------|---------|
| `ENFORCER_SWAGGER_URL` | `https://enforcer-v2-dev.instruxi.dev/swagger/doc.json` | Live spec URL to fetch. |
| `ENFORCER_USE_EMBEDDED` | unset | Set to `1` to skip the network fetch and only use the bundled snapshot. |

---

## Release cadence

Every merge to [`instruxi-io/enforcer`](https://github.com/instruxi-io/enforcer) main dispatches a rebuild here: the workflow snapshots the latest swagger from the configured URL, bumps the patch version, and publishes a new release + GitHub Packages version. Using `/releases/latest/download/...` in your config keeps you on the newest spec without pinning.

## License

MIT
