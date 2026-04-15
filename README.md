# enforcer-docs-mcp

MCP server that lets AI agents discover and understand the [Enforcer API](https://enforcer-v2-dev.instruxi.dev/swagger/index.html).

Exposes the live OpenAPI spec as a set of MCP tools with progressive disclosure — agents can list endpoints, drill into specifics, and resolve schemas without loading the entire 950KB+ spec into their context.

## Install

```bash
# ~/.npmrc
@instruxi-io:registry=https://npm.pkg.github.com
```

Then run via `npx`:

```bash
npx @instruxi-io/enforcer-docs-mcp
```

## Configure with Claude Code / Claude Desktop

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

## Tools

| Tool | Description |
|------|-------------|
| `list_endpoints` | Paginated endpoint summaries, filter by tag / method / search. |
| `get_endpoint` | Full details for one endpoint (params, schemas, auth). |
| `list_tags` | All tags with endpoint counts. |
| `get_schema` | Component schema by name, refs resolved. |
| `list_auth_schemes` | API security schemes. |
| `get_spec_info` | Metadata (version, host, counts, source). |

## Environment variables

| Var | Default | Purpose |
|-----|---------|---------|
| `ENFORCER_SWAGGER_URL` | `https://enforcer-v2-dev.instruxi.dev/swagger/doc.json` | Live spec URL to fetch. |
| `ENFORCER_USE_EMBEDDED` | unset | Set to `1` to skip the live fetch and use the bundled snapshot only. |

The server fetches the spec on first use. If the fetch fails, it falls back to the embedded `swagger.json` (refreshed on every publish).

## License

MIT
