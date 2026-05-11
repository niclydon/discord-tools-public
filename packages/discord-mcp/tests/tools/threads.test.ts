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

  it("archive_thread sends archived=true", async () => {
    mock.enqueue({ status: 200, body: { id: "T3", archived: true } });
    const s = makeServer();
    await getTool(s, "discord_archive_thread").handler({ thread: "555" });
    const sent = JSON.parse(mock.recorded[0].body!);
    expect(sent.archived).toBe(true);
  });
});
