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

  it("post_embed uses explicit color when provided (overrides priority)", async () => {
    mock.enqueue({
      status: 200,
      body: [{ id: "C1", name: "alerts", type: 0 }]
    });
    mock.enqueue({ status: 200, body: { id: "M5" } });
    const s = makeServer();
    await getTool(s, "discord_post_embed").handler({
      channel: "alerts",
      title: "tier",
      body: "branded",
      priority: "critical",
      color: 0x5865f2
    });
    const sent = JSON.parse(mock.recorded[1].body!);
    expect(sent.embeds[0].color).toBe(0x5865f2);
  });

  it("post_embed falls back to priority color when color is absent", async () => {
    mock.enqueue({
      status: 200,
      body: [{ id: "C1", name: "alerts", type: 0 }]
    });
    mock.enqueue({ status: 200, body: { id: "M6" } });
    const s = makeServer();
    await getTool(s, "discord_post_embed").handler({
      channel: "alerts",
      title: "ok",
      body: "high prio",
      priority: "high"
    });
    const sent = JSON.parse(mock.recorded[1].body!);
    expect(sent.embeds[0].color).toBe(15105570);
  });

  it("post_embed defaults to the default color when neither color nor priority given", async () => {
    mock.enqueue({
      status: 200,
      body: [{ id: "C1", name: "alerts", type: 0 }]
    });
    mock.enqueue({ status: 200, body: { id: "M7" } });
    const s = makeServer();
    await getTool(s, "discord_post_embed").handler({
      channel: "alerts",
      title: "plain",
      body: "no color, no priority"
    });
    const sent = JSON.parse(mock.recorded[1].body!);
    expect(sent.embeds[0].color).toBe(3447003);
  });

  it("post_embed sets message_reference when reply_to is provided", async () => {
    mock.enqueue({
      status: 200,
      body: [{ id: "C1", name: "alerts", type: 0 }]
    });
    mock.enqueue({ status: 200, body: { id: "M8" } });
    const s = makeServer();
    await getTool(s, "discord_post_embed").handler({
      channel: "alerts",
      title: "card",
      body: "under head msg",
      reply_to: "9999"
    });
    const sent = JSON.parse(mock.recorded[1].body!);
    expect(sent.message_reference).toEqual({ message_id: "9999" });
  });

  it("post_embed omits message_reference when reply_to is absent", async () => {
    mock.enqueue({
      status: 200,
      body: [{ id: "C1", name: "alerts", type: 0 }]
    });
    mock.enqueue({ status: 200, body: { id: "M9" } });
    const s = makeServer();
    await getTool(s, "discord_post_embed").handler({
      channel: "alerts",
      title: "card",
      body: "standalone"
    });
    const sent = JSON.parse(mock.recorded[1].body!);
    expect(sent.message_reference).toBeUndefined();
  });

  it("post_embed forwards components (button action rows) when provided", async () => {
    mock.enqueue({
      status: 200,
      body: [{ id: "C1", name: "alerts", type: 0 }]
    });
    mock.enqueue({ status: 200, body: { id: "M11" } });
    const s = makeServer();
    const components = [
      {
        type: 1,
        components: [
          { type: 2, style: 3, label: "👍 Useful", custom_id: "insight_feedback:v1:abc:up" },
          { type: 2, style: 4, label: "👎 Not useful", custom_id: "insight_feedback:v1:abc:down" }
        ]
      }
    ];
    await getTool(s, "discord_post_embed").handler({
      channel: "alerts",
      title: "insight",
      body: "rate me",
      components
    });
    const sent = JSON.parse(mock.recorded[1].body!);
    expect(sent.components).toEqual(components);
  });

  it("post_embed omits components when not provided", async () => {
    mock.enqueue({
      status: 200,
      body: [{ id: "C1", name: "alerts", type: 0 }]
    });
    mock.enqueue({ status: 200, body: { id: "M12" } });
    const s = makeServer();
    await getTool(s, "discord_post_embed").handler({
      channel: "alerts",
      title: "insight",
      body: "no buttons"
    });
    const sent = JSON.parse(mock.recorded[1].body!);
    expect(sent.components).toBeUndefined();
  });

  it("post_embed posts into thread_id without resolving the channel name", async () => {
    // Only one queued response: the POST. If the channel resolver had fired it
    // would consume this response and the POST would have no mock left → throw.
    mock.enqueue({ status: 200, body: { id: "M10" } });
    const s = makeServer();
    await getTool(s, "discord_post_embed").handler({
      channel: "alerts",
      title: "in-thread",
      body: "forum card",
      thread_id: "7777"
    });
    expect(mock.recorded.length).toBe(1);
    expect(mock.recorded[0].method).toBe("POST");
    expect(mock.recorded[0].url).toContain("/channels/7777/messages");
  });

  it("post_embed includes footer and timestamp when provided", async () => {
    mock.enqueue({
      status: 200,
      body: [{ id: "C1", name: "alerts", type: 0 }]
    });
    mock.enqueue({ status: 200, body: { id: "M3" } });
    const s = makeServer();
    await getTool(s, "discord_post_embed").handler({
      channel: "alerts",
      title: "deploy",
      body: "v1.2 shipped",
      footer: "example-worker",
      timestamp: "2026-05-12T00:00:00.000Z"
    });
    const sent = JSON.parse(mock.recorded[1].body!);
    expect(sent.embeds[0].footer).toEqual({ text: "example-worker" });
    expect(sent.embeds[0].timestamp).toBe("2026-05-12T00:00:00.000Z");
  });

  it("post_embed omits footer and timestamp when not provided", async () => {
    mock.enqueue({
      status: 200,
      body: [{ id: "C1", name: "alerts", type: 0 }]
    });
    mock.enqueue({ status: 200, body: { id: "M4" } });
    const s = makeServer();
    await getTool(s, "discord_post_embed").handler({
      channel: "alerts",
      title: "ping",
      body: "pong"
    });
    const sent = JSON.parse(mock.recorded[1].body!);
    expect(sent.embeds[0].footer).toBeUndefined();
    expect(sent.embeds[0].timestamp).toBeUndefined();
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
