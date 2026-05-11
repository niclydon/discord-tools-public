import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installMockFetch, type MockFetchHandle } from "../helpers/mock-fetch.ts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DiscordClient } from "../../src/discord/client.ts";
import { Resolver } from "../../src/discord/resolve.ts";
import { registerChannels } from "../../src/tools/channels.ts";

const GUILD = "100";
let mock: MockFetchHandle;

function makeServer() {
  const server = new McpServer({ name: "t", version: "0.0.1" });
  const client = new DiscordClient({ token: "x", version: "0.0.1" });
  const resolver = new Resolver(client, GUILD);
  registerChannels(server, { client, resolver, guildId: GUILD, version: "0.0.1" });
  return server;
}

beforeEach(() => (mock = installMockFetch()));
afterEach(() => mock.restore());

function getTool(s: McpServer, n: string): any {
  const reg = (s as any)._registeredTools ?? (s as any).tools;
  return reg[n];
}

describe("tools/channels", () => {
  it("create_channel posts to /guilds/{id}/channels", async () => {
    mock.enqueue({ status: 200, body: { id: "C9", name: "test" } });
    const s = makeServer();
    await getTool(s, "discord_create_channel").handler({
      name: "test",
      type: "text"
    });
    expect(mock.recorded[0].url).toMatch(/\/guilds\/100\/channels$/);
    const sent = JSON.parse(mock.recorded[0].body!);
    expect(sent.type).toBe(0);
  });

  it("delete_channel hits DELETE /channels/{id}", async () => {
    mock.enqueue({ status: 200, body: [{ id: "C1", name: "old", type: 0 }] });
    mock.enqueue({ status: 200, body: { id: "C1" } });
    const s = makeServer();
    await getTool(s, "discord_delete_channel").handler({
      channel: "old",
      reason: "cleanup"
    });
    const r = mock.recorded[1];
    expect(r.method).toBe("DELETE");
    expect(r.url).toMatch(/\/channels\/C1$/);
    expect(r.headers["x-audit-log-reason"]).toBe(encodeURIComponent("cleanup"));
  });
});
