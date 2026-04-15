import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export interface SwaggerSpec {
  swagger?: string;
  openapi?: string;
  info: { title: string; version: string; description?: string };
  host?: string;
  basePath?: string;
  schemes?: string[];
  tags?: Array<{ name: string; description?: string }>;
  paths: Record<string, Record<string, Operation>>;
  definitions?: Record<string, Schema>;
  components?: { schemas?: Record<string, Schema>; securitySchemes?: Record<string, any> };
  securityDefinitions?: Record<string, any>;
}

export interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: any[];
  responses?: Record<string, any>;
  security?: any[];
  [k: string]: any;
}

export type Schema = Record<string, any>;

const DEFAULT_SWAGGER_URL = "https://enforcer-v2-prod.instruxi.dev/swagger/doc.json";
const FETCH_TIMEOUT_MS = 10_000;

let cached: SwaggerSpec | null = null;

export async function loadSwagger(): Promise<SwaggerSpec> {
  if (cached) return cached;

  const url = process.env.ENFORCER_SWAGGER_URL || DEFAULT_SWAGGER_URL;
  const useEmbedded = process.env.ENFORCER_USE_EMBEDDED === "1";

  if (!useEmbedded) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        cached = (await res.json()) as SwaggerSpec;
        return cached;
      }
      console.error(`[enforcer-docs-mcp] swagger fetch ${url} returned ${res.status}, falling back to embedded`);
    } catch (err) {
      console.error(`[enforcer-docs-mcp] swagger fetch ${url} failed: ${err instanceof Error ? err.message : err}, falling back to embedded`);
    }
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const embeddedPath = resolve(here, "..", "swagger.json");
  const raw = await readFile(embeddedPath, "utf8");
  cached = JSON.parse(raw) as SwaggerSpec;
  return cached;
}

export function resolveRef(spec: SwaggerSpec, ref: string): Schema | null {
  const parts = ref.replace(/^#\//, "").split("/");
  let node: any = spec;
  for (const p of parts) {
    if (node == null) return null;
    node = node[p];
  }
  return node ?? null;
}

export function inlineRefs(spec: SwaggerSpec, node: any, depth = 2, seen = new Set<string>()): any {
  if (node == null || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => inlineRefs(spec, n, depth, seen));
  if (typeof node.$ref === "string") {
    if (depth <= 0 || seen.has(node.$ref)) return node;
    const resolved = resolveRef(spec, node.$ref);
    if (!resolved) return node;
    const next = new Set(seen);
    next.add(node.$ref);
    return inlineRefs(spec, resolved, depth - 1, next);
  }
  const out: any = {};
  for (const [k, v] of Object.entries(node)) out[k] = inlineRefs(spec, v, depth, seen);
  return out;
}

export function listOperations(spec: SwaggerSpec): Array<{
  operationId: string;
  method: string;
  path: string;
  summary?: string;
  tags: string[];
}> {
  const out: Array<{ operationId: string; method: string; path: string; summary?: string; tags: string[] }> = [];
  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(methods)) {
      if (!["get", "post", "put", "delete", "patch", "options", "head"].includes(method.toLowerCase())) continue;
      const operationId = op.operationId || `${method.toUpperCase()} ${path}`;
      out.push({
        operationId,
        method: method.toUpperCase(),
        path,
        summary: op.summary,
        tags: op.tags || [],
      });
    }
  }
  return out;
}

export function findOperation(spec: SwaggerSpec, operationId: string): { method: string; path: string; op: Operation } | null {
  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(methods)) {
      const opId = op.operationId || `${method.toUpperCase()} ${path}`;
      if (opId === operationId) return { method: method.toUpperCase(), path, op };
    }
  }
  return null;
}

export function getSchemas(spec: SwaggerSpec): Record<string, Schema> {
  return spec.definitions || spec.components?.schemas || {};
}

export function getSecuritySchemes(spec: SwaggerSpec): Record<string, any> {
  return spec.securityDefinitions || spec.components?.securitySchemes || {};
}
