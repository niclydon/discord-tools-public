import pino from "pino";
import { loadConfig } from "./config.js";
import { EventLog } from "./event-log.js";
import { RouteStore } from "./routes.js";
import { startBot } from "./bot.js";
import { startHealthServer } from "./health.js";
import type { AppContext } from "./types.js";

const config = loadConfig();
const logger = pino({ level: config.LOG_LEVEL });
const routes = new RouteStore(config.ROUTES_FILE);
await routes.load();

const ctx: AppContext = {
  config,
  logger,
  routes,
  eventLog: new EventLog(config.EVENT_LOG_PATH),
  shuttingDown: false,
  inFlight: new Set(),
  seenEvents: new Set(),
  startedAt: new Date()
};

const healthServer = await startHealthServer(ctx);
ctx.discordClient = startBot(ctx);

logger.info({ port: config.PORT, routes: routes.status() }, "discord gateway started");

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

async function shutdown(signal: string): Promise<void> {
  if (ctx.shuttingDown) return;
  ctx.shuttingDown = true;
  logger.info({ signal, in_flight: ctx.inFlight.size }, "shutdown requested");
  await Promise.race([
    Promise.allSettled([...ctx.inFlight]),
    new Promise((resolve) => setTimeout(resolve, 30_000))
  ]);
  await Promise.allSettled([
    healthServer.close(),
    ctx.discordClient?.destroy()
  ]);
  logger.info("shutdown complete");
  process.exit(0);
}
