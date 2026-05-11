import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RouteStore } from "../src/routes.js";

describe("RouteStore", () => {
  it("loads configured routes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "discord-gateway-routes-"));
    const file = join(dir, "routes.json");
    await writeFile(file, JSON.stringify({
      routes: [
        { channel_id: "123", name: "test", handler: "receipt" }
      ]
    }));

    const store = new RouteStore(file);
    await store.load();

    expect(store.status()).toMatchObject({ route_count: 1, file });
    expect(store.list()[0]).toMatchObject({ channel_id: "123", name: "test" });
  });
});
