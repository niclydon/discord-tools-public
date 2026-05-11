import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server.ts";
import { explainDiscordError } from "../discord/errors.ts";
import { userArg, reasonArg } from "./shared.ts";

const roleArg = z
  .string()
  .min(1)
  .describe("Role ID (snowflake) or role name. Case-insensitive name lookup.");

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

export function registerRoles(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "discord_create_role",
    {
      title: "Create a role",
      description: "Creates a new role in the guild.",
      inputSchema: {
        name: z.string().min(1).max(100),
        color: z.number().int().min(0).max(0xffffff).optional(),
        permissions: z
          .string()
          .regex(/^\d+$/)
          .optional()
          .describe("Decimal permission bitfield."),
        hoist: z.boolean().optional(),
        mentionable: z.boolean().optional(),
        reason: reasonArg
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
    },
    async ({
      name,
      color,
      permissions,
      hoist,
      mentionable,
      reason
    }: {
      name: string;
      color?: number;
      permissions?: string;
      hoist?: boolean;
      mentionable?: boolean;
      reason?: string;
    }) =>
      run(async () => {
        const body: Record<string, unknown> = { name };
        if (color !== undefined) body.color = color;
        if (permissions) body.permissions = permissions;
        if (hoist !== undefined) body.hoist = hoist;
        if (mentionable !== undefined) body.mentionable = mentionable;
        const out = await ctx.client.request(
          "POST",
          `/guilds/${ctx.guildId}/roles`,
          { body, reason }
        );
        ctx.resolver.invalidate("roles");
        return out;
      })
  );

  server.registerTool(
    "discord_edit_role",
    {
      title: "Edit a role",
      description: "Patches role fields.",
      inputSchema: {
        role: roleArg,
        name: z.string().min(1).max(100).optional(),
        color: z.number().int().min(0).max(0xffffff).optional(),
        permissions: z.string().regex(/^\d+$/).optional(),
        hoist: z.boolean().optional(),
        mentionable: z.boolean().optional(),
        reason: reasonArg
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
    },
    async ({
      role,
      name,
      color,
      permissions,
      hoist,
      mentionable,
      reason
    }: {
      role: string;
      name?: string;
      color?: number;
      permissions?: string;
      hoist?: boolean;
      mentionable?: boolean;
      reason?: string;
    }) =>
      run(async () => {
        const id = await ctx.resolver.roleId(role);
        const body: Record<string, unknown> = {};
        if (name !== undefined) body.name = name;
        if (color !== undefined) body.color = color;
        if (permissions) body.permissions = permissions;
        if (hoist !== undefined) body.hoist = hoist;
        if (mentionable !== undefined) body.mentionable = mentionable;
        const out = await ctx.client.request(
          "PATCH",
          `/guilds/${ctx.guildId}/roles/${id}`,
          { body, reason }
        );
        ctx.resolver.invalidate("roles");
        return out;
      })
  );

  server.registerTool(
    "discord_delete_role",
    {
      title: "Delete a role",
      description:
        "**Destructive — operates on shared server state.** Deletes a role and removes it from all members.",
      inputSchema: { role: roleArg, reason: reasonArg },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true }
    },
    async ({ role, reason }: { role: string; reason?: string }) =>
      run(async () => {
        const id = await ctx.resolver.roleId(role);
        await ctx.client.request(
          "DELETE",
          `/guilds/${ctx.guildId}/roles/${id}`,
          { reason }
        );
        ctx.resolver.invalidate("roles");
        return { deleted: id };
      })
  );

  server.registerTool(
    "discord_assign_role",
    {
      title: "Assign a role",
      description: "Adds a role to a member.",
      inputSchema: { user: userArg, role: roleArg, reason: reasonArg },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
    },
    async ({
      user,
      role,
      reason
    }: {
      user: string;
      role: string;
      reason?: string;
    }) =>
      run(async () => {
        const id = await ctx.resolver.roleId(role);
        await ctx.client.request(
          "PUT",
          `/guilds/${ctx.guildId}/members/${user}/roles/${id}`,
          { reason }
        );
        return { user, role: id, assigned: true };
      })
  );

  server.registerTool(
    "discord_remove_role",
    {
      title: "Remove a role",
      description: "Removes a role from a member.",
      inputSchema: { user: userArg, role: roleArg, reason: reasonArg },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
    },
    async ({
      user,
      role,
      reason
    }: {
      user: string;
      role: string;
      reason?: string;
    }) =>
      run(async () => {
        const id = await ctx.resolver.roleId(role);
        await ctx.client.request(
          "DELETE",
          `/guilds/${ctx.guildId}/members/${user}/roles/${id}`,
          { reason }
        );
        return { user, role: id, removed: true };
      })
  );
}
