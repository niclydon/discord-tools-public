import fastify from "fastify";
import type { AppContext } from "./types.js";

export async function startHealthServer(ctx: AppContext) {
  const app = fastify({ logger: false });

  app.get("/health", async () => ({
    ok: true,
    uptime_s: Math.round((Date.now() - ctx.startedAt.getTime()) / 1000),
    bot: {
      ready: ctx.discordClient?.isReady() ?? false,
      user: ctx.discordClient?.user?.tag ?? null,
      latency_ms: ctx.discordClient?.ws.ping ?? null
    },
    routes: ctx.routes.status(),
    in_flight: ctx.inFlight.size
  }));

  await app.listen({ host: "127.0.0.1", port: ctx.config.PORT });
  return app;
}
