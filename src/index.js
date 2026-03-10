import "dotenv/config";
import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE_URL = process.env.API_BASE_URL;
const FIGMA_BASE_URL = process.env.FIGMA_BASE_URL || "https://api.figma.com/";
const API_KEY = process.env.API_KEY;
const MCP_TRANSPORT = process.env.MCP_TRANSPORT || "http";
const PORT = Number(process.env.PORT || 3006);
const MCP_PATH = process.env.MCP_PATH || "/mcp";

if (!API_BASE_URL || !API_KEY) {
  console.error("Missing API_BASE_URL or API_KEY in environment.");
  process.exit(1);
}

function createMcpServer() {
  const server = new McpServer({
    name: "custom-api-mcp",
    version: "1.0.0",
    capabilities: {
      tools: {}
    }
  });

  server.tool(
    "api_get",
    "Call external API with GET method",
    {
      path: z.string().describe("API path, e.g. /users or /posts/1"),
      query: z.record(z.string()).optional().describe("Query params as key-value pairs")
    },
    async ({ path, query }) => {
      const url = new URL(path, API_BASE_URL);
      if (query) {
        Object.entries(query).forEach(([k, v]) => {
          url.searchParams.set(k, v);
        });
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: buildHeaders(url)
      });

      const text = await response.text();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ok: response.ok,
                status: response.status,
                url: url.toString(),
                body: safeJson(text)
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  server.tool(
    "api_post",
    "Call external API with POST method",
    {
      path: z.string().describe("API path, e.g. /messages"),
      payload: z.record(z.any()).describe("JSON payload to send")
    },
    async ({ path, payload }) => {
      const url = new URL(path, API_BASE_URL);

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: buildHeaders(url),
        body: JSON.stringify(payload)
      });

      const text = await response.text();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ok: response.ok,
                status: response.status,
                url: url.toString(),
                body: safeJson(text)
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  server.tool(
    "figma_get_file",
    "Get Figma file document and metadata",
    {
      file_key: z.string().describe("Figma file key"),
      version: z.string().optional().describe("Optional file version id"),
      ids: z.array(z.string()).optional().describe("Optional node ids"),
      depth: z.number().int().positive().optional().describe("Optional tree depth"),
      geometry: z.enum(["paths"]).optional().describe("Set paths to include geometry"),
      plugin_data: z.string().optional().describe("Plugin id(s), comma separated"),
      branch_data: z.boolean().optional().describe("Include branch metadata")
    },
    async ({ file_key, version, ids, depth, geometry, plugin_data, branch_data }) => {
      const query = {
        ...(version ? { version } : {}),
        ...(ids?.length ? { ids: ids.join(",") } : {}),
        ...(depth ? { depth: String(depth) } : {}),
        ...(geometry ? { geometry } : {}),
        ...(plugin_data ? { plugin_data } : {}),
        ...(branch_data !== undefined ? { branch_data: String(branch_data) } : {})
      };

      return callApi({
        method: "GET",
        baseUrl: FIGMA_BASE_URL,
        path: `/v1/files/${file_key}`,
        query
      });
    }
  );

  server.tool(
    "figma_get_file_nodes",
    "Get specific nodes in a Figma file",
    {
      file_key: z.string().describe("Figma file key"),
      node_ids: z.array(z.string()).min(1).describe("Node IDs"),
      depth: z.number().int().positive().optional().describe("Optional tree depth"),
      geometry: z.enum(["paths"]).optional().describe("Set paths to include geometry"),
      plugin_data: z.string().optional().describe("Plugin id(s), comma separated")
    },
    async ({ file_key, node_ids, depth, geometry, plugin_data }) => {
      const query = {
        ids: node_ids.join(","),
        ...(depth ? { depth: String(depth) } : {}),
        ...(geometry ? { geometry } : {}),
        ...(plugin_data ? { plugin_data } : {})
      };

      return callApi({
        method: "GET",
        baseUrl: FIGMA_BASE_URL,
        path: `/v1/files/${file_key}/nodes`,
        query
      });
    }
  );

  server.tool(
    "figma_get_images",
    "Render Figma nodes into image URLs",
    {
      file_key: z.string().describe("Figma file key"),
      node_ids: z.array(z.string()).min(1).describe("Node IDs"),
      format: z.enum(["jpg", "png", "svg", "pdf"]).optional().describe("Image format"),
      scale: z.number().positive().max(4).optional().describe("Scale from 0.01 to 4"),
      use_absolute_bounds: z.boolean().optional(),
      version: z.string().optional(),
      svg_outline_text: z.boolean().optional(),
      svg_include_id: z.boolean().optional(),
      svg_simplify_stroke: z.boolean().optional()
    },
    async ({
      file_key,
      node_ids,
      format,
      scale,
      use_absolute_bounds,
      version,
      svg_outline_text,
      svg_include_id,
      svg_simplify_stroke
    }) => {
      const query = {
        ids: node_ids.join(","),
        ...(format ? { format } : {}),
        ...(scale ? { scale: String(scale) } : {}),
        ...(use_absolute_bounds !== undefined ? { use_absolute_bounds: String(use_absolute_bounds) } : {}),
        ...(version ? { version } : {}),
        ...(svg_outline_text !== undefined ? { svg_outline_text: String(svg_outline_text) } : {}),
        ...(svg_include_id !== undefined ? { svg_include_id: String(svg_include_id) } : {}),
        ...(svg_simplify_stroke !== undefined ? { svg_simplify_stroke: String(svg_simplify_stroke) } : {})
      };

      return callApi({
        method: "GET",
        baseUrl: FIGMA_BASE_URL,
        path: `/v1/images/${file_key}`,
        query
      });
    }
  );

  server.tool(
    "figma_get_comments",
    "Get comments in a Figma file",
    {
      file_key: z.string().describe("Figma file key"),
      as_md: z.boolean().optional().describe("Return markdown comments when true")
    },
    async ({ file_key, as_md }) => {
      const query = {
        ...(as_md !== undefined ? { as_md: String(as_md) } : {})
      };

      return callApi({
        method: "GET",
        baseUrl: FIGMA_BASE_URL,
        path: `/v1/files/${file_key}/comments`,
        query
      });
    }
  );

  server.tool(
    "figma_post_comment",
    "Post a comment to a Figma file",
    {
      file_key: z.string().describe("Figma file key"),
      message: z.string().describe("Comment message"),
      client_meta: z.record(z.any()).optional().describe("Client position metadata")
    },
    async ({ file_key, message, client_meta }) => {
      const payload = {
        message,
        ...(client_meta ? { client_meta } : {})
      };

      return callApi({
        method: "POST",
        baseUrl: FIGMA_BASE_URL,
        path: `/v1/files/${file_key}/comments`,
        payload
      });
    }
  );

  server.tool(
    "figma_get_versions",
    "Get version history for a Figma file",
    {
      file_key: z.string().describe("Figma file key"),
      page_size: z.number().int().positive().max(100).optional(),
      before: z.string().optional(),
      after: z.string().optional()
    },
    async ({ file_key, page_size, before, after }) => {
      const query = {
        ...(page_size ? { page_size: String(page_size) } : {}),
        ...(before ? { before } : {}),
        ...(after ? { after } : {})
      };

      return callApi({
        method: "GET",
        baseUrl: FIGMA_BASE_URL,
        path: `/v1/files/${file_key}/versions`,
        query
      });
    }
  );

  server.tool(
    "figma_get_team_projects",
    "List projects in a Figma team",
    {
      team_id: z.string().describe("Figma team id")
    },
    async ({ team_id }) => {
      return callApi({
        method: "GET",
        baseUrl: FIGMA_BASE_URL,
        path: `/v1/teams/${team_id}/projects`
      });
    }
  );

  server.tool(
    "figma_get_project_files",
    "List files in a Figma project",
    {
      project_id: z.string().describe("Figma project id"),
      branch_data: z.boolean().optional().describe("Include branch metadata")
    },
    async ({ project_id, branch_data }) => {
      const query = {
        ...(branch_data !== undefined ? { branch_data: String(branch_data) } : {})
      };

      return callApi({
        method: "GET",
        baseUrl: FIGMA_BASE_URL,
        path: `/v1/projects/${project_id}/files`,
        query
      });
    }
  );

  return server;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function buildHeaders(url) {
  const headers = {
    "Content-Type": "application/json"
  };

  if (url.hostname === "api.figma.com" || url.hostname.endsWith(".figma.com")) {
    headers["X-Figma-Token"] = API_KEY;
  } else {
    headers.Authorization = `Bearer ${API_KEY}`;
  }

  return headers;
}

async function callApi({ method, baseUrl = API_BASE_URL, path, query, payload }) {
  const url = new URL(path, baseUrl);

  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    });
  }

  const response = await fetch(url.toString(), {
    method,
    headers: buildHeaders(url),
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {})
  });

  const text = await response.text();
  return formatApiResult(response, url.toString(), text);
}

function formatApiResult(response, url, text) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            ok: response.ok,
            status: response.status,
            url,
            body: safeJson(text)
          },
          null,
          2
        )
      }
    ]
  };
}

if (MCP_TRANSPORT === "stdio") {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP server is running in stdio mode.");
} else {
  startHttpServer();
}

function startHttpServer() {
  const httpServer = createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

      if (requestUrl.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (requestUrl.pathname !== MCP_PATH) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not Found" }));
        return;
      }

      if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Method not allowed."
            },
            id: null
          })
        );
        return;
      }

      const parsedBody = await readJsonBody(req);
      const mcpServer = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined
      });

      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, parsedBody);

      res.on("close", () => {
        transport.close().catch(() => {});
        mcpServer.close().catch(() => {});
      });
    } catch (error) {
      console.error("Error handling request:", error);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null
          })
        );
      }
    }
  });

  httpServer.listen(PORT, () => {
    console.error(`MCP HTTP server listening on http://0.0.0.0:${PORT}${MCP_PATH}`);
  });
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8").trim();
  if (!rawBody) {
    return undefined;
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error("Invalid JSON body");
  }
}
