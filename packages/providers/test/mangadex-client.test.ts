import { describe, expect, test } from "bun:test";
import {
  MangaDexClient,
  MangaDexHttpError,
  MangaDexRateLimitError,
  MangaDexTimeoutError,
} from "../src";

describe("MangaDexClient", () => {
  test("requests the configured MangaDex origin with JSON acceptance", async () => {
    let requestedUrl: URL | undefined;
    let requestedHeaders: Headers | undefined;
    const client = new MangaDexClient({
      baseUrl: "https://mangadex.test",
      fetch: async (input, init) => {
        requestedUrl = new URL(input.toString());
        requestedHeaders = new Headers(init?.headers);
        return new Response("{}", { status: 200 });
      },
    });

    await client.request("/manga?limit=10");

    expect(requestedUrl?.toString()).toBe(
      "https://mangadex.test/manga?limit=10",
    );
    expect(requestedHeaders?.get("accept")).toBe("application/json");
  });

  test("translates rate-limit responses and exposes their metadata", async () => {
    const client = new MangaDexClient({
      fetch: async () =>
        new Response(null, {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "5",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Retry-After": "1700000000",
          },
        }),
    });

    try {
      await client.request("/manga");
      throw new Error("Expected a rate-limit error.");
    } catch (error) {
      expect(error).toBeInstanceOf(MangaDexRateLimitError);
      expect((error as MangaDexRateLimitError).rateLimit).toEqual({
        limit: 5,
        remaining: 0,
        retryAfter: 1_700_000_000,
      });
    }
  });

  test("translates non-success responses", async () => {
    const client = new MangaDexClient({
      fetch: async () => new Response(null, { status: 503 }),
    });

    await expect(client.request("/manga")).rejects.toBeInstanceOf(
      MangaDexHttpError,
    );
  });

  test("cancels requests that exceed the configured timeout", async () => {
    const client = new MangaDexClient({
      timeoutMs: 1,
      fetch: async (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    });

    await expect(client.request("/manga")).rejects.toBeInstanceOf(
      MangaDexTimeoutError,
    );
  });
});
