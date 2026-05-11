import express, { type Request, type Response, type NextFunction } from "express";
import type { Server } from "http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { log } from "./log.ts";

export interface HttpServerOptions {
  port: number;
  originSharedSecret?: string;
  serverFactory: () => McpServer;
  version: string;
}

export function startHttp(opts: HttpServerOptions): Promise<Server> {
  return new Promise((resolve) => {
    const app = express();
    app.use(express.json({ limit: "4mb" }));

    app.get("/health", (_req, res) => {
      res.json({
        status: "ok",
        server: "discord-mcp",
        version: opts.version
      });
    });

    if (opts.originSharedSecret) {
      log("info", "X-Origin-Secret guard enabled");
      const guard = (req: Request, res: Response, next: NextFunction): void => {
        if (req.path === "/health") {
          next();
          return;
        }
        if (req.header("x-origin-secret") !== opts.originSharedSecret) {
          res.status(401).json({ error: "unauthorized" });
          return;
        }
        next();
      };
      app.use(guard);
    } else {
      log("warn", "X-Origin-Secret guard DISABLED (ORIGIN_SHARED_SECRET unset)");
    }

    app.post("/", async (req: Request, res: Response) => {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined
      });
      const server = opts.serverFactory();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    });

    const srv = app.listen(opts.port, "127.0.0.1", () => {
      log("info", `discord-mcp http listening on 127.0.0.1:${opts.port}`);
      resolve(srv);
    });
  });
}
