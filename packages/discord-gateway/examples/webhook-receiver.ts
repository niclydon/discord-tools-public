import fastify from "fastify";

const app = fastify({ logger: true });

app.post("/discord-events", async (request, reply) => {
  request.log.info({ event: request.body }, "received discord gateway event");
  return reply.send({ ok: true });
});

await app.listen({ host: "127.0.0.1", port: 8788 });
