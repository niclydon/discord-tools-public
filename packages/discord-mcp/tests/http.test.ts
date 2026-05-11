import { describe, it, expect, afterEach } from "vitest";
import type { Server } from "http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { startHttp } from "../src/http.ts";

let server: Server;

afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

describe("HTTP transport + X-Origin-Secret guard", () => {
  it("/health responds 200 without secret", async () => {
    server = await startHttp({
      port: 0,
      originSharedSecret: "shh",
      version: "0.0.1",
      serverFactory: () => new McpServer({ name: "t", version: "0.0.1" })
    });
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    const r = await fetch(`http://127.0.0.1:${port}/health`);
    expect(r.status).toBe(200);
  });

  it("MCP root rejects without secret", async () => {
    server = await startHttp({
      port: 0,
      originSharedSecret: "shh",
      version: "0.0.1",
      serverFactory: () => new McpServer({ name: "t", version: "0.0.1" })
    });
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    const r = await fetch(`http://127.0.0.1:${port}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })
    });
    expect(r.status).toBe(401);
  });

  it("passthrough when secret unset", async () => {
    server = await startHttp({
      port: 0,
      version: "0.0.1",
      serverFactory: () => new McpServer({ name: "t", version: "0.0.1" })
    });
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    const r = await fetch(`http://127.0.0.1:${port}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "t", version: "0" }
        }
      })
    });
    expect(r.status).toBe(200);
  });
});
