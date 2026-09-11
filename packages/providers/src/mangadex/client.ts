import {
  MangaDexHttpError,
  type MangaDexRateLimit,
  MangaDexRateLimitError,
  MangaDexTimeoutError,
} from "./errors";

const DEFAULT_BASE_URL = "https://api.mangadex.org";
const DEFAULT_TIMEOUT_MS = 10_000;

type FetchFunction = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type MangaDexClientOptions = {
  baseUrl?: string;
  fetch?: FetchFunction;
  timeoutMs?: number;
};

export type MangaDexRequestOptions = Omit<RequestInit, "headers" | "signal"> & {
  headers?: HeadersInit;
  signal?: AbortSignal;
};

export class MangaDexClient {
  private readonly baseUrl: URL;
  private readonly fetch: FetchFunction;
  private readonly timeoutMs: number;

  constructor(options: MangaDexClientOptions = {}) {
    this.baseUrl = new URL(options.baseUrl ?? DEFAULT_BASE_URL);
    this.fetch = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    if (this.timeoutMs <= 0) {
      throw new Error("MangaDex timeout must be greater than zero.");
    }
  }

  async request(
    path: string,
    options: MangaDexRequestOptions = {},
  ): Promise<Response> {
    const url = this.buildUrl(path);
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(options.signal?.reason);
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    options.signal?.addEventListener("abort", abortFromCaller, { once: true });

    if (options.signal?.aborted) {
      abortFromCaller();
    }

    try {
      const headers = new Headers(options.headers);
      headers.set("Accept", "application/json");

      const response = await this.fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (response.status === 429) {
        throw new MangaDexRateLimitError(readRateLimit(response.headers));
      }

      if (!response.ok) {
        throw new MangaDexHttpError(
          `MangaDex request failed with status ${response.status}.`,
          response.status,
          readRateLimit(response.headers),
        );
      }

      return response;
    } catch (error) {
      if (controller.signal.aborted && !options.signal?.aborted) {
        throw new MangaDexTimeoutError(this.timeoutMs);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abortFromCaller);
    }
  }

  private buildUrl(path: string): URL {
    if (!path.startsWith("/")) {
      throw new Error("MangaDex request paths must start with '/'.");
    }

    const url = new URL(path, this.baseUrl);

    if (url.origin !== this.baseUrl.origin) {
      throw new Error("MangaDex requests cannot target another origin.");
    }

    return url;
  }
}

function readRateLimit(headers: Headers): MangaDexRateLimit {
  return {
    limit: readNumberHeader(headers, "x-ratelimit-limit"),
    remaining: readNumberHeader(headers, "x-ratelimit-remaining"),
    retryAfter: readNumberHeader(headers, "x-ratelimit-retry-after"),
  };
}

function readNumberHeader(headers: Headers, name: string): number | undefined {
  const value = headers.get(name);

  if (value === null) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
