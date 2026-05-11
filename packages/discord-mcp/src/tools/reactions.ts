import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server.ts";
import { explainDiscordError } from "../discord/errors.ts";
import { channelArg, messageIdArg } from "./shared.ts";

function asText(v: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(v, null, 2) }] };
}
async function run<T>(fn: () => Promise<T>) {
  try {
    return asText(await fn());
  } catch (e: unknown) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: explainDiscordError(e as Parameters<typeof explainDiscordError>[0])
        }
      ]
    };
  }
}

function encodeEmoji(emoji: string): string {
  // Custom: <:name:id> or <a:name:id> → "name:id"
  const m = emoji.match(/^<a?:([^:]+):(\d+)>$/);
  const raw = m ? `${m[1]}:${m[2]}` : emoji;
  return encodeURIComponent(raw);
}

const emojiArg = z
  .string()
  .min(1)
  .describe(
    "Unicode emoji (e.g. '👍') or custom emoji in <:name:id> / <a:name:id> form."
  );

export function registerReactions(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "discord_add_reaction",
    {
      title: "Add a reaction",
      description: "Adds an emoji reaction to a message as the bot.",
      inputSchema: { channel: channelArg, message_id: messageIdArg, emoji: emojiArg },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
    },
    async ({
      channel,
      message_id,
      emoji
    }: {
      channel: string;
      message_id: string;
      emoji: string;
    }) =>
      run(async () => {
        const id = await ctx.resolver.channelId(channel);
        const e = encodeEmoji(emoji);
        await ctx.client.request(
          "PUT",
          `/channels/${id}/messages/${message_id}/reactions/${e}/@me`
        );
        return { reacted: emoji, message_id };
      })
  );

  server.registerTool(
    "discord_remove_reaction",
    {
      title: "Remove the bot's reaction",
      description: "Removes the bot's own reaction from a message.",
      inputSchema: { channel: channelArg, message_id: messageIdArg, emoji: emojiArg },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
    },
    async ({
      channel,
      message_id,
      emoji
    }: {
      channel: string;
      message_id: string;
      emoji: string;
    }) =>
      run(async () => {
        const id = await ctx.resolver.channelId(channel);
        const e = encodeEmoji(emoji);
        await ctx.client.request(
          "DELETE",
          `/channels/${id}/messages/${message_id}/reactions/${e}/@me`
        );
        return { unreacted: emoji, message_id };
      })
  );

  server.registerTool(
    "discord_list_reactions",
    {
      title: "List users who reacted",
      description:
        "Returns up to 100 users who reacted to a message with a given emoji.",
      inputSchema: {
        channel: channelArg,
        message_id: messageIdArg,
        emoji: emojiArg,
        limit: z.number().int().min(1).max(100).optional()
      },
      annotations: { readOnlyHint: true, idempotentHint: true }
    },
    async ({
      channel,
      message_id,
      emoji,
      limit
    }: {
      channel: string;
      message_id: string;
      emoji: string;
      limit?: number;
    }) =>
      run(async () => {
        const id = await ctx.resolver.channelId(channel);
        const e = encodeEmoji(emoji);
        return ctx.client.request(
          "GET",
          `/channels/${id}/messages/${message_id}/reactions/${e}`,
          { query: { limit } }
        );
      })
  );
}
