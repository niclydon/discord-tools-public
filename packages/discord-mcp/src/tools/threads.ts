import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server.ts";
import { explainDiscordError } from "../discord/errors.ts";
import { channelArg, messageIdArg, reasonArg } from "./shared.ts";

const threadIdArg = z.string().regex(/^\d+$/).describe("Thread snowflake ID.");
const messageComponentsArg = z
  .array(z.object({}).passthrough())
  .max(5)
  .optional()
  .describe("Optional Discord message components for the forum starter message.");
const filesArg = z
  .array(
    z.object({
      filename: z.string().min(1).max(256),
      data_base64: z.string().min(1),
      content_type: z.string().min(1).max(128).optional()
    })
  )
  .max(10)
  .optional()
  .describe(
    "Optional image/file attachments for the starter message. Each is base64-encoded bytes; they render inline (e.g. generated image cards) instead of as links."
  );
const COLORS = {
  low: 9807270,
  default: 3447003,
  high: 15105570,
  critical: 15158332
} as const;

interface ThreadListResponse {
  threads?: Array<{ id?: string; parent_id?: string } & Record<string, unknown>>;
  members?: Array<{ id?: string } & Record<string, unknown>>;
  [key: string]: unknown;
}

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

export function registerThreads(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "discord_create_forum_post",
    {
      title: "Create a forum post",
      description:
        "Creates a new post/thread in a Discord forum channel. Supports plain content or a colored embed.",
      inputSchema: {
        forum: channelArg,
        name: z.string().min(1).max(100),
        content: z.string().min(1).max(2000).optional(),
        title: z.string().min(1).max(256).optional(),
        body: z.string().min(1).max(4000).optional(),
        priority: z.enum(["low", "default", "high", "critical"]).optional(),
        auto_archive_minutes: z
          .number()
          .int()
          .refine((v) => [60, 1440, 4320, 10080].includes(v), {
            message: "must be 60, 1440, 4320, or 10080"
          })
          .optional(),
        allowed_mentions: z
          .object({
            parse: z.array(z.enum(["roles", "users", "everyone"])).optional(),
            users: z.array(z.string()).optional(),
            roles: z.array(z.string()).optional()
          })
          .optional(),
        components: messageComponentsArg,
        files: filesArg,
        reason: reasonArg
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
    },
    async ({
      forum,
      name,
      content,
      title,
      body,
      priority,
      auto_archive_minutes,
      allowed_mentions,
      components,
      files,
      reason
    }: {
      forum: string;
      name: string;
      content?: string;
      title?: string;
      body?: string;
      priority?: "low" | "default" | "high" | "critical";
      auto_archive_minutes?: number;
      allowed_mentions?: Record<string, unknown>;
      components?: Array<Record<string, unknown>>;
      files?: Array<{ filename: string; data_base64: string; content_type?: string }>;
      reason?: string;
    }) =>
      run(async () => {
        if (!content && !body && !(files && files.length > 0)) {
          throw new Error("discord_create_forum_post requires content, body, or files");
        }

        const id = await ctx.resolver.channelId(forum);
        const message: Record<string, unknown> = {};
        if (content) message.content = content;
        if (body) {
          message.embeds = [
            {
              title: title ?? name,
              description: body,
              color: COLORS[priority ?? "default"]
            }
          ];
        }
        if (allowed_mentions) message.allowed_mentions = allowed_mentions;
        if (components) message.components = components;

        const requestFiles = files?.map((f) => ({
          filename: f.filename,
          data: Uint8Array.from(Buffer.from(f.data_base64, "base64")),
          contentType: f.content_type
        }));
        if (requestFiles && requestFiles.length > 0) {
          // Reference array lets Discord attach the uploaded parts to the message.
          message.attachments = requestFiles.map((f, i) => ({
            id: i,
            filename: f.filename
          }));
        }

        const requestBody: Record<string, unknown> = { name, message };
        if (auto_archive_minutes !== undefined) {
          requestBody.auto_archive_duration = auto_archive_minutes;
        }

        const out = await ctx.client.request<{
          id: string;
          name?: string;
          parent_id?: string;
          message?: { id?: string };
        }>("POST", `/channels/${id}/threads`, {
          body: requestBody,
          files: requestFiles,
          reason
        });
        return {
          forum_channel_id: id,
          thread_id: out.id,
          thread_name: out.name ?? name,
          message_id: out.message?.id ?? null,
          raw: out
        };
      })
  );

  server.registerTool(
    "discord_create_thread",
    {
      title: "Create a thread",
      description:
        "Creates a thread in a channel. If message_id is provided, the thread is anchored to that message.",
      inputSchema: {
        channel: channelArg,
        name: z.string().min(1).max(100),
        message_id: messageIdArg.optional(),
        auto_archive_minutes: z
          .number()
          .int()
          .refine((v) => [60, 1440, 4320, 10080].includes(v), {
            message: "must be 60, 1440, 4320, or 10080"
          })
          .optional(),
        type: z
          .enum(["public", "private", "announcement"])
          .optional()
          .describe("Defaults to public.")
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
    },
    async ({
      channel,
      name,
      message_id,
      auto_archive_minutes,
      type
    }: {
      channel: string;
      name: string;
      message_id?: string;
      auto_archive_minutes?: number;
      type?: "public" | "private" | "announcement";
    }) =>
      run(async () => {
        const id = await ctx.resolver.channelId(channel);
        const body: Record<string, unknown> = { name };
        if (auto_archive_minutes !== undefined)
          body.auto_archive_duration = auto_archive_minutes;
        if (type) {
          body.type =
            type === "private" ? 12 : type === "announcement" ? 10 : 11;
        }
        const path = message_id
          ? `/channels/${id}/messages/${message_id}/threads`
          : `/channels/${id}/threads`;
        return ctx.client.request("POST", path, { body });
      })
  );

  server.registerTool(
    "discord_list_threads",
    {
      title: "List threads in a channel",
      description: "Lists active or archived threads under a parent channel.",
      inputSchema: {
        channel: channelArg,
        archived: z
          .boolean()
          .optional()
          .describe("true → archived threads. Default: active threads.")
      },
      annotations: { readOnlyHint: true, idempotentHint: true }
    },
    async ({
      channel,
      archived
    }: {
      channel: string;
      archived?: boolean;
    }) =>
      run(async () => {
        const id = await ctx.resolver.channelId(channel);
        if (archived) {
          return ctx.client.request(
            "GET",
            `/channels/${id}/threads/archived/public`
          );
        }
        const active = await ctx.client.request<ThreadListResponse>(
          "GET",
          `/guilds/${ctx.guildId}/threads/active`
        );
        const threads = (active.threads ?? []).filter(
          (thread) => thread.parent_id === id
        );
        const threadIds = new Set(threads.map((thread) => thread.id).filter(Boolean));
        const members = (active.members ?? []).filter(
          (member) => member.id && threadIds.has(member.id)
        );
        return { ...active, threads, members };
      })
  );

  server.registerTool(
    "discord_archive_thread",
    {
      title: "Archive a thread",
      description: "Archives a thread (sets archived=true).",
      inputSchema: { thread: threadIdArg, reason: reasonArg },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
    },
    async ({ thread, reason }: { thread: string; reason?: string }) =>
      run(() =>
        ctx.client.request("PATCH", `/channels/${thread}`, {
          body: { archived: true },
          reason
        })
      )
  );

  server.registerTool(
    "discord_unarchive_thread",
    {
      title: "Unarchive a thread",
      description: "Unarchives a thread (sets archived=false).",
      inputSchema: { thread: threadIdArg, reason: reasonArg },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
    },
    async ({ thread, reason }: { thread: string; reason?: string }) =>
      run(() =>
        ctx.client.request("PATCH", `/channels/${thread}`, {
          body: { archived: false },
          reason
        })
      )
  );

  server.registerTool(
    "discord_delete_thread",
    {
      title: "Delete a thread",
      description:
        "**Destructive — operates on shared server state.** Deletes a thread permanently.",
      inputSchema: { thread: threadIdArg, reason: reasonArg },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true }
    },
    async ({ thread, reason }: { thread: string; reason?: string }) =>
      run(async () => {
        await ctx.client.request("DELETE", `/channels/${thread}`, { reason });
        return { deleted: thread };
      })
  );
}
