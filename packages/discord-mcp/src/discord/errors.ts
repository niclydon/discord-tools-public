const HINTS: Record<number, string> = {
  10003: "Unknown Channel — channel ID or name does not exist in this guild",
  10004: "Unknown Guild — guild ID does not exist or bot is not a member",
  10007: "Unknown Member — user is not a member of this guild",
  10008: "Unknown Message — message ID does not exist in that channel",
  10011: "Unknown Role — role ID does not exist",
  10013: "Unknown User",
  10014: "Unknown Emoji",
  10015: "Unknown Webhook",
  20001: "Bots cannot use this endpoint",
  20012: "You are not authorized to perform this action on this application",
  30001: "Maximum number of guilds reached (100)",
  30007: "Maximum number of webhooks reached (15 per channel)",
  30008: "Maximum number of emojis reached",
  30013: "Maximum number of channels reached (500)",
  30030: "Maximum number of channels in category reached (50)",
  40001: "Unauthorized — bot token invalid or revoked",
  40002: "You need to verify your account before performing this action",
  40005: "Request entity too large",
  40060: "Interaction has already been acknowledged",
  50001: "Missing Access — bot is in the guild but not in this channel",
  50005: "Cannot edit a message authored by another user",
  50006: "Cannot send an empty message",
  50007: "Cannot send messages to this user (DMs disabled)",
  50013: "Missing Permissions — bot's role lacks the required permission",
  50014: "Invalid authentication token",
  50016: "Provide between 2 and 100 message IDs to bulk delete",
  50019: "A message can only be pinned in the channel it was sent in",
  50021: "Cannot execute action on a system message",
  50025: "Invalid OAuth2 access token",
  50034: "A message older than 14 days cannot be bulk deleted",
  50035: "Invalid form body — request shape failed Discord validation",
  50083: "Tried to perform an action on an archived thread"
};

export interface DiscordErrorLike {
  status: number;
  code?: number;
  body?: unknown;
  message?: string;
}

export function explainDiscordError(err: DiscordErrorLike): string {
  const code = err.code;
  const status = err.status;
  const apiMsg =
    (err.body as any)?.message ?? err.message ?? "(no message)";
  const hint = code ? HINTS[code] : undefined;
  if (hint) {
    return `Discord ${status} (code ${code}): ${apiMsg}. Hint: ${hint}`;
  }
  if (code) {
    return `Discord ${status} (code ${code}): ${apiMsg}`;
  }
  return `Discord ${status}: ${apiMsg}`;
}
