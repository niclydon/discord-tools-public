import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installMockFetch, type MockFetchHandle } from "../helpers/mock-fetch.ts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DiscordClient } from "../../src/discord/client.ts";
import { Resolver } from "../../src/discord/resolve.ts";
import { registerMessages } from "../../src/tools/messages.ts";

const GUILD = "100";
let mock: MockFetchHandle;

function makeServer() {
  const server = new McpServer({ name: "t", version: "0.0.1" });
  const client = new DiscordClient({ token: "x", version: "0.0.1" });
  const resolver = new Resolver(client, GUILD);
  registerMessages(server, { client, resolver, guildId: GUILD, version: "0.0.1" });
  return server;
}

beforeEach(() => (mock = installMockFetch()));
afterEach(() => mock.restore());

function getTool(s: McpServer, n: string): any {
  const reg = (s as any)._registeredTools ?? (s as any).tools;
  return reg[n];
}

describe("tools/messages", () => {
  it("post_message resolves channel name and posts", async () => {
    mock.enqueue({
      status: 200,
      body: [{ id: "C1", name: "alerts", type: 0 }]
    });
    mock.enqueue({
      status: 200,
      body: { id: "M1", channel_id: "C1" }
    });
    const s = makeServer();
    const out = await getTool(s, "discord_post_message").handler({
      channel: "alerts",
      content: "hello"
    });
    expect(mock.recorded[1].url).toContain("/channels/C1/messages");
    expect(out.content[0].text).toContain("M1");
  });

  it("post_embed maps priority → color", async () => {
    mock.enqueue({
      status: 200,
      body: [{ id: "C1", name: "alerts", type: 0 }]
    });
    mock.enqueue({ status: 200, body: { id: "M2" } });
    const s = makeServer();
    await getTool(s, "discord_post_embed").handler({
      channel: "alerts",
      title: "boom",
      body: "down",
      priority: "critical"
    });
    const sent = JSON.parse(mock.recorded[1].body!);
    expect(sent.embeds[0].color).toBe(15158332);
  });

  it("post_message surfaces 403 hint", async () => {
    mock.enqueue({
      status: 200,
      body: [{ id: "C1", name: "alerts", type: 0 }]
    });
    mock.enqueue({
      status: 403,
      body: { code: 50013, message: "Missing Permissions" }
    });
    const s = makeServer();
    const out = await getTool(s, "discord_post_message").handler({
      channel: "alerts",
      content: "x"
    });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toMatch(/permissions/i);
  });

  it("post_message chunks content > 2000 chars", async () => {
    mock.enqueue({
      status: 200,
      body: [{ id: "C1", name: "alerts", type: 0 }]
    });
    mock.enqueue({ status: 200, body: { id: "M1" } });
    mock.enqueue({ status: 200, body: { id: "M2" } });
    const s = makeServer();
    const out = await getTool(s, "discord_post_message").handler({
      channel: "alerts",
      content: "x".repeat(3500)
    });
    expect(mock.recorded.filter((r) => r.method === "POST").length).toBe(2);
    expect(out.content[0].text).toMatch(/M1[\s\S]*M2/);
  });

  it("search_messages paginates and filters", async () => {
    mock.enqueue({
      status: 200,
      body: [{ id: "C1", name: "alerts", type: 0 }]
    });
    mock.enqueue({
      status: 200,
      body: [
        { id: "1", content: "foo bar", author: { id: "u" } },
        { id: "2", content: "no match", author: { id: "u" } }
      ]
    });
    mock.enqueue({ status: 200, body: [] });
    const s = makeServer();
    const out = await getTool(s, "discord_search_messages").handler({
      channel: "alerts",
      query: "foo",
      max_pages: 3
    });
    expect(out.content[0].text).toContain('"id": "1"');
    expect(out.content[0].text).not.toContain('"id": "2"');
  });
});
