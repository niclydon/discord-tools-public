import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installMockFetch, type MockFetchHandle } from "./helpers/mock-fetch.ts";
import { DiscordClient } from "../src/discord/client.ts";

let mock: MockFetchHandle;
const TOKEN = "test-bot-token";

beforeEach(() => {
  mock = installMockFetch();
});
afterEach(() => mock.restore());

describe("DiscordClient — auth headers", () => {
  it("sends Bot token + UA on every request", async () => {
    mock.enqueue({ status: 200, body: { ok: true } });
    const c = new DiscordClient({ token: TOKEN, version: "0.1.0" });
    await c.request("GET", "/users/@me");
    const r = mock.recorded[0];
    expect(r.headers["authorization"]).toBe(`Bot ${TOKEN}`);
    expect(r.headers["user-agent"]).toMatch(/discord-mcp\/0\.1\.0/);
  });

  it("attaches X-Audit-Log-Reason when reason provided", async () => {
    mock.enqueue({ status: 204 });
    const c = new DiscordClient({ token: TOKEN, version: "0.1.0" });
    await c.request("DELETE", "/channels/123/messages/456", {
      reason: "spam cleanup"
    });
    const r = mock.recorded[0];
    expect(r.headers["x-audit-log-reason"]).toBe(encodeURIComponent("spam cleanup"));
  });

  it("omits audit reason when not provided", async () => {
    mock.enqueue({ status: 204 });
    const c = new DiscordClient({ token: TOKEN, version: "0.1.0" });
    await c.request("DELETE", "/channels/123/messages/456");
    expect(mock.recorded[0].headers["x-audit-log-reason"]).toBeUndefined();
  });

  it("URL-encodes audit reasons containing spaces", async () => {
    mock.enqueue({ status: 204 });
    const c = new DiscordClient({ token: TOKEN, version: "0.1.0" });
    await c.request("DELETE", "/channels/1/messages/2", {
      reason: "operator requested cleanup"
    });
    const r = mock.recorded[0];
    expect(r.headers["x-audit-log-reason"]).toBe(
      encodeURIComponent("operator requested cleanup")
    );
  });

  it("sends multipart/form-data with payload_json + files[n] when files provided", async () => {
    mock.enqueue({ status: 200, body: { id: "T1", message: { id: "M1" } } });
    const c = new DiscordClient({ token: TOKEN, version: "0.1.0" });
    await c.request("POST", "/channels/1/threads", {
      body: { name: "x", message: { content: "hi" } },
      files: [
        { filename: "a.jpg", data: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" },
        { filename: "b.jpg", data: new Uint8Array([4, 5]) }
      ]
    });
    const r = mock.recorded[0];
    // fetch must NOT carry an explicit JSON content-type; the boundary header is set by fetch
    expect(r.headers["content-type"]).toBeUndefined();
    const form = r.body as unknown as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(JSON.parse(form.get("payload_json") as string)).toMatchObject({
      name: "x",
      message: { content: "hi" }
    });
    const f0 = form.get("files[0]") as File;
    const f1 = form.get("files[1]") as File;
    expect(f0).toBeInstanceOf(Blob);
    expect((f0 as File).name).toBe("a.jpg");
    expect(f0.type).toBe("image/jpeg");
    expect(await f0.arrayBuffer().then((b) => new Uint8Array(b))).toEqual(
      new Uint8Array([1, 2, 3])
    );
    expect((f1 as File).name).toBe("b.jpg");
  });
});

describe("DiscordClient — rate limit", () => {
  it("auto-retries once on 429 honoring retry_after", async () => {
    mock.enqueue({
      status: 429,
      body: { retry_after: 0.05, message: "rate limited" },
      headers: { "x-ratelimit-bucket": "B1" }
    });
    mock.enqueue({ status: 200, body: { ok: true } });
    const c = new DiscordClient({ token: TOKEN, version: "0.1.0" });
    const out = await c.request<{ ok: boolean }>("GET", "/foo");
    expect(out.ok).toBe(true);
    expect(mock.recorded.length).toBe(2);
  });

  it("surfaces a second consecutive 429", async () => {
    mock.enqueue({ status: 429, body: { retry_after: 0.01 } });
    mock.enqueue({ status: 429, body: { retry_after: 0.01 } });
    const c = new DiscordClient({ token: TOKEN, version: "0.1.0" });
    await expect(c.request("GET", "/foo")).rejects.toMatchObject({
      status: 429
    });
  });

  it("retries 5xx once with backoff", async () => {
    mock.enqueue({ status: 502, body: { message: "bad gateway" } });
    mock.enqueue({ status: 200, body: { ok: true } });
    const c = new DiscordClient({ token: TOKEN, version: "0.1.0" });
    await c.request("GET", "/foo");
    expect(mock.recorded.length).toBe(2);
  });

  it("does not retry plain 4xx", async () => {
    mock.enqueue({
      status: 403,
      body: { code: 50013, message: "Missing Permissions" }
    });
    const c = new DiscordClient({ token: TOKEN, version: "0.1.0" });
    await expect(c.request("GET", "/foo")).rejects.toMatchObject({
      status: 403,
      code: 50013
    });
    expect(mock.recorded.length).toBe(1);
  });

  it("queues same-bucket requests when remaining=0", async () => {
    mock.enqueue({
      status: 200,
      body: { ok: 1 },
      headers: {
        "x-ratelimit-bucket": "B1",
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset-after": "0.02"
      }
    });
    mock.enqueue({
      status: 200,
      body: { ok: 2 },
      headers: { "x-ratelimit-bucket": "B1", "x-ratelimit-remaining": "5" }
    });
    const c = new DiscordClient({ token: TOKEN, version: "0.1.0" });
    const t0 = Date.now();
    await c.request("GET", "/x", { bucketHint: "B1" });
    await c.request("GET", "/x", { bucketHint: "B1" });
    const dt = Date.now() - t0;
    expect(dt).toBeGreaterThanOrEqual(15);
  });
});
