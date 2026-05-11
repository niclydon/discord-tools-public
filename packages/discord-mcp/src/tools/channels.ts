import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server.ts";
import { explainDiscordError } from "../discord/errors.ts";
import { channelArg, reasonArg } from "./shared.ts";

const CHANNEL_TYPE_MAP: Record<string, number> = {
  text: 0,
  voice: 2,
  category: 4,
  announcement: 5,
  forum: 15,
  stage: 13
};

type ChannelType = keyof typeof CHANNEL_TYPE_MAP;

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

export function registerChannels(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "discord_create_channel",
    {
      title: "Create a channel",
      description: "Creates a new channel in the pinned guild.",
      inputSchema: {
        name: z.string().min(1).max(100),
        type: z.enum(["text", "voice", "category", "announcement", "forum", "stage"]),
        parent_category: channelArg.optional(),
        topic: z.string().max(1024).optional(),
        slowmode_seconds: z.number().int().min(0).max(21_600).optional(),
        nsfw: z.boolean().optional(),
        reason: reasonArg
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
    },
    async ({
      name,
      type,
      parent_category,
      topic,
      slowmode_seconds,
      nsfw,
      reason
    }: {
      name: string;
      type: ChannelType;
      parent_category?: string;
      topic?: string;
      slowmode_seconds?: number;
      nsfw?: boolean;
      reason?: string;
    }) =>
      run(async () => {
        const body: Record<string, unknown> = {
          name,
          type: CHANNEL_TYPE_MAP[type]
        };
        if (parent_category)
          body.parent_id = await ctx.resolver.channelId(parent_category);
        if (topic !== undefined) body.topic = topic;
        if (slowmode_seconds !== undefined) body.rate_limit_per_user = slowmode_seconds;
        if (nsfw !== undefined) body.nsfw = nsfw;
        const out = await ctx.client.request(
          "POST",
          `/guilds/${ctx.guildId}/channels`,
          { body, reason }
        );
        ctx.resolver.invalidate("channels");
        return out;
      })
  );

  server.registerTool(
    "discord_edit_channel",
    {
      title: "Edit channel settings",
      description: "Patches name, topic, parent, slowmode, NSFW, or position.",
      inputSchema: {
        channel: channelArg,
        name: z.string().min(1).max(100).optional(),
        topic: z.string().max(1024).optional(),
        parent: channelArg.optional(),
        slowmode_seconds: z.number().int().min(0).max(21_600).optional(),
        nsfw: z.boolean().optional(),
        position: z.number().int().min(0).optional(),
        reason: reasonArg
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
    },
    async ({
      channel,
      name,
      topic,
      parent,
      slowmode_seconds,
      nsfw,
      position,
      reason
    }: {
      channel: string;
      name?: string;
      topic?: string;
      parent?: string;
      slowmode_seconds?: number;
      nsfw?: boolean;
      position?: number;
      reason?: string;
    }) =>
      run(async () => {
        const id = await ctx.resolver.channelId(channel);
        const body: Record<string, unknown> = {};
        if (name !== undefined) body.name = name;
        if (topic !== undefined) body.topic = topic;
        if (parent !== undefined) body.parent_id = await ctx.resolver.channelId(parent);
        if (slowmode_seconds !== undefined) body.rate_limit_per_user = slowmode_seconds;
        if (nsfw !== undefined) body.nsfw = nsfw;
        if (position !== undefined) body.position = position;
        const out = await ctx.client.request("PATCH", `/channels/${id}`, {
          body,
          reason
        });
        ctx.resolver.invalidate("channels");
        return out;
      })
  );

  server.registerTool(
    "discord_delete_channel",
    {
      title: "Delete a channel",
      description:
        "**Destructive — operates on shared server state.** Deletes a channel and all its messages.",
      inputSchema: { channel: channelArg, reason: reasonArg },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true }
    },
    async ({ channel, reason }: { channel: string; reason?: string }) =>
      run(async () => {
        const id = await ctx.resolver.channelId(channel);
        const out = await ctx.client.request("DELETE", `/channels/${id}`, {
          reason
        });
        ctx.resolver.invalidate("channels");
        return out;
      })
  );

  server.registerTool(
    "discord_set_channel_permission",
    {
      title: "Set per-channel permission overwrite",
      description:
        "Adds or replaces a per-channel permission overwrite for a role or user. " +
        "allow/deny are decimal Discord permission bitfield strings.",
      inputSchema: {
        channel: channelArg,
        target_type: z.enum(["role", "user"]),
        target_id: z.string().regex(/^\d+$/),
        allow: z.string().regex(/^\d+$/).optional(),
        deny: z.string().regex(/^\d+$/).optional(),
        reason: reasonArg
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
    },
    async ({
      channel,
      target_type,
      target_id,
      allow,
      deny,
      reason
    }: {
      channel: string;
      target_type: "role" | "user";
      target_id: string;
      allow?: string;
      deny?: string;
      reason?: string;
    }) =>
      run(async () => {
        const id = await ctx.resolver.channelId(channel);
        const body: Record<string, unknown> = {
          type: target_type === "role" ? 0 : 1
        };
        if (allow) body.allow = allow;
        if (deny) body.deny = deny;
        await ctx.client.request(
          "PUT",
          `/channels/${id}/permissions/${target_id}`,
          { body, reason }
        );
        return { channel_id: id, target_id, target_type };
      })
  );

  server.registerTool(
    "discord_remove_channel_permission",
    {
      title: "Remove per-channel permission overwrite",
      description:
        "Deletes a per-channel permission overwrite for a role or user.",
      inputSchema: {
        channel: channelArg,
        target_id: z.string().regex(/^\d+$/),
        reason: reasonArg
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
    },
    async ({
      channel,
      target_id,
      reason
    }: {
      channel: string;
      target_id: string;
      reason?: string;
    }) =>
      run(async () => {
        const id = await ctx.resolver.channelId(channel);
        await ctx.client.request(
          "DELETE",
          `/channels/${id}/permissions/${target_id}`,
          { reason }
        );
        return { channel_id: id, removed: target_id };
      })
  );
}
