import { describe, it, expect } from "vitest";
import { loadEnv } from "../src/env.ts";

describe("loadEnv", () => {
  it("rejects missing DISCORD_BOT_TOKEN", () => {
    expect(() =>
      loadEnv({ DISCORD_GUILD_ID: "1", TRANSPORT: "stdio" })
    ).toThrow(/DISCORD_BOT_TOKEN/);
  });

  it("rejects missing DISCORD_GUILD_ID", () => {
    expect(() =>
      loadEnv({ DISCORD_BOT_TOKEN: "x", TRANSPORT: "stdio" })
    ).toThrow(/DISCORD_GUILD_ID/);
  });

  it("requires numeric DISCORD_GUILD_ID", () => {
    expect(() =>
      loadEnv({
        DISCORD_BOT_TOKEN: "x",
        DISCORD_GUILD_ID: "abc",
        TRANSPORT: "stdio"
      })
    ).toThrow(/numeric/);
  });

  it("defaults PORT and TRANSPORT", () => {
    const env = loadEnv({
      DISCORD_BOT_TOKEN: "x",
      DISCORD_GUILD_ID: "12345"
    });
    expect(env.transport).toBe("http");
    expect(env.port).toBe(7871);
  });

  it("passthrough mode when ORIGIN_SHARED_SECRET unset", () => {
    const env = loadEnv({
      DISCORD_BOT_TOKEN: "x",
      DISCORD_GUILD_ID: "12345"
    });
    expect(env.originSharedSecret).toBeUndefined();
  });
});
