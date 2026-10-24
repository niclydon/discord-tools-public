const API = "https://discord.com/api/v10";

export interface DiscordClientOptions {
  token: string;
  version: string;
  fetchImpl?: typeof fetch;
  maxRetry?: number;
}

export interface RequestFile {
  filename: string;
  data: Uint8Array;
  contentType?: string;
}

export interface RequestOptions {
  body?: unknown;
  reason?: string;
  query?: Record<string, string | number | undefined>;
  bucketHint?: string;
  /**
   * When set, the request is sent as multipart/form-data: `body` is serialized
   * into the `payload_json` part and each file is appended as `files[n]`. Used
   * to upload image attachments (e.g. generated image cards).
   */
  files?: RequestFile[];
}

export interface DiscordHttpError extends Error {
  status: number;
  code?: number;
  retryAfter?: number;
  body: unknown;
}

interface BucketState {
  resetAt: number;
  remaining: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class DiscordClient {
  private token: string;
  private ua: string;
  private fetch: typeof fetch;
  private maxRetry: number;
  private buckets = new Map<string, BucketState>();
  private bucketChain = new Map<string, Promise<void>>();

  constructor(opts: DiscordClientOptions) {
    this.token = opts.token;
    this.ua = `discord-mcp/${opts.version}`;
    this.fetch = opts.fetchImpl ?? globalThis.fetch;
    this.maxRetry = opts.maxRetry ?? 1;
  }

  private async waitBucket(bucket: string | undefined): Promise<void> {
    if (!bucket) return;
    const state = this.buckets.get(bucket);
    if (state && state.remaining <= 0) {
      const wait = state.resetAt - Date.now();
      if (wait > 0) await sleep(wait);
    }
  }

  private updateBucket(bucket: string | undefined, headers: Headers): void {
    if (!bucket) return;
    const remaining = Number(headers.get("x-ratelimit-remaining"));
    const reset = Number(headers.get("x-ratelimit-reset-after"));
    if (Number.isFinite(remaining) && Number.isFinite(reset)) {
      this.buckets.set(bucket, {
        remaining,
        resetAt: Date.now() + reset * 1000
      });
    }
  }

  async request<T = unknown>(
    method: string,
    path: string,
    opts: RequestOptions = {}
  ): Promise<T> {
    const bucket = opts.bucketHint;
    const prior = bucket ? this.bucketChain.get(bucket) : undefined;
    let release!: () => void;
    const next = new Promise<void>((r) => (release = r));
    if (bucket) this.bucketChain.set(bucket, (prior ?? Promise.resolve()).then(() => next));
    try {
      if (prior) await prior;
      await this.waitBucket(bucket);
      return await this.executeWithRetry<T>(method, path, opts, 0);
    } finally {
      release();
      if (bucket && this.bucketChain.get(bucket) === next) {
        this.bucketChain.delete(bucket);
      }
    }
  }

  private async executeWithRetry<T>(
    method: string,
    path: string,
    opts: RequestOptions,
    attempt: number
  ): Promise<T> {
    const url = new URL(API + path);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined && v !== null && v !== "") {
          url.searchParams.set(k, String(v));
        }
      }
    }
    const headers: Record<string, string> = {
      Authorization: `Bot ${this.token}`,
      "User-Agent": this.ua
    };
    // Rebuilt fresh on every attempt so retries get an unconsumed body.
    let body: string | FormData | undefined;
    if (opts.files && opts.files.length > 0) {
      const form = new FormData();
      form.append("payload_json", JSON.stringify(opts.body ?? {}));
      opts.files.forEach((f, i) => {
        form.append(
          `files[${i}]`,
          new Blob([f.data], { type: f.contentType ?? "application/octet-stream" }),
          f.filename
        );
      });
      // Do NOT set Content-Type — fetch derives the multipart boundary itself.
      body = form;
    } else if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
    if (opts.reason) {
      headers["X-Audit-Log-Reason"] = encodeURIComponent(opts.reason);
    }
    const resp = await this.fetch(url.toString(), { method, headers, body });
    const bucket =
      opts.bucketHint || resp.headers.get("x-ratelimit-bucket") || undefined;
    this.updateBucket(bucket ?? undefined, resp.headers);

    if (resp.status === 204) return undefined as T;

    const text = await resp.text();
    const data = text ? JSON.parse(text) : undefined;

    if (resp.status === 429 && attempt < this.maxRetry) {
      const wait = Math.min(((data as any)?.retry_after ?? 1) * 1000, 10_000);
      await sleep(wait);
      return this.executeWithRetry<T>(method, path, opts, attempt + 1);
    }
    if (resp.status >= 500 && resp.status < 600 && attempt < this.maxRetry) {
      await sleep(1000);
      return this.executeWithRetry<T>(method, path, opts, attempt + 1);
    }
    if (!resp.ok) {
      const err: DiscordHttpError = Object.assign(
        new Error(`Discord ${resp.status}`),
        {
          status: resp.status,
          code: (data as any)?.code,
          retryAfter: (data as any)?.retry_after,
          body: data
        }
      );
      throw err;
    }
    return data as T;
  }
}
