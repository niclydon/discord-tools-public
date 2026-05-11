import { mkdir, appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { GatewayEvent } from "./types.js";

export class EventLog {
  constructor(private readonly filePath: string) {}

  async append(event: GatewayEvent & { outcome?: string; error?: string }): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${JSON.stringify(event)}\n`, "utf8");
  }
}
