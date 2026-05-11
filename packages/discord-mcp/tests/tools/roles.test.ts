import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installMockFetch, type MockFetchHandle } from "../helpers/mock-fetch.ts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DiscordClient } from "../../src/discord/client.ts";
import { Resolver } from "../../src/discord/resolve.ts";
import { registerRoles } from "../../src/tools/roles.ts";

const GUILD = "100";
let mock: MockFetchHandle;

function makeServer() {
  const server = new McpServer({ name: "t", version: "0.0.1" });
  const client = new DiscordClient({ token: "x", version: "0.0.1" });
  const resolver = new Resolver(client, GUILD);
  registerRoles(server, { client, resolver, guildId: GUILD, version: "0.0.1" });
  return server;
}

beforeEach(() => (mock = installMockFetch()));
afterEach(() => mock.restore());

function getTool(s: McpServer, n: string): any {
  const reg = (s as any)._registeredTools ?? (s as any).tools;
  return reg[n];
}

describe("tools/roles", () => {
  it("create_role posts to /guilds/{id}/roles", async () => {
    mock.enqueue({ status: 200, body: { id: "R9", name: "ops" } });
    const s = makeServer();
    await getTool(s, "discord_create_role").handler({ name: "ops" });
    const r = mock.recorded[0];
    expect(r.method).toBe("POST");
    expect(r.url).toMatch(/\/guilds\/100\/roles$/);
    expect(JSON.parse(r.body!).name).toBe("ops");
  });

  it("assign_role PUTs /members/{user}/roles/{role}", async () => {
    mock.enqueue({ status: 200, body: [{ id: "R1", name: "ops" }] });
    mock.enqueue({ status: 204 });
    const s = makeServer();
    await getTool(s, "discord_assign_role").handler({
      user: "777",
      role: "ops"
    });
    const r = mock.recorded[1];
    expect(r.method).toBe("PUT");
    expect(r.url).toMatch(/\/members\/777\/roles\/R1$/);
  });
});
