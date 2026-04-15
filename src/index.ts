#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  loadSwagger,
  listOperations,
  findOperation,
  getSchemas,
  getSecuritySchemes,
  inlineRefs,
} from "./swagger.js";

const server = new Server(
  { name: "enforcer-docs-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_endpoints",
      description: "List Enforcer API endpoints. Returns summaries only (method, path, operationId, summary, tags). Use get_endpoint for full details.",
      inputSchema: {
        type: "object",
        properties: {
          tag: { type: "string", description: "Filter by tag (see list_tags)." },
          method: { type: "string", description: "Filter by HTTP method, e.g. 'GET'." },
          search: { type: "string", description: "Substring match against path, summary, or operationId." },
          limit: { type: "number", description: "Max results (default 50, max 500).", default: 50 },
        },
      },
    },
    {
      name: "get_endpoint",
      description: "Fetch full details for a single endpoint: parameters, request/response schemas (refs resolved), security, tags.",
      inputSchema: {
        type: "object",
        properties: {
          operationId: { type: "string", description: "operationId from list_endpoints." },
        },
        required: ["operationId"],
      },
    },
    {
      name: "list_tags",
      description: "List all API tags (logical groupings like 'Auth', 'KV', 'Files') with endpoint counts.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_schema",
      description: "Fetch a component/definition schema by name with nested $ref resolution.",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string", description: "Schema name." } },
        required: ["name"],
      },
    },
    {
      name: "list_auth_schemes",
      description: "List API security schemes (how to authenticate).",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_spec_info",
      description: "Return spec metadata: title, version, host, basePath, endpoint count, source (live URL or embedded).",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const spec = await loadSwagger();
  const args = (req.params.arguments ?? {}) as Record<string, any>;

  switch (req.params.name) {
    case "list_endpoints": {
      const all = listOperations(spec);
      const tagFilter = typeof args.tag === "string" ? args.tag.toLowerCase() : null;
      const methodFilter = typeof args.method === "string" ? args.method.toUpperCase() : null;
      const search = typeof args.search === "string" ? args.search.toLowerCase() : null;
      const limit = Math.min(Math.max(Number(args.limit ?? 50), 1), 500);

      let filtered = all;
      if (tagFilter) filtered = filtered.filter((e) => e.tags.some((t) => t.toLowerCase() === tagFilter));
      if (methodFilter) filtered = filtered.filter((e) => e.method === methodFilter);
      if (search)
        filtered = filtered.filter(
          (e) =>
            e.path.toLowerCase().includes(search) ||
            (e.summary ?? "").toLowerCase().includes(search) ||
            e.operationId.toLowerCase().includes(search)
        );

      const total = filtered.length;
      const sliced = filtered.slice(0, limit);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ total, shown: sliced.length, endpoints: sliced }, null, 2),
          },
        ],
      };
    }

    case "get_endpoint": {
      const id = String(args.operationId ?? "");
      const hit = findOperation(spec, id);
      if (!hit) {
        return {
          content: [{ type: "text", text: `No endpoint with operationId '${id}'. Try list_endpoints.` }],
          isError: true,
        };
      }
      const resolved = inlineRefs(spec, hit.op, 2);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ method: hit.method, path: hit.path, ...resolved }, null, 2),
          },
        ],
      };
    }

    case "list_tags": {
      const counts = new Map<string, number>();
      for (const op of listOperations(spec)) {
        for (const t of op.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
      }
      const declared = spec.tags ?? [];
      const tags = Array.from(counts.entries())
        .map(([name, endpoint_count]) => ({
          name,
          endpoint_count,
          description: declared.find((t) => t.name === name)?.description,
        }))
        .sort((a, b) => b.endpoint_count - a.endpoint_count);
      return { content: [{ type: "text", text: JSON.stringify({ tags }, null, 2) }] };
    }

    case "get_schema": {
      const name = String(args.name ?? "");
      const schemas = getSchemas(spec);
      const schema = schemas[name];
      if (!schema) {
        return {
          content: [{ type: "text", text: `No schema named '${name}'. Use list_endpoints/get_endpoint to discover schema names.` }],
          isError: true,
        };
      }
      const resolved = inlineRefs(spec, schema, 2);
      return { content: [{ type: "text", text: JSON.stringify({ name, schema: resolved }, null, 2) }] };
    }

    case "list_auth_schemes": {
      const schemes = getSecuritySchemes(spec);
      return { content: [{ type: "text", text: JSON.stringify({ schemes }, null, 2) }] };
    }

    case "get_spec_info": {
      const source = process.env.ENFORCER_USE_EMBEDDED === "1" ? "embedded" : process.env.ENFORCER_SWAGGER_URL || "https://enforcer-v2-dev.instruxi.dev/swagger/doc.json";
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                title: spec.info.title,
                version: spec.info.version,
                host: spec.host,
                basePath: spec.basePath,
                schemes: spec.schemes,
                endpoint_count: listOperations(spec).length,
                schema_count: Object.keys(getSchemas(spec)).length,
                tag_count: (spec.tags ?? []).length,
                source,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }],
        isError: true,
      };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[enforcer-docs-mcp] ready on stdio");
}

main().catch((err) => {
  console.error("[enforcer-docs-mcp] fatal:", err);
  process.exit(1);
});
