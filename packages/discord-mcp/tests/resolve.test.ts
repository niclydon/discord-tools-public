import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installMockFetch, type MockFetchHandle } from "./helpers/mock-fetch.ts";
import { DiscordClient } from "../src/discord/client.ts";
import { Resolver } from "../src/discord/resolve.ts";

let mock: MockFetchHandle;
let client: DiscordClient;
const GUILD = "100";

beforeEach(() => {
  mock = installMockFetch();
  client = new DiscordClient({ token: "t", version: "0.1.0" });
});
afterEach(() => mock.restore());

describe("Resolver", () => {
  it("snowflake passes through without API call", async () => {
    const r = new Resolver(client, GUILD, { ttlMs: 60_000 });
    const id = await r.channelId("123456789012345678");
    expect(id).toBe("123456789012345678");
    expect(mock.recorded.length).toBe(0);
  });

  it("resolves channel name once, caches", async () => {
    mock.enqueue({
      status: 200,
      body: [
        { id: "C1", name: "alerts", type: 0 },
        { id: "C2", name: "ops", type: 0 }
      ]
    });
    const r = new Resolver(client, GUILD, { ttlMs: 60_000 });
    expect(await r.channelId("alerts")).toBe("C1");
    expect(await r.channelId("ops")).toBe("C2");
    expect(mock.recorded.length).toBe(1);
  });

  it("case-insensitive channel name", async () => {
    mock.enqueue({
      status: 200,
      body: [{ id: "C1", name: "alerts", type: 0 }]
    });
    const r = new Resolver(client, GUILD, { ttlMs: 60_000 });
    expect(await r.channelId("ALERTS")).toBe("C1");
  });

  it("throws on unknown channel name", async () => {
    mock.enqueue({ status: 200, body: [] });
    const r = new Resolver(client, GUILD, { ttlMs: 60_000 });
    await expect(r.channelId("nope")).rejects.toThrow(/nope/);
  });

  it("invalidate() forces refetch", async () => {
    mock.enqueue({
      status: 200,
      body: [{ id: "C1", name: "alerts", type: 0 }]
    });
    mock.enqueue({
      status: 200,
      body: [{ id: "C1", name: "alerts", type: 0 }]
    });
    const r = new Resolver(client, GUILD, { ttlMs: 60_000 });
    await r.channelId("alerts");
    r.invalidate("channels");
    await r.channelId("alerts");
    expect(mock.recorded.length).toBe(2);
  });

  it("resolves role name", async () => {
    mock.enqueue({
      status: 200,
      body: [
        { id: "R1", name: "admin" },
        { id: "R2", name: "Member" }
      ]
    });
    const r = new Resolver(client, GUILD, { ttlMs: 60_000 });
    expect(await r.roleId("admin")).toBe("R1");
    expect(await r.roleId("member")).toBe("R2");
  });
});
