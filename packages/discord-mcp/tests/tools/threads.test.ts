import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installMockFetch, type MockFetchHandle } from "../helpers/mock-fetch.ts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DiscordClient } from "../../src/discord/client.ts";
import { Resolver } from "../../src/discord/resolve.ts";
import { registerThreads } from "../../src/tools/threads.ts";

const GUILD = "100";
let mock: MockFetchHandle;

function makeServer() {
  const server = new McpServer({ name: "t", version: "0.0.1" });
  const client = new DiscordClient({ token: "x", version: "0.0.1" });
  const resolver = new Resolver(client, GUILD);
  registerThreads(server, { client, resolver, guildId: GUILD, version: "0.0.1" });
  return server;
}

beforeEach(() => (mock = installMockFetch()));
afterEach(() => mock.restore());

function getTool(s: McpServer, n: string): any {
  const reg = (s as any)._registeredTools ?? (s as any).tools;
  return reg[n];
}

describe("tools/threads", () => {
  it("create_forum_post sends initial message payload to forum threads endpoint", async () => {
    mock.enqueue({ status: 200, body: [{ id: "F1", name: "stones", type: 15 }] });
    mock.enqueue({
      status: 200,
      body: { id: "T9", name: "stone", message: { id: "M9" } }
    });
    const s = makeServer();
    const out = await getTool(s, "discord_create_forum_post").handler({
      forum: "stones",
      name: "stone",
      content: "hello",
      auto_archive_minutes: 1440
    });
    expect(mock.recorded[1].url).toMatch(/\/channels\/F1\/threads$/);
    const sent = JSON.parse(mock.recorded[1].body!);
    expect(sent.message.content).toBe("hello");
    expect(sent.auto_archive_duration).toBe(1440);
    expect(out.content[0].text).toContain('"thread_id": "T9"');
    expect(out.content[0].text).toContain('"message_id": "M9"');
  });

  it("create_forum_post supports embeds", async () => {
    mock.enqueue({ status: 200, body: [{ id: "F1", name: "checks", type: 15 }] });
    mock.enqueue({
      status: 200,
      body: { id: "T10", name: "check", message: { id: "M10" } }
    });
    const s = makeServer();
    await getTool(s, "discord_create_forum_post").handler({
      forum: "checks",
      name: "check",
      title: "Fact Check",
      body: "Claim: x",
      priority: "critical"
    });
    const sent = JSON.parse(mock.recorded[1].body!);
    expect(sent.message.embeds[0].title).toBe("Fact Check");
    expect(sent.message.embeds[0].color).toBe(15158332);
  });

  it("create_forum_post passes message components through", async () => {
    mock.enqueue({ status: 200, body: [{ id: "F1", name: "timeline", type: 15 }] });
    mock.enqueue({
      status: 200,
      body: { id: "T11", name: "timeline card", message: { id: "M11" } }
    });
    const components = [{
      type: 1,
      components: [
        { type: 2, custom_id: "life_timeline:v1:e-1:confirm", label: "Confirm", style: 3 }
      ]
    }];
    const s = makeServer();
    await getTool(s, "discord_create_forum_post").handler({
      forum: "timeline",
      name: "timeline card",
      body: "Card body",
      components
    });
    const sent = JSON.parse(mock.recorded[1].body!);
    expect(sent.message.components).toEqual(components);
  });

  it("create_forum_post uploads base64 files as multipart attachments", async () => {
    mock.enqueue({ status: 200, body: [{ id: "F1", name: "timeline", type: 15 }] });
    mock.enqueue({
      status: 200,
      body: { id: "T12", name: "timeline card", message: { id: "M12" } }
    });
    const s = makeServer();
    const out = await getTool(s, "discord_create_forum_post").handler({
      forum: "timeline",
      name: "timeline card",
      body: "Card body",
      files: [
        {
          filename: "photo-1.jpg",
          data_base64: Buffer.from([10, 20, 30]).toString("base64"),
          content_type: "image/jpeg"
        }
      ]
    });
    const form = mock.recorded[1].body as unknown as FormData;
    expect(form).toBeInstanceOf(FormData);
    const payload = JSON.parse(form.get("payload_json") as string);
    expect(payload.message.attachments).toEqual([{ id: 0, filename: "photo-1.jpg" }]);
    expect(payload.message.embeds[0].description).toBe("Card body");
    const file = form.get("files[0]") as File;
    expect(file.name).toBe("photo-1.jpg");
    expect(file.type).toBe("image/jpeg");
    expect(await file.arrayBuffer().then((b) => [...new Uint8Array(b)])).toEqual([10, 20, 30]);
    expect(out.content[0].text).toContain('"thread_id": "T12"');
  });

  it("create_forum_post allows files with no content or body", async () => {
    mock.enqueue({ status: 200, body: [{ id: "F1", name: "timeline", type: 15 }] });
    mock.enqueue({ status: 200, body: { id: "T13", message: { id: "M13" } } });
    const s = makeServer();
    const out = await getTool(s, "discord_create_forum_post").handler({
      forum: "timeline",
      name: "photo only",
      files: [{ filename: "p.jpg", data_base64: Buffer.from([1]).toString("base64") }]
    });
    expect(out.isError).toBeFalsy();
  });

  it("create_thread without message_id uses /threads", async () => {
    mock.enqueue({ status: 200, body: [{ id: "C1", name: "alerts", type: 0 }] });
    mock.enqueue({ status: 200, body: { id: "T1", name: "discussion" } });
    const s = makeServer();
    await getTool(s, "discord_create_thread").handler({
      channel: "alerts",
      name: "discussion",
      auto_archive_minutes: 60
    });
    expect(mock.recorded[1].url).toMatch(/\/channels\/C1\/threads$/);
  });

  it("create_thread with message_id uses /messages/{id}/threads", async () => {
    mock.enqueue({ status: 200, body: [{ id: "C1", name: "alerts", type: 0 }] });
    mock.enqueue({ status: 200, body: { id: "T2" } });
    const s = makeServer();
    await getTool(s, "discord_create_thread").handler({
      channel: "alerts",
      name: "spawn",
      message_id: "9999"
    });
    expect(mock.recorded[1].url).toMatch(
      /\/channels\/C1\/messages\/9999\/threads$/
    );
  });

  it("list_threads filters active guild threads to the requested parent channel", async () => {
    mock.enqueue({ status: 200, body: [{ id: "F1", name: "stones", type: 15 }] });
    mock.enqueue({
      status: 200,
      body: {
        threads: [
          { id: "T1", name: "stone", parent_id: "F1" },
          { id: "T2", name: "general", parent_id: "C9" }
        ],
        members: [
          { id: "T1", user_id: "U1" },
          { id: "T2", user_id: "U1" }
        ],
        has_more: false
      }
    });
    const s = makeServer();
    const out = await getTool(s, "discord_list_threads").handler({
      channel: "stones"
    });
    const parsed = JSON.parse(out.content[0].text);
    expect(mock.recorded[1].url).toMatch(/\/guilds\/100\/threads\/active$/);
    expect(parsed.threads).toEqual([{ id: "T1", name: "stone", parent_id: "F1" }]);
    expect(parsed.members).toEqual([{ id: "T1", user_id: "U1" }]);
  });

  it("list_threads keeps archived lookup on the requested channel endpoint", async () => {
    mock.enqueue({ status: 200, body: [{ id: "F1", name: "stones", type: 15 }] });
    mock.enqueue({ status: 200, body: { threads: [], members: [], has_more: false } });
    const s = makeServer();
    await getTool(s, "discord_list_threads").handler({
      channel: "stones",
      archived: true
    });
    expect(mock.recorded[1].url).toMatch(
      /\/channels\/F1\/threads\/archived\/public$/
    );
  });

  it("archive_thread sends archived=true", async () => {
    mock.enqueue({ status: 200, body: { id: "T3", archived: true } });
    const s = makeServer();
    await getTool(s, "discord_archive_thread").handler({ thread: "555" });
    const sent = JSON.parse(mock.recorded[0].body!);
    expect(sent.archived).toBe(true);
  });
});
