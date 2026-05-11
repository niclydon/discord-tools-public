import type { DiscordClient } from "./client.ts";

export interface ResolverOptions {
  ttlMs?: number;
}

interface CacheEntry<T> {
  expiresAt: number;
  data: T;
}

interface ChannelLite {
  id: string;
  name: string;
  type: number;
}
interface RoleLite {
  id: string;
  name: string;
}

export class Resolver {
  private channels?: CacheEntry<ChannelLite[]>;
  private roles?: CacheEntry<RoleLite[]>;
  private ttl: number;

  constructor(
    private client: DiscordClient,
    private guildId: string,
    opts: ResolverOptions = {}
  ) {
    this.ttl = opts.ttlMs ?? 60_000;
  }

  invalidate(what: "channels" | "roles" | "all"): void {
    if (what === "channels" || what === "all") this.channels = undefined;
    if (what === "roles" || what === "all") this.roles = undefined;
  }

  private async getChannels(): Promise<ChannelLite[]> {
    if (this.channels && this.channels.expiresAt > Date.now()) {
      return this.channels.data;
    }
    const data = await this.client.request<ChannelLite[]>(
      "GET",
      `/guilds/${this.guildId}/channels`
    );
    this.channels = { expiresAt: Date.now() + this.ttl, data };
    return data;
  }

  private async getRoles(): Promise<RoleLite[]> {
    if (this.roles && this.roles.expiresAt > Date.now()) {
      return this.roles.data;
    }
    const data = await this.client.request<RoleLite[]>(
      "GET",
      `/guilds/${this.guildId}/roles`
    );
    this.roles = { expiresAt: Date.now() + this.ttl, data };
    return data;
  }

  async channelId(nameOrId: string): Promise<string> {
    if (/^\d+$/.test(nameOrId)) return nameOrId;
    const list = await this.getChannels();
    const lc = nameOrId.toLowerCase();
    const hit = list.find((c) => c.name.toLowerCase() === lc);
    if (!hit) {
      throw new Error(
        `No channel named '${nameOrId}' in guild ${this.guildId}`
      );
    }
    return hit.id;
  }

  async roleId(nameOrId: string): Promise<string> {
    if (/^\d+$/.test(nameOrId)) return nameOrId;
    const list = await this.getRoles();
    const lc = nameOrId.toLowerCase();
    const hit = list.find((r) => r.name.toLowerCase() === lc);
    if (!hit) {
      throw new Error(`No role named '${nameOrId}' in guild ${this.guildId}`);
    }
    return hit.id;
  }
}
