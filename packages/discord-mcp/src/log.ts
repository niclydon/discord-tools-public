type Level = "info" | "warn" | "error" | "debug";

interface LogFields {
  tool?: string;
  channel?: string;
  status?: number;
  duration_ms?: number;
  discord_code?: number;
  req_id?: string;
  error?: string;
  [k: string]: unknown;
}

export function log(level: Level, msg: string, fields: LogFields = {}): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...fields
  });
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}
