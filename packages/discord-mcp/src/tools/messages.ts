import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server.ts";
import { explainDiscordError } from "../discord/errors.ts";
import { channelArg, messageIdArg, reasonArg } from "./shared.ts";

const COLORS = {
  low: 9807270,
  default: 3447003,
  high: 15105570,
  critical: 15158332
} as const;

const CHUNK = 2000;

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
function chunk(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += CHUNK) out.push(s.slice(i, i + CHUNK));
  return out;
}

export function registerMessages(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "discord_post_message",
    {
      title: "Post a message",
      description:
        "Posts a message to a channel. Auto-chunks content > 2000 chars into multiple posts.",
      inputSchema: {
        channel: channelArg,
        content: z.string().min(1).max(60_000),
        reply_to: messageIdArg.optional(),
        allowed_mentions: z
          .object({
            parse: z.array(z.enum(["roles", "users", "everyone"])).optional(),
            users: z.array(z.string()).optional(),
            roles: z.array(z.string()).optional()
          })
          .optional()
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
    },
    async ({
      channel,
      content,
      reply_to,
      allowed_mentions
    }: {
      channel: string;
      content: string;
      reply_to?: string;
      allowed_mentions?: Record<string, unknown>;
    }) =>
      run(async () => {
        const id = await ctx.resolver.channelId(channel);
        const parts = chunk(content);
        const posted: string[] = [];
        for (let i = 0; i < parts.length; i++) {
          const body: Record<string, unknown> = { content: parts[i] };
          if (i === 0 && reply_to) {
            body.message_reference = { message_id: reply_to };
          }
          if (allowed_mentions) body.allowed_mentions = allowed_mentions;
          const sent = await ctx.client.request<{ id: string }>(
            "POST",
            `/channels/${id}/messages`,
            { body }
          );
          posted.push(sent.id);
        }
        return { channel_id: id, message_ids: posted };
      })
  );

  server.registerTool(
    "discord_post_embed",
    {
      title: "Post a colored embed",
      description:
        "Posts a Discord embed with a simple priority color map (low/default/high/critical).",
      inputSchema: {
        channel: channelArg,
        title: z.string().min(1).max(256),
        body: z.string().min(1).max(4000),
        priority: z
          .enum(["low", "default", "high", "critical"])
          .optional()
          .describe("Default: default."),
        username: z
          .string()
          .max(80)
          .optional()
          .describe("Override author username (per-source identity).")
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
    },
    async ({
      channel,
      title,
      body,
      priority,
      username
    }: {
      channel: string;
      title: string;
      body: string;
      priority?: "low" | "default" | "high" | "critical";
      username?: string;
    }) =>
      run(async () => {
        const id = await ctx.resolver.channelId(channel);
        const color = COLORS[priority ?? "default"];
        const payload: Record<string, unknown> = {
          embeds: [{ title, description: body, color }]
        };
        if (username) payload.username = username;
        return ctx.client.request("POST", `/channels/${id}/messages`, {
          body: payload
        });
      })
  );

  server.registerTool(
    "discord_edit_message",
    {
      title: "Edit a message",
      description:
        "Edits a message previously sent by this bot. Cannot edit other authors' messages.",
      inputSchema: {
        channel: channelArg,
        message_id: messageIdArg,
        content: z.string().max(60_000).optional(),
        embeds: z.array(z.record(z.unknown())).optional()
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
    },
    async ({
      channel,
      message_id,
      content,
      embeds
    }: {
      channel: string;
      message_id: string;
      content?: string;
      embeds?: Array<Record<string, unknown>>;
    }) =>
      run(async () => {
        const id = await ctx.resolver.channelId(channel);
        const body: Record<string, unknown> = {};
        if (content !== undefined) body.content = content;
        if (embeds !== undefined) body.embeds = embeds;
        return ctx.client.request("PATCH", `/channels/${id}/messages/${message_id}`, {
          body
        });
      })
  );

  server.registerTool(
    "discord_delete_message",
    {
      title: "Delete a message",
      description:
        "**Destructive — operates on shared server state.** Deletes a single message by ID.",
      inputSchema: {
        channel: channelArg,
        message_id: messageIdArg,
        reason: reasonArg
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true }
    },
    async ({
      channel,
      message_id,
      reason
    }: {
      channel: string;
      message_id: string;
      reason?: string;
    }) =>
      run(async () => {
        const id = await ctx.resolver.channelId(channel);
        await ctx.client.request("DELETE", `/channels/${id}/messages/${message_id}`, {
          reason
        });
        return { deleted: message_id, channel_id: id };
      })
  );

  server.registerTool(
    "discord_bulk_delete_messages",
    {
      title: "Bulk delete messages",
      description:
        "**Destructive — operates on shared server state.** Deletes 2-100 messages in a single request. Messages must be < 14 days old.",
      inputSchema: {
        channel: channelArg,
        message_ids: z.array(z.string().regex(/^\d+$/)).min(2).max(100),
        reason: reasonArg
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true }
    },
    async ({
      channel,
      message_ids,
      reason
    }: {
      channel: string;
      message_ids: string[];
      reason?: string;
    }) =>
      run(async () => {
        const id = await ctx.resolver.channelId(channel);
        await ctx.client.request("POST", `/channels/${id}/messages/bulk-delete`, {
          body: { messages: message_ids },
          reason
        });
        return { deleted: message_ids.length, channel_id: id };
      })
  );

  server.registerTool(
    "discord_fetch_messages",
    {
      title: "Fetch recent messages",
      description: "Pulls recent messages from a channel. Capped at 100 per call.",
      inputSchema: {
        channel: channelArg,
        limit: z.number().int().min(1).max(100).optional(),
        before: messageIdArg.optional(),
        after: messageIdArg.optional(),
        around: messageIdArg.optional()
      },
      annotations: { readOnlyHint: true, idempotentHint: true }
    },
    async ({
      channel,
      limit,
      before,
      after,
      around
    }: {
      channel: string;
      limit?: number;
      before?: string;
      after?: string;
      around?: string;
    }) =>
      run(async () => {
        const id = await ctx.resolver.channelId(channel);
        return ctx.client.request("GET", `/channels/${id}/messages`, {
          query: { limit, before, after, around }
        });
      })
  );

  server.registerTool(
    "discord_get_message",
    {
      title: "Get one message",
      description: "Returns a single message by ID.",
      inputSchema: { channel: channelArg, message_id: messageIdArg },
      annotations: { readOnlyHint: true, idempotentHint: true }
    },
    async ({ channel, message_id }: { channel: string; message_id: string }) =>
      run(async () => {
        const id = await ctx.resolver.channelId(channel);
        return ctx.client.request("GET", `/channels/${id}/messages/${message_id}`);
      })
  );

  server.registerTool(
    "discord_pin_message",
    {
      title: "Pin a message",
      description: "Pins a message to its channel.",
      inputSchema: { channel: channelArg, message_id: messageIdArg, reason: reasonArg },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
    },
    async ({
      channel,
      message_id,
      reason
    }: {
      channel: string;
      message_id: string;
      reason?: string;
    }) =>
      run(async () => {
        const id = await ctx.resolver.channelId(channel);
        await ctx.client.request("PUT", `/channels/${id}/pins/${message_id}`, { reason });
        return { pinned: message_id };
      })
  );

  server.registerTool(
    "discord_unpin_message",
    {
      title: "Unpin a message",
      description: "Unpins a message from its channel.",
      inputSchema: { channel: channelArg, message_id: messageIdArg, reason: reasonArg },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
    },
    async ({
      channel,
      message_id,
      reason
    }: {
      channel: string;
      message_id: string;
      reason?: string;
    }) =>
      run(async () => {
        const id = await ctx.resolver.channelId(channel);
        await ctx.client.request("DELETE", `/channels/${id}/pins/${message_id}`, {
          reason
        });
        return { unpinned: message_id };
      })
  );

  server.registerTool(
    "discord_search_messages",
    {
      title: "Search messages (paginated client-side filter)",
      description:
        "Iterates pages of /messages and filters client-side. Discord exposes no bot search API; this is best-effort and slow on large channels.",
      inputSchema: {
        channel: channelArg,
        query: z.string().min(1),
        max_pages: z.number().int().min(1).max(10).optional()
      },
      annotations: { readOnlyHint: true, idempotentHint: true }
    },
    async ({
      channel,
      query,
      max_pages
    }: {
      channel: string;
      query: string;
      max_pages?: number;
    }) =>
      run(async () => {
        const id = await ctx.resolver.channelId(channel);
        const limit = 100;
        const pages = max_pages ?? 3;
        const matches: unknown[] = [];
        let before: string | undefined;
        for (let p = 0; p < pages; p++) {
          const batch = await ctx.client.request<Array<{ id: string; content: string }>>(
            "GET",
            `/channels/${id}/messages`,
            { query: { limit, before } }
          );
          if (!batch.length) break;
          const q = query.toLowerCase();
          for (const m of batch) {
            if (m.content && m.content.toLowerCase().includes(q)) matches.push(m);
          }
          before = batch[batch.length - 1].id;
        }
        return { query, matches };
      })
  );
}
