import { vi } from "vitest";

export type RecordedRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
};

export type MockResponse = {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
};

export interface MockFetchHandle {
  recorded: RecordedRequest[];
  enqueue: (resp: MockResponse | ((req: RecordedRequest) => MockResponse)) => void;
  restore: () => void;
}

export function installMockFetch(): MockFetchHandle {
  const recorded: RecordedRequest[] = [];
  const queue: Array<MockResponse | ((req: RecordedRequest) => MockResponse)> = [];
  const original = globalThis.fetch;

  globalThis.fetch = vi.fn(async (input: any, init: any = {}) => {
    const url = typeof input === "string" ? input : input.url;
    const method = (init.method || "GET").toUpperCase();
    const headers: Record<string, string> = {};
    if (init.headers) {
      for (const [k, v] of Object.entries(init.headers as Record<string, string>)) {
        headers[k.toLowerCase()] = String(v);
      }
    }
    const req: RecordedRequest = { url, method, headers, body: init.body };
    recorded.push(req);
    const next = queue.shift();
    if (!next) throw new Error(`mock-fetch: no response queued for ${method} ${url}`);
    const resp = typeof next === "function" ? next(req) : next;
    return new Response(
      resp.body == null ? null : JSON.stringify(resp.body),
      {
        status: resp.status,
        headers: { "content-type": "application/json", ...(resp.headers || {}) }
      }
    );
  }) as any;

  return {
    recorded,
    enqueue: (resp) => queue.push(resp),
    restore: () => {
      globalThis.fetch = original;
    }
  };
}
