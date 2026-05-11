import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server.ts";
import { explainDiscordError } from "../discord/errors.ts";
import { channelArg } from "./shared.ts";

const TYPE_FILTER: Record<string, number[] | "all"> = {
  text: [0, 5],
  voice: [2, 13],
  category: [4],
  forum: [15],
  all: "all"
};

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

export function registerDiscovery(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "discord_guild_info",
    {
      title: "Get guild info",
      description: "Returns name, member counts, features, and IDs for the pinned guild.",
      inputSchema: {},
      annotations: { readOnlyHint: true, idempotentHint: true }
    },
    async () =>
      run(() =>
        ctx.client.request("GET", `/guilds/${ctx.guildId}`, {
          query: { with_counts: "true" }
        })
      )
  );

  server.registerTool(
    "discord_list_channels",
    {
      title: "List channels",
      description: "Lists channels in the pinned guild, optionally filtered by type.",
      inputSchema: {
        type: z
          .enum(["text", "voice", "category", "forum", "all"])
          .optional()
          .describe("Filter by channel type. Default: all.")
      },
      annotations: { readOnlyHint: true, idempotentHint: true }
    },
    async ({ type }: { type?: "text" | "voice" | "category" | "forum" | "all" }) =>
      run(async () => {
        const data = await ctx.client.request<Array<{ type: number }>>(
          "GET",
          `/guilds/${ctx.guildId}/channels`
        );
        const f = TYPE_FILTER[type ?? "all"];
        return f === "all"
          ? data
          : data.filter((c) => (f as number[]).includes(c.type));
      })
  );

  server.registerTool(
    "discord_get_channel",
    {
      title: "Get channel",
      description: "Returns the channel object for a channel name or snowflake.",
      inputSchema: { channel: channelArg },
      annotations: { readOnlyHint: true, idempotentHint: true }
    },
    async ({ channel }: { channel: string }) =>
      run(async () => {
        const id = await ctx.resolver.channelId(channel);
        return ctx.client.request("GET", `/channels/${id}`);
      })
  );

  server.registerTool(
    "discord_list_roles",
    {
      title: "List roles",
      description: "Lists all roles in the pinned guild.",
      inputSchema: {},
      annotations: { readOnlyHint: true, idempotentHint: true }
    },
    async () =>
      run(() => ctx.client.request("GET", `/guilds/${ctx.guildId}/roles`))
  );

  server.registerTool(
    "discord_audit_log",
    {
      title: "Read audit log",
      description: "Returns recent audit-log entries for the pinned guild.",
      inputSchema: {
        user_id: z
          .string()
          .regex(/^\d+$/)
          .optional()
          .describe("Filter by acting user snowflake."),
        action_type: z
          .number()
          .int()
          .optional()
          .describe("Filter by Discord audit-log action type code."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Max entries (default 50).")
      },
      annotations: { readOnlyHint: true, idempotentHint: true }
    },
    async ({
      user_id,
      action_type,
      limit
    }: {
      user_id?: string;
      action_type?: number;
      limit?: number;
    }) =>
      run(() =>
        ctx.client.request("GET", `/guilds/${ctx.guildId}/audit-logs`, {
          query: { user_id, action_type, limit }
        })
      )
  );
}
