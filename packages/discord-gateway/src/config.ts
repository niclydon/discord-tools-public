import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_APPLICATION_ID: z.string().optional(),
  DISCORD_GUILD_ID: z.string().min(1),
  OPERATOR_USER_IDS: z.string().optional().default(""),
  DISCORD_MESSAGE_CONTENT_INTENT: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  ROUTES_FILE: z.string().default("./config/routes.json"),
  EVENT_LOG_PATH: z.string().default("./data/events.jsonl"),
  ACTION_WEBHOOK_URL: z.string().url().optional(),
  ACK_UNREGISTERED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  PORT: z.coerce.number().int().positive().default(8787),
  LOG_LEVEL: z.string().default("info")
});

export type Config = z.infer<typeof EnvSchema> & {
  operatorUserIds: Set<string>;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.parse(env);
  const operatorUserIds = new Set(
    parsed.OPERATOR_USER_IDS.split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
  return { ...parsed, operatorUserIds };
}
