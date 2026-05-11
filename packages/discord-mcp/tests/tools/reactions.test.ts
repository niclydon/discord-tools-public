import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installMockFetch, type MockFetchHandle } from "../helpers/mock-fetch.ts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DiscordClient } from "../../src/discord/client.ts";
import { Resolver } from "../../src/discord/resolve.ts";
import { registerReactions } from "../../src/tools/reactions.ts";

const GUILD = "100";
let mock: MockFetchHandle;

function makeServer() {
  const server = new McpServer({ name: "t", version: "0.0.1" });
  const client = new DiscordClient({ token: "x", version: "0.0.1" });
  const resolver = new Resolver(client, GUILD);
  registerReactions(server, { client, resolver, guildId: GUILD, version: "0.0.1" });
  return server;
}

beforeEach(() => (mock = installMockFetch()));
afterEach(() => mock.restore());

function getTool(s: McpServer, n: string): any {
  const reg = (s as any)._registeredTools ?? (s as any).tools;
  return reg[n];
}

describe("tools/reactions", () => {
  it("add_reaction URL-encodes unicode emoji", async () => {
    mock.enqueue({ status: 200, body: [{ id: "C1", name: "alerts", type: 0 }] });
    mock.enqueue({ status: 204 });
    const s = makeServer();
    await getTool(s, "discord_add_reaction").handler({
      channel: "alerts",
      message_id: "9",
      emoji: "👍"
    });
    expect(mock.recorded[1].url).toContain(encodeURIComponent("👍"));
    expect(mock.recorded[1].url).toContain("/reactions/");
    expect(mock.recorded[1].url).toContain("/@me");
  });

  it("add_reaction passes custom emoji as-is when name:id form", async () => {
    mock.enqueue({ status: 200, body: [{ id: "C1", name: "alerts", type: 0 }] });
    mock.enqueue({ status: 204 });
    const s = makeServer();
    await getTool(s, "discord_add_reaction").handler({
      channel: "alerts",
      message_id: "9",
      emoji: "<:cool:12345>"
    });
    expect(mock.recorded[1].url).toContain(encodeURIComponent("cool:12345"));
  });
});
