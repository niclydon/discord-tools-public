import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server.ts";
import { explainDiscordError } from "../discord/errors.ts";
import { channelArg, messageIdArg, reasonArg } from "./shared.ts";

const threadIdArg = z.string().regex(/^\d+$/).describe("Thread snowflake ID.");

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
        return ctx.client.request(
          "GET",
          `/guilds/${ctx.guildId}/threads/active`
        );
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
