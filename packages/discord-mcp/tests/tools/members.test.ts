import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { installMockFetch, type MockFetchHandle } from "../helpers/mock-fetch.ts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DiscordClient } from "../../src/discord/client.ts";
import { Resolver } from "../../src/discord/resolve.ts";
import { registerMembers } from "../../src/tools/members.ts";

const GUILD = "100";
let mock: MockFetchHandle;

function makeServer() {
  const server = new McpServer({ name: "t", version: "0.0.1" });
  const client = new DiscordClient({ token: "x", version: "0.0.1" });
  const resolver = new Resolver(client, GUILD);
  registerMembers(server, { client, resolver, guildId: GUILD, version: "0.0.1" });
  return server;
}

beforeEach(() => (mock = installMockFetch()));
afterEach(() => mock.restore());

function getTool(s: McpServer, n: string): any {
  const reg = (s as any)._registeredTools ?? (s as any).tools;
  return reg[n];
}

describe("tools/members", () => {
  it("list_members passes limit + after as query params", async () => {
    mock.enqueue({ status: 200, body: [{ user: { id: "U1" } }] });
    const s = makeServer();
    await getTool(s, "discord_list_members").handler({
      limit: 50,
      after: "9999999999999999"
    });
    const r = mock.recorded[0];
    expect(r.method).toBe("GET");
    expect(r.url).toMatch(/\/guilds\/100\/members/);
    expect(r.url).toMatch(/limit=50/);
    expect(r.url).toMatch(/after=9999999999999999/);
  });

  it("kick_member uses DELETE verb against members endpoint", async () => {
    mock.enqueue({ status: 204 });
    const s = makeServer();
    await getTool(s, "discord_kick_member").handler({
      user_id: "U7",
      reason: "spam"
    });
    const r = mock.recorded[0];
    expect(r.method).toBe("DELETE");
    expect(r.url).toMatch(/\/guilds\/100\/members\/U7$/);
    expect(r.headers["x-audit-log-reason"]).toBe(encodeURIComponent("spam"));
  });

  it("timeout_member computes ISO8601 from duration_seconds", async () => {
    const fixedNow = new Date("2026-05-10T12:00:00.000Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(fixedNow);
    mock.enqueue({ status: 200, body: { user: { id: "U7" } } });
    const s = makeServer();
    await getTool(s, "discord_timeout_member").handler({
      user_id: "U7",
      duration_seconds: 600
    });
    const sent = JSON.parse(mock.recorded[0].body!);
    expect(sent.communication_disabled_until).toBe("2026-05-10T12:10:00.000Z");

    // duration_seconds: 0 clears the timeout
    mock.enqueue({ status: 200, body: { user: { id: "U7" } } });
    await getTool(s, "discord_timeout_member").handler({
      user_id: "U7",
      duration_seconds: 0
    });
    const sent2 = JSON.parse(mock.recorded[1].body!);
    expect(sent2.communication_disabled_until).toBeNull();
    vi.restoreAllMocks();
  });
});
