export type Transport = "http" | "stdio";

export interface AppEnv {
  transport: Transport;
  port: number;
  discordBotToken: string;
  discordGuildId: string;
  originSharedSecret?: string;
  logLevel: "minimal" | "normal" | "verbose";
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const token = source.DISCORD_BOT_TOKEN?.trim();
  if (!token) throw new Error("DISCORD_BOT_TOKEN is required");

  const guild = source.DISCORD_GUILD_ID?.trim();
  if (!guild) throw new Error("DISCORD_GUILD_ID is required");
  if (!/^\d+$/.test(guild)) throw new Error("DISCORD_GUILD_ID must be numeric");

  const transport: Transport =
    (source.TRANSPORT?.trim() as Transport) || "http";
  if (transport !== "http" && transport !== "stdio") {
    throw new Error(`TRANSPORT must be http or stdio, got ${transport}`);
  }

  const portRaw = source.PORT?.trim() || "7871";
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT invalid: ${portRaw}`);
  }

  const secret = source.ORIGIN_SHARED_SECRET?.trim() || undefined;
  const logLevel =
    (source.LOG_LEVEL?.trim() as AppEnv["logLevel"]) || "normal";

  return {
    transport,
    port,
    discordBotToken: token,
    discordGuildId: guild,
    originSharedSecret: secret,
    logLevel
  };
}
