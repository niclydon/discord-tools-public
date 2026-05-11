/**
 * Live smoke test against the configured bot and guild.
 * Run after configuration: `npm run smoke`.
 *
 * Sequence: post → fetch → edit → react → unreact → delete.
 */
import { loadEnv } from "../src/env.ts";
import { DiscordClient } from "../src/discord/client.ts";
import { Resolver } from "../src/discord/resolve.ts";

const SAFE_CHANNEL = process.env.SMOKE_CHANNEL ?? "bot-lab";

async function main() {
  const env = loadEnv();
  const client = new DiscordClient({
    token: env.discordBotToken,
    version: "0.1.0-smoke"
  });
  const resolver = new Resolver(client, env.discordGuildId);
  const id = await resolver.channelId(SAFE_CHANNEL);
  console.log(`[smoke] using #${SAFE_CHANNEL} = ${id}`);

  const post = await client.request<{ id: string }>(
    "POST",
    `/channels/${id}/messages`,
    { body: { content: "🧪 discord-mcp smoke" } }
  );
  console.log(`[smoke] posted ${post.id}`);

  const fetched = await client.request<Array<{ id: string }>>(
    "GET",
    `/channels/${id}/messages`,
    { query: { limit: 5 } }
  );
  console.log(`[smoke] fetched ${fetched.length} recent messages`);

  await client.request("PATCH", `/channels/${id}/messages/${post.id}`, {
    body: { content: "🧪 discord-mcp smoke — edited" }
  });
  console.log("[smoke] edited");

  await client.request(
    "PUT",
    `/channels/${id}/messages/${post.id}/reactions/${encodeURIComponent("👋")}/@me`
  );
  console.log("[smoke] reacted 👋");

  await client.request(
    "DELETE",
    `/channels/${id}/messages/${post.id}/reactions/${encodeURIComponent("👋")}/@me`
  );
  console.log("[smoke] unreacted");

  await client.request("DELETE", `/channels/${id}/messages/${post.id}`, {
    reason: "smoke test cleanup"
  });
  console.log("[smoke] deleted — all good");
}

main().catch((e) => {
  console.error("[smoke] FAILED:", e);
  process.exit(1);
});
