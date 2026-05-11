import { describe, it, expect, vi } from "vitest";
import { log } from "../src/log.ts";

describe("log", () => {
  it("emits structured JSON with ts and level", () => {
    const out = vi.spyOn(console, "log").mockImplementation(() => {});
    log("info", "hello", { tool: "x" });
    const line = out.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.level).toBe("info");
    expect(parsed.msg).toBe("hello");
    expect(parsed.tool).toBe("x");
    expect(parsed.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    out.mockRestore();
  });

  it("routes warn/error to stderr", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    log("warn", "uh oh");
    expect(err).toHaveBeenCalledOnce();
    err.mockRestore();
  });
});
