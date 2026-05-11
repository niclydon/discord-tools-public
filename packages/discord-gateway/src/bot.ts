import { Client, GatewayIntentBits, Partials } from "discord.js";
import type { AppContext } from "./types.js";
import { handleMessage, handleReaction } from "./handlers.js";
import { handleInteraction } from "./commands.js";

export function startBot(ctx: AppContext): Client {
  const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions
  ];
  if (ctx.config.DISCORD_MESSAGE_CONTENT_INTENT) {
    intents.push(GatewayIntentBits.MessageContent);
  }

  const client = new Client({
    intents,
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
  });

  client.once("ready", () => {
    ctx.logger.info({ user: client.user?.tag }, "discord bot ready");
  });

  client.on("messageCreate", (message) => {
    track(ctx, handleMessage(message, ctx));
  });

  client.on("messageReactionAdd", (reaction, user) => {
    track(ctx, handleReaction(reaction, user, ctx));
  });

  client.on("interactionCreate", (interaction) => {
    track(ctx, handleInteraction(interaction, ctx));
  });

  client.on("error", (error) => {
    ctx.logger.error({ err: error }, "discord client error");
  });

  void client.login(ctx.config.DISCORD_BOT_TOKEN);
  return client;
}

function track(ctx: AppContext, promise: Promise<unknown>): void {
  ctx.inFlight.add(promise);
  promise
    .catch((error) => ctx.logger.error({ err: error }, "discord event handler failed"))
    .finally(() => ctx.inFlight.delete(promise));
}
