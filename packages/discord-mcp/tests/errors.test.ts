import { describe, it, expect } from "vitest";
import { explainDiscordError } from "../src/discord/errors.ts";

describe("explainDiscordError", () => {
  it("hints on 50013 Missing Permissions", () => {
    const out = explainDiscordError({
      status: 403,
      code: 50013,
      body: { message: "Missing Permissions" }
    });
    expect(out).toMatch(/permissions/i);
    expect(out).toContain("50013");
  });

  it("hints on 10003 Unknown Channel", () => {
    const out = explainDiscordError({
      status: 404,
      code: 10003,
      body: { message: "Unknown Channel" }
    });
    expect(out).toMatch(/channel/i);
  });

  it("falls through gracefully for unknown codes", () => {
    const out = explainDiscordError({
      status: 400,
      code: 99999,
      body: { message: "Some thing" }
    });
    expect(out).toContain("99999");
    expect(out).toContain("Some thing");
  });

  it("handles missing code field", () => {
    const out = explainDiscordError({
      status: 502,
      body: { message: "Bad Gateway" }
    });
    expect(out).toContain("502");
  });
});
