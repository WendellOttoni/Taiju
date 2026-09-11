import { describe, expect, test } from "bun:test";
import {
  getChapterFeed,
  MangaDexClient,
  MangaDexHttpError,
  MangaDexRateLimitError,
  MangaDexTimeoutError,
  resolveChapterPages,
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

test("normalizes a paginated MangaDex chapter feed", async () => {
  let path = "";
  const result = await getChapterFeed(
    {
      request: async (value) => {
        path = value;
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "a1e53f6e-0a6e-4d03-9f06-e4761ac50de5",
                attributes: {
                  chapter: "1",
                  translatedLanguage: "en",
                  publishAt: "2026-01-01T00:00:00.000Z",
                  createdAt: "2026-01-01T00:00:00.000Z",
                },
                relationships: [
                  {
                    type: "scanlation_group",
                    id: "b1e53f6e-0a6e-4d03-9f06-e4761ac50de5",
                    attributes: { name: "Group" },
                  },
                ],
              },
            ],
            total: 1,
            limit: 20,
            offset: 0,
          }),
        );
      },
    },
    "c1e53f6e-0a6e-4d03-9f06-e4761ac50de5",
    { languages: ["en"] },
  );
  expect(path).toContain("translatedLanguage%5B%5D=en");
  expect(result.items[0]?.scanlationGroup?.name).toBe("Group");
});

test("uses the MangaDex creation timestamp when a chapter has no publication timestamp", async () => {
  const result = await getChapterFeed(
    {
      request: async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                id: "a1e53f6e-0a6e-4d03-9f06-e4761ac50de5",
                attributes: {
                  createdAt: "2026-01-02T00:00:00.000Z",
                  publishAt: null,
                  translatedLanguage: "en",
                },
              },
            ],
            total: 1,
            limit: 20,
            offset: 0,
          }),
        ),
    },
    "c1e53f6e-0a6e-4d03-9f06-e4761ac50de5",
  );
  expect(result.items[0]?.publishedAt).toBe("2026-01-02T00:00:00.000Z");
});

test("resolves MangaDex@Home pages through the provider protocol", async () => {
  const result = await resolveChapterPages(
    {
      request: async () =>
        new Response(
          JSON.stringify({
            baseUrl: "https://uploads.mangadex.org",
            chapter: { hash: "hash", data: ["1.jpg"] },
          }),
        ),
    },
    "a1e53f6e-0a6e-4d03-9f06-e4761ac50de5",
  );
  expect(result.pages).toEqual([
    "https://uploads.mangadex.org/data/hash/1.jpg",
  ]);
});
