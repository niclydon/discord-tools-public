import { z } from "zod";

export const channelArg = z
  .string()
  .min(1)
  .describe(
    "Channel ID (snowflake), configured channel alias, or channel name. Case-insensitive aliases are supported by the resolver."
  );

export const userArg = z
  .string()
  .min(1)
  .describe(
    "User ID (snowflake). Username resolution is not supported in v1 — pass the numeric ID."
  );

export const reasonArg = z
  .string()
  .max(512)
  .optional()
  .describe(
    "Optional audit-log reason. Recorded in Discord's audit log (X-Audit-Log-Reason)."
  );

export const messageIdArg = z
  .string()
  .regex(/^\d+$/)
  .describe("Message snowflake ID");
