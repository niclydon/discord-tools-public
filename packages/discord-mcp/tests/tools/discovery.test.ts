import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installMockFetch, type MockFetchHandle } from "../helpers/mock-fetch.ts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DiscordClient } from "../../src/discord/client.ts";
import { Resolver } from "../../src/discord/resolve.ts";
import { registerDiscovery } from "../../src/tools/discovery.ts";

let mock: MockFetchHandle;
const GUILD = "100";

function makeServer() {
  const server = new McpServer({ name: "t", version: "0.0.1" });
  const client = new DiscordClient({ token: "x", version: "0.0.1" });
  const resolver = new Resolver(client, GUILD);
  registerDiscovery(server, { client, resolver, guildId: GUILD, version: "0.0.1" });
  return server;
}

beforeEach(() => (mock = installMockFetch()));
afterEach(() => mock.restore());

function getTool(s: McpServer, n: string): any {
  const reg = (s as any)._registeredTools ?? (s as any).tools;
  return reg[n];
}

describe("tools/discovery", () => {
  it("guild_info hits /guilds/{id}?with_counts=true", async () => {
    mock.enqueue({
      status: 200,
      body: { id: GUILD, name: "Example Server", approximate_member_count: 4 }
    });
    const s = makeServer();
    const tool = getTool(s, "discord_guild_info");
    const result = await tool.handler({});
    const r0 = mock.recorded[0];
    expect(r0.url).toContain("/guilds/100");
    expect(r0.url).toContain("with_counts=true");
    expect(result.content[0].text).toContain("Example Server");
  });

  it("list_channels filters by type=text", async () => {
    mock.enqueue({
      status: 200,
      body: [
        { id: "1", name: "a", type: 0 },
        { id: "2", name: "b", type: 2 },
        { id: "3", name: "c", type: 4 }
      ]
    });
    const s = makeServer();
    const tool = getTool(s, "discord_list_channels");
    const out = await tool.handler({ type: "text" });
    expect(out.content[0].text).toContain('"a"');
    expect(out.content[0].text).not.toContain('"b"');
  });
});
