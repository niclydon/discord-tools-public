import type { Message, TextBasedChannel } from "discord.js";
import type { AppContext, ChannelRoute, GatewayEvent, ReactionInput, UserInput } from "./types.js";

function shortId(value: string): string {
  return value.length <= 18 ? value : `${value.slice(0, 18)}...`;
}

function routeLabel(route: ChannelRoute | null): string {
  return route ? `${route.name} (${route.handler})` : "unregistered channel";
}

function userAllowed(userId: string, route: ChannelRoute | null, ctx: AppContext): boolean {
  if (ctx.config.operatorUserIds.size > 0 && !ctx.config.operatorUserIds.has(userId)) return false;
  if (route?.allowed_user_ids?.length && !route.allowed_user_ids.includes(userId)) return false;
  return true;
}

async function reply(message: Message, content: string): Promise<void> {
  await message.reply({ content, allowedMentions: { parse: [] } });
}

async function sendToWebhook(event: GatewayEvent, route: ChannelRoute | null, ctx: AppContext): Promise<void> {
  const url = route?.webhook_url ?? ctx.config.ACTION_WEBHOOK_URL;
  if (!url) throw new Error("No webhook URL configured for this route or ACTION_WEBHOOK_URL");
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Webhook returned HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
}

export async function handleMessage(message: Message, ctx: AppContext): Promise<void> {
  if (ctx.shuttingDown || message.author.bot) return;
  const route = await ctx.routes.resolveMessage(message);
  if (!route && !ctx.config.ACK_UNREGISTERED) return;
  if (!userAllowed(message.author.id, route, ctx)) return;

  const eventId = `message:${message.id}`;
  if (ctx.seenEvents.has(eventId)) return;
  ctx.seenEvents.add(eventId);

  const event = {
    kind: "message" as const,
    event_id: eventId,
    route,
    message_id: message.id,
    channel_id: message.channelId,
    thread_id: message.channel.isThread() ? message.channel.id : null,
    author_id: message.author.id,
    content: message.content ?? "",
    created_at: message.createdAt.toISOString(),
    reference_message_id: message.reference?.messageId ?? null
  };

  try {
    if (!route) {
      await ctx.eventLog.append({ ...event, outcome: "unregistered" });
      await reply(message, `Received your message, but this channel is not registered. Receipt: \`${shortId(eventId)}\`.`);
      await message.react("⚠️");
      return;
    }

    if (route.handler === "ignore") {
      await ctx.eventLog.append({ ...event, outcome: "ignored" });
      return;
    }

    if (route.handler === "echo") {
      await ctx.eventLog.append({ ...event, outcome: "echo" });
      await reply(message, `Echo from ${routeLabel(route)}:\n${event.content || "(message content unavailable)"}`);
      await message.react("✅");
      return;
    }

    if (route.handler === "webhook") {
      await sendToWebhook(event, route, ctx);
      await ctx.eventLog.append({ ...event, outcome: "webhook_ok" });
      await reply(message, `Received your message in ${routeLabel(route)} and forwarded it. Receipt: \`${shortId(eventId)}\`.`);
      await message.react("✅");
      return;
    }

    await ctx.eventLog.append({ ...event, outcome: "receipt" });
    await reply(message, `Received your message in ${routeLabel(route)}. No action handler ran. Receipt: \`${shortId(eventId)}\`.`);
    await message.react("✅");
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await ctx.eventLog.append({ ...event, outcome: "error", error });
    await reply(message, `Received your message in ${routeLabel(route)}, but handling failed: ${error}. Receipt: \`${shortId(eventId)}\`.`);
    throw err;
  }
}

export async function handleReaction(reactionInput: ReactionInput, userInput: UserInput, ctx: AppContext): Promise<void> {
  if (ctx.shuttingDown) return;
  const reaction = reactionInput.partial ? await reactionInput.fetch() : reactionInput;
  const user = userInput.partial ? await userInput.fetch() : userInput;
  if (user.bot) return;

  const route = await ctx.routes.resolveReaction(reaction);
  if (!route && !ctx.config.ACK_UNREGISTERED) return;
  if (!userAllowed(user.id, route, ctx)) return;

  const emoji = reaction.emoji.name ?? reaction.emoji.id ?? "unknown";
  const eventId = `reaction:${reaction.message.id}:${user.id}:${emoji}`;
  if (ctx.seenEvents.has(eventId)) return;
  ctx.seenEvents.add(eventId);

  const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
  const event = {
    kind: "reaction" as const,
    event_id: eventId,
    route,
    message_id: message.id,
    channel_id: message.channelId,
    thread_id: message.channel.isThread() ? message.channel.id : null,
    user_id: user.id,
    emoji,
    created_at: new Date().toISOString()
  };

  try {
    if (route?.handler === "webhook") {
      await sendToWebhook(event, route, ctx);
      await ctx.eventLog.append({ ...event, outcome: "webhook_ok" });
      await reply(message, `Received your ${emoji} reaction in ${routeLabel(route)} and forwarded it. Receipt: \`${shortId(eventId)}\`.`);
      return;
    }

    await ctx.eventLog.append({ ...event, outcome: route ? route.handler : "unregistered" });
    const channel = message.channel as TextBasedChannel;
    if ("send" in channel) {
      await reply(message, `Received your ${emoji} reaction in ${routeLabel(route)}. Receipt: \`${shortId(eventId)}\`.`);
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await ctx.eventLog.append({ ...event, outcome: "error", error });
    await reply(message, `Received your ${emoji} reaction in ${routeLabel(route)}, but handling failed: ${error}. Receipt: \`${shortId(eventId)}\`.`);
    throw err;
  }
}
