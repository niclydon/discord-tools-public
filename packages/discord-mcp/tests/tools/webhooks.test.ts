import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installMockFetch, type MockFetchHandle } from "../helpers/mock-fetch.ts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DiscordClient } from "../../src/discord/client.ts";
import { Resolver } from "../../src/discord/resolve.ts";
import { registerWebhooks } from "../../src/tools/webhooks.ts";

const GUILD = "100";
let mock: MockFetchHandle;

function makeServer() {
  const server = new McpServer({ name: "t", version: "0.0.1" });
  const client = new DiscordClient({ token: "x", version: "0.0.1" });
  const resolver = new Resolver(client, GUILD);
  registerWebhooks(server, { client, resolver, guildId: GUILD, version: "0.0.1" });
  return server;
}

beforeEach(() => (mock = installMockFetch()));
afterEach(() => mock.restore());

function getTool(s: McpServer, n: string): any {
  const reg = (s as any)._registeredTools ?? (s as any).tools;
  return reg[n];
}

describe("tools/webhooks", () => {
  it("create_webhook posts to /channels/{id}/webhooks", async () => {
    mock.enqueue({ status: 200, body: [{ id: "C1", name: "alerts", type: 0 }] });
    mock.enqueue({ status: 200, body: { id: "W1", name: "example-bot" } });
    const s = makeServer();
    await getTool(s, "discord_create_webhook").handler({
      channel: "alerts",
      name: "example-bot"
    });
    expect(mock.recorded[1].method).toBe("POST");
    expect(mock.recorded[1].url).toMatch(/\/channels\/C1\/webhooks$/);
  });

  it("post_via_webhook embeds priority color", async () => {
    mock.enqueue({ status: 204 });
    const s = makeServer();
    await getTool(s, "discord_post_via_webhook").handler({
      webhook_url: "https://discord.com/api/webhooks/W1/TOKEN",
      username: "HF Scout",
      title: "ok",
      body: "fine",
      priority: "high"
    });
    const sent = JSON.parse(mock.recorded[0].body!);
    expect(sent.embeds[0].color).toBe(15105570);
    expect(sent.username).toBe("HF Scout");
  });
});
