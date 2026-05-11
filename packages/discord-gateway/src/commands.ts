import type { ChatInputCommandInteraction, Interaction } from "discord.js";
import type { AppContext } from "./types.js";

export async function handleInteraction(interaction: Interaction, ctx: AppContext): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "gateway-status") {
    await status(interaction, ctx);
  } else if (interaction.commandName === "gateway-routes") {
    await routes(interaction, ctx);
  }
}

async function status(interaction: ChatInputCommandInteraction, ctx: AppContext): Promise<void> {
  await interaction.reply({
    ephemeral: true,
    content: JSON.stringify({
      ok: true,
      uptime_s: Math.round((Date.now() - ctx.startedAt.getTime()) / 1000),
      routes: ctx.routes.status(),
      in_flight: ctx.inFlight.size
    }, null, 2)
  });
}

async function routes(interaction: ChatInputCommandInteraction, ctx: AppContext): Promise<void> {
  const list = ctx.routes.list().map((route) => ({
    channel_id: route.channel_id,
    name: route.name,
    handler: route.handler
  }));
  await interaction.reply({
    ephemeral: true,
    content: JSON.stringify(list, null, 2).slice(0, 1900)
  });
}
