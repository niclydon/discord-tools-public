import type { Client, Message, MessageReaction, PartialMessageReaction, PartialUser, User } from "discord.js";
import type { Logger } from "pino";
import type { Config } from "./config.js";
import type { EventLog } from "./event-log.js";
import type { RouteStore } from "./routes.js";

export type HandlerName = "receipt" | "echo" | "webhook" | "ignore";

export interface ChannelRoute {
  channel_id: string;
  name: string;
  handler: HandlerName;
  webhook_url?: string;
  allowed_user_ids?: string[];
}

export interface RouteFile {
  routes: ChannelRoute[];
}

export interface AppContext {
  config: Config;
  logger: Logger;
  routes: RouteStore;
  eventLog: EventLog;
  discordClient?: Client;
  shuttingDown: boolean;
  inFlight: Set<Promise<unknown>>;
  seenEvents: Set<string>;
  startedAt: Date;
}

export interface GatewayMessageEvent {
  kind: "message";
  event_id: string;
  route: ChannelRoute | null;
  message_id: string;
  channel_id: string;
  thread_id: string | null;
  author_id: string;
  content: string;
  created_at: string;
  reference_message_id: string | null;
}

export interface GatewayReactionEvent {
  kind: "reaction";
  event_id: string;
  route: ChannelRoute | null;
  message_id: string;
  channel_id: string;
  thread_id: string | null;
  user_id: string;
  emoji: string;
  created_at: string;
}

export type GatewayEvent = GatewayMessageEvent | GatewayReactionEvent;

export type ReactionInput = MessageReaction | PartialMessageReaction;
export type UserInput = User | PartialUser;
export type MessageInput = Message;
