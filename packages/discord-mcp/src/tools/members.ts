import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server.ts";
import { explainDiscordError } from "../discord/errors.ts";
import { reasonArg, userArg } from "./shared.ts";

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

export function registerMembers(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "discord_list_members",
    {
      title: "List guild members",
      description:
        "Lists members of the pinned guild. Paginates via `after` cursor (user snowflake).",
      inputSchema: {
        limit: z.number().int().min(1).max(1000).optional(),
        after: z.string().regex(/^\d+$/).optional()
      },
      annotations: { readOnlyHint: true, idempotentHint: true }
    },
    async ({ limit, after }: { limit?: number; after?: string }) =>
      run(() =>
        ctx.client.request("GET", `/guilds/${ctx.guildId}/members`, {
          query: { limit, after }
        })
      )
  );

  server.registerTool(
    "discord_get_member",
    {
      title: "Get one guild member",
      description: "Fetches a single guild member by user ID.",
      inputSchema: { user_id: userArg },
      annotations: { readOnlyHint: true, idempotentHint: true }
    },
    async ({ user_id }: { user_id: string }) =>
      run(() =>
        ctx.client.request("GET", `/guilds/${ctx.guildId}/members/${user_id}`)
      )
  );

  server.registerTool(
    "discord_set_member_nickname",
    {
      title: "Set member nickname",
      description:
        "Sets a member's server nickname. Pass an empty string to clear.",
      inputSchema: {
        user_id: userArg,
        nickname: z.string().max(32),
        reason: reasonArg
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
    },
    async ({
      user_id,
      nickname,
      reason
    }: {
      user_id: string;
      nickname: string;
      reason?: string;
    }) =>
      run(() =>
        ctx.client.request(
          "PATCH",
          `/guilds/${ctx.guildId}/members/${user_id}`,
          { body: { nick: nickname }, reason }
        )
      )
  );

  server.registerTool(
    "discord_kick_member",
    {
      title: "Kick a member",
      description:
        "**Destructive — operates on shared server state.** Removes a member from the guild.",
      inputSchema: { user_id: userArg, reason: reasonArg },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true }
    },
    async ({ user_id, reason }: { user_id: string; reason?: string }) =>
      run(async () => {
        await ctx.client.request(
          "DELETE",
          `/guilds/${ctx.guildId}/members/${user_id}`,
          { reason }
        );
        return { kicked: user_id };
      })
  );

  server.registerTool(
    "discord_ban_member",
    {
      title: "Ban a member",
      description:
        "**Destructive — operates on shared server state.** Bans a user from the guild. " +
        "Optionally deletes their recent messages (`delete_message_seconds`, 0–604800).",
      inputSchema: {
        user_id: userArg,
        delete_message_seconds: z.number().int().min(0).max(604_800).optional(),
        reason: reasonArg
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true }
    },
    async ({
      user_id,
      delete_message_seconds,
      reason
    }: {
      user_id: string;
      delete_message_seconds?: number;
      reason?: string;
    }) =>
      run(async () => {
        const body: Record<string, unknown> = {};
        if (delete_message_seconds !== undefined)
          body.delete_message_seconds = delete_message_seconds;
        await ctx.client.request(
          "PUT",
          `/guilds/${ctx.guildId}/bans/${user_id}`,
          { body, reason }
        );
        return { banned: user_id };
      })
  );

  server.registerTool(
    "discord_unban_member",
    {
      title: "Unban a user",
      description: "Removes a guild ban for the given user ID.",
      inputSchema: { user_id: userArg, reason: reasonArg },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
    },
    async ({ user_id, reason }: { user_id: string; reason?: string }) =>
      run(async () => {
        await ctx.client.request(
          "DELETE",
          `/guilds/${ctx.guildId}/bans/${user_id}`,
          { reason }
        );
        return { unbanned: user_id };
      })
  );

  server.registerTool(
    "discord_timeout_member",
    {
      title: "Time out a member",
      description:
        "Applies a communication timeout. Pass either `duration_seconds` " +
        "(computed from now) or `until_iso8601` (explicit). " +
        "`duration_seconds: 0` clears the timeout.",
      inputSchema: {
        user_id: userArg,
        duration_seconds: z.number().int().min(0).max(2_419_200).optional(),
        until_iso8601: z.string().datetime().optional(),
        reason: reasonArg
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
    },
    async ({
      user_id,
      duration_seconds,
      until_iso8601,
      reason
    }: {
      user_id: string;
      duration_seconds?: number;
      until_iso8601?: string;
      reason?: string;
    }) =>
      run(() => {
        let until: string | null;
        if (until_iso8601 !== undefined) {
          until = until_iso8601;
        } else if (duration_seconds !== undefined) {
          until =
            duration_seconds === 0
              ? null
              : new Date(Date.now() + duration_seconds * 1000).toISOString();
        } else {
          throw new Error(
            "discord_timeout_member requires duration_seconds or until_iso8601"
          );
        }
        return ctx.client.request(
          "PATCH",
          `/guilds/${ctx.guildId}/members/${user_id}`,
          { body: { communication_disabled_until: until }, reason }
        );
      })
  );
}
