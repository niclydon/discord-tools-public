import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server.ts";
import { explainDiscordError } from "../discord/errors.ts";
import { channelArg, reasonArg } from "./shared.ts";

const COLORS = {
  low: 9807270,
  default: 3447003,
  high: 15105570,
  critical: 15158332
} as const;

type Priority = keyof typeof COLORS;

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

export function registerWebhooks(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "discord_list_webhooks",
    {
      title: "List webhooks in a channel",
      description: "Lists all webhooks attached to a channel.",
      inputSchema: { channel: channelArg },
      annotations: { readOnlyHint: true, idempotentHint: true }
    },
    async ({ channel }: { channel: string }) =>
      run(async () => {
        const id = await ctx.resolver.channelId(channel);
        return ctx.client.request("GET", `/channels/${id}/webhooks`);
      })
  );

  server.registerTool(
    "discord_create_webhook",
    {
      title: "Create a webhook",
      description: "Creates a named webhook on a channel.",
      inputSchema: {
        channel: channelArg,
        name: z.string().min(1).max(80),
        reason: reasonArg
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
    },
    async ({
      channel,
      name,
      reason
    }: {
      channel: string;
      name: string;
      reason?: string;
    }) =>
      run(async () => {
        const id = await ctx.resolver.channelId(channel);
        return ctx.client.request("POST", `/channels/${id}/webhooks`, {
          body: { name },
          reason
        });
      })
  );

  server.registerTool(
    "discord_delete_webhook",
    {
      title: "Delete a webhook",
      description:
        "**Destructive — operates on shared server state.** Deletes a webhook by ID. Existing notify scripts using its URL will start failing.",
      inputSchema: {
        webhook_id: z.string().regex(/^\d+$/),
        reason: reasonArg
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true }
    },
    async ({
      webhook_id,
      reason
    }: {
      webhook_id: string;
      reason?: string;
    }) =>
      run(async () => {
        await ctx.client.request("DELETE", `/webhooks/${webhook_id}`, { reason });
        return { deleted: webhook_id };
      })
  );

  server.registerTool(
    "discord_post_via_webhook",
    {
      title: "Post via a webhook URL (with custom username)",
      description:
        "Posts an embed via a webhook URL using a custom username (per-source identity, e.g., 'HF Scout'). The URL contains the webhook secret — keep it confidential.",
      inputSchema: {
        webhook_url: z
          .string()
          .url()
          .describe("Full webhook URL: https://discord.com/api/webhooks/{id}/{token}"),
        username: z.string().min(1).max(80),
        title: z.string().min(1).max(256),
        body: z.string().min(1).max(4000),
        priority: z.enum(["low", "default", "high", "critical"]).optional()
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
    },
    async ({
      webhook_url,
      username,
      title,
      body,
      priority
    }: {
      webhook_url: string;
      username: string;
      title: string;
      body: string;
      priority?: Priority;
    }) =>
      run(async () => {
        const color = COLORS[priority ?? "default"];
        const payload = {
          username,
          embeds: [{ title, description: body, color }]
        };
        const resp = await fetch(webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) {
          throw Object.assign(new Error(`webhook ${resp.status}`), {
            status: resp.status,
            body: await resp.text()
          });
        }
        return { posted: true };
      })
  );
}
