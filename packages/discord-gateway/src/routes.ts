import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { Message, MessageReaction } from "discord.js";
import type { ChannelRoute, RouteFile } from "./types.js";

const HandlerSchema = z.enum(["receipt", "echo", "webhook", "ignore"]);

const RouteSchema = z.object({
  channel_id: z.string().regex(/^\d+$/),
  name: z.string().min(1),
  handler: HandlerSchema,
  webhook_url: z.string().url().optional(),
  allowed_user_ids: z.array(z.string().regex(/^\d+$/)).optional()
});

const RouteFileSchema = z.object({
  routes: z.array(RouteSchema)
});

export class RouteStore {
  private routes = new Map<string, ChannelRoute>();
  private loadedAt: Date | null = null;

  constructor(private readonly filePath: string) {}

  async load(): Promise<void> {
    const raw = await readFile(this.filePath, "utf8");
    const parsed = RouteFileSchema.parse(JSON.parse(raw)) as RouteFile;
    this.routes = new Map(parsed.routes.map((route) => [route.channel_id, route]));
    this.loadedAt = new Date();
  }

  list(): ChannelRoute[] {
    return [...this.routes.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  status(): { route_count: number; loaded_at: string | null; file: string } {
    return {
      route_count: this.routes.size,
      loaded_at: this.loadedAt?.toISOString() ?? null,
      file: this.filePath
    };
  }

  async resolveMessage(message: Message): Promise<ChannelRoute | null> {
    const direct = this.routes.get(message.channelId);
    if (direct) return direct;
    if (!message.channel.isThread()) return null;
    const parentId = message.channel.parentId;
    return parentId ? this.routes.get(parentId) ?? null : null;
  }

  async resolveReaction(reaction: MessageReaction): Promise<ChannelRoute | null> {
    const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
    const direct = this.routes.get(message.channelId);
    if (direct) return direct;
    if (!message.channel.isThread()) return null;
    const parentId = message.channel.parentId;
    return parentId ? this.routes.get(parentId) ?? null : null;
  }
}
