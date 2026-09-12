import { describe, expect, test } from "bun:test";
import type { SourceSummary } from "@taiju/contracts";
import {
  SuwayomiClientError,
  SuwayomiContentUnavailableError,
} from "@taiju/sources";
import { app, createApp } from "../src/app";

describe("GET /health", () => {
  test("returns the service health response", async () => {
    const response = await app.request("http://localhost/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      service: "taiju-api",
    });
  });

  test("returns a consistent JSON error for an unknown route", async () => {
    const response = await app.request("http://localhost/unknown");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "not_found",
        message: "The requested resource was not found.",
      },
    });
  });

  test("returns normalized MangaDex search results", async () => {
    const testApp = createApp({
      mangaDexClient: {
        request: async () =>
          new Response(
            JSON.stringify({
              data: [
                {
                  id: "a1e53f6e-0a6e-4d03-9f06-e4761ac50de5",
                  attributes: { title: { en: "Taiju" }, tags: [] },
                  relationships: [],
                },
              ],
              total: 1,
              limit: 20,
              offset: 0,
            }),
          ),
      },
    });
    const response = await testApp.request(
      "http://localhost/api/manga/search?q=Taiju",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [
        {
          provider: "mangadex",
          providerId: "a1e53f6e-0a6e-4d03-9f06-e4761ac50de5",
          title: "Taiju",
          tags: [],
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });
  });

  test("lists source descriptors only through the configured runtime", async () => {
    const testApp = createApp({
      sources: {
        get: async () => undefined,
        list: async () => [
          {
            capabilities: ["search", "details", "chapters", "pages"],
            compatible: true,
            id: "example.source:1",
            language: "en",
            name: "Example",
            provenance: {
              catalogUrl: "https://catalog.example/index.pb",
              packageName: "example.source",
            },
            version: "1.0",
          },
        ],
      },
    });
    const response = await testApp.request("http://localhost/api/sources");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      items: [{ id: "example.source:1", language: "en" }],
    });
  });

  test("validates a selected source through all normalized capabilities", async () => {
    const testApp = createApp({
      sources: {
        list: async () => [
          {
            capabilities: ["search", "details", "chapters", "pages"],
            compatible: true,
            id: "fixture:1",
            language: "en",
            name: "Fixture",
            provenance: {
              catalogUrl: "https://catalog.example/index.pb",
              packageName: "fixture",
            },
            version: "1.0",
          },
        ],
        get: async () => ({
          descriptor: {
            capabilities: ["search", "details", "chapters", "pages"],
            compatible: true,
            id: "fixture:1",
            language: "en",
            name: "Fixture",
            provenance: {
              catalogUrl: "https://catalog.example/index.pb",
              packageName: "fixture",
            },
            version: "1.0",
          },
          search: async () => ({
            failedSourceIds: [],
            hasNextPage: false,
            items: [
              {
                source: { externalId: "m1", sourceId: "fixture:1" },
                tags: [],
                title: "Fixture Manga",
              },
            ],
          }),
          details: async () => ({
            alternativeTitles: [],
            artists: [],
            authors: [],
            source: { externalId: "m1", sourceId: "fixture:1" },
            tags: [],
            title: "Fixture Manga",
          }),
          chapters: async () => ({
            items: [
              {
                chapter: "1",
                manga: { externalId: "m1", sourceId: "fixture:1" },
                source: { externalId: "c1", sourceId: "fixture:1" },
                title: "Chapter 1",
              },
            ],
          }),
          pages: async () => ({
            pageUrls: ["https://images.example/1.jpg"],
            source: { externalId: "c1", sourceId: "fixture:1" },
          }),
        }),
      },
    });
    const response = await testApp.request(
      "http://localhost/api/sources/validate?q=fixture&source=fixture:1",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      failedSourceIds: [],
      items: [{ sourceId: "fixture:1", passed: true }],
    });
  });

  test("returns conservative equivalent-source alternatives", async () => {
    const descriptor = (id: string, name: string): SourceSummary => ({
      capabilities: ["search", "details", "chapters", "pages"],
      compatible: true,
      id,
      language: "en",
      name,
      provenance: {
        catalogUrl: "https://catalog.example/index.pb",
        packageName: id,
      },
      version: "1.0",
    });
    const testApp = createApp({
      sources: {
        list: async () => [
          descriptor("source:1", "Primary"),
          descriptor("source:2", "Mirror"),
        ],
        get: async (id) => ({
          descriptor: descriptor(id, id === "source:1" ? "Primary" : "Mirror"),
          search: async () => ({
            failedSourceIds: [],
            hasNextPage: false,
            items:
              id === "source:2"
                ? [
                    {
                      source: { externalId: "m2", sourceId: id },
                      tags: [],
                      title: "Same Manga",
                    },
                    {
                      source: { externalId: "other", sourceId: id },
                      tags: [],
                      title: "Different Manga",
                    },
                  ]
                : [],
          }),
          details: async () => ({
            alternativeTitles: [],
            artists: [],
            authors: [],
            source: { externalId: "m1", sourceId: id },
            tags: [],
            title: "Same Manga",
          }),
          chapters: async () => ({ items: [] }),
          pages: async () => ({
            pageUrls: ["https://images.example/1.jpg"],
            source: { externalId: "c1", sourceId: id },
          }),
        }),
      },
    });
    const response = await testApp.request(
      "http://localhost/api/manga/source%3A1/m1/alternatives",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [
        {
          source: { externalId: "m2", sourceId: "source:2" },
          tags: [],
          title: "Same Manga",
        },
      ],
    });
  });

  test("groups cross-source discovery only when title and tags agree", async () => {
    const descriptor = (id: string): SourceSummary => ({
      capabilities: ["search"],
      compatible: true,
      id,
      language: "en",
      name: id,
      provenance: { catalogUrl: "https://catalog.example/index.pb", packageName: id },
      version: "1.0",
    });
    const testApp = createApp({
      sources: {
        get: async (id) => ({
          chapters: async () => ({ items: [] }),
          descriptor: descriptor(id),
          details: async () => ({
            alternativeTitles: [], artists: [], authors: [],
            source: { externalId: "manga", sourceId: id }, tags: ["Action"], title: "Same Manga",
          }),
          pages: async () => ({ pageUrls: ["https://images.example/1.jpg"], source: { externalId: "chapter", sourceId: id } }),
          search: async () => ({
            failedSourceIds: [], hasNextPage: false,
            items: [{ source: { externalId: `manga-${id}`, sourceId: id }, tags: ["Action"], title: "Same Manga" }],
          }),
        }),
        list: async () => [descriptor("source:1"), descriptor("source:2")],
      },
    });
    const response = await testApp.request(
      "http://localhost/api/manga/search?q=Same&source=all",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      items: [{ items: [{ source: { sourceId: "source:1" } }, { source: { sourceId: "source:2" } }], title: "Same Manga" }],
    });
  });

  test("returns normalized popular source discovery without a fixed source", async () => {
    const testApp = createApp({
      sources: {
        get: async () => ({
          chapters: async () => ({ items: [] }),
          descriptor: {
            capabilities: ["search"],
            compatible: true,
            id: "source:1",
            language: "en",
            name: "Example",
            provenance: {
              catalogUrl: "https://catalog.example/index.pb",
              packageName: "example.source",
            },
            version: "1.0",
          },
          details: async () => ({
            alternativeTitles: [],
            artists: [],
            authors: [],
            source: { externalId: "m1", sourceId: "source:1" },
            tags: ["Action"],
            title: "Popular Manga",
          }),
          discover: async ({ kind }) => ({
            failedSourceIds: [],
            hasNextPage: false,
            items: [
              {
                source: { externalId: "m1", sourceId: "source:1" },
                tags: ["Action"],
                title: kind === "popular" ? "Popular Manga" : "Latest Manga",
              },
            ],
          }),
          pages: async () => ({
            pageUrls: ["https://images.example/1.jpg"],
            source: { externalId: "chapter", sourceId: "source:1" },
          }),
          search: async () => ({ failedSourceIds: [], hasNextPage: false, items: [] }),
        }),
        list: async () => [],
      },
    });
    const response = await testApp.request(
      "http://localhost/api/manga/discover?kind=popular&source=source%3A1",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      items: [{ title: "Popular Manga" }],
    });
  });

  test("delegates a selected source search through the neutral contract", async () => {
    const testApp = createApp({
      sources: {
        get: async () => ({
          chapters: async () => ({ items: [] }),
          descriptor: {
            capabilities: ["search"],
            compatible: true,
            id: "example.source:1",
            language: "en",
            name: "Example",
            provenance: {
              catalogUrl: "https://catalog.example/index.pb",
              packageName: "example.source",
            },
            version: "1.0",
          },
          details: async () => ({
            alternativeTitles: [],
            artists: [],
            authors: [],
            source: { externalId: "1", sourceId: "example.source:1" },
            tags: [],
            title: "Taiju",
          }),
          pages: async () => ({
            pageUrls: ["https://images.example/1.jpg"],
            source: { externalId: "1", sourceId: "example.source:1" },
          }),
          search: async ({ query }) => ({
            failedSourceIds: [],
            hasNextPage: false,
            items: [
              {
                source: { externalId: "1", sourceId: "example.source:1" },
                tags: [],
                title: query,
              },
            ],
          }),
        }),
        list: async () => [],
      },
    });
    const response = await testApp.request(
      "http://localhost/api/manga/search?q=Taiju&source=example.source%3A1",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      failedSourceIds: [],
      hasNextPage: false,
      items: [
        {
          source: { externalId: "1", sourceId: "example.source:1" },
          tags: [],
          title: "Taiju",
        },
      ],
    });
  });

  test("translates source runtime failures without exposing host errors", async () => {
    const testApp = createApp({
      sources: {
        get: async () => ({
          chapters: async () => ({ items: [] }),
          descriptor: {
            capabilities: ["search"],
            compatible: true,
            id: "example.source:1",
            language: "en",
            name: "Example",
            provenance: {
              catalogUrl: "https://catalog.example/index.pb",
              packageName: "example.source",
            },
            version: "1.0",
          },
          details: async () => {
            throw new SuwayomiClientError("Host diagnostic");
          },
          pages: async () => ({
            pageUrls: ["https://images.example/1.jpg"],
            source: { externalId: "1", sourceId: "example.source:1" },
          }),
          search: async () => ({
            failedSourceIds: [],
            hasNextPage: false,
            items: [],
          }),
        }),
        list: async () => [],
      },
    });
    const response = await testApp.request(
      "http://localhost/api/manga/example.source%3A1/1",
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: {
        code: "source_runtime_unavailable",
        message: "The selected source is unavailable.",
      },
    });
  });

  test("reports unavailable source chapter pages without exposing host errors", async () => {
    const testApp = createApp({
      sources: {
        get: async () => ({
          chapters: async () => ({ items: [] }),
          descriptor: {
            capabilities: ["search", "details", "chapters", "pages"],
            compatible: true,
            id: "example.source:1",
            language: "en",
            name: "Example",
            provenance: {
              catalogUrl: "https://catalog.example/index.pb",
              packageName: "example.source",
            },
            version: "1.0",
          },
          details: async () => ({
            alternativeTitles: [],
            artists: [],
            authors: [],
            source: { externalId: "1", sourceId: "example.source:1" },
            tags: [],
            title: "Taiju",
          }),
          pages: async () => {
            throw new SuwayomiContentUnavailableError("Host diagnostic");
          },
          search: async () => ({
            failedSourceIds: [],
            hasNextPage: false,
            items: [],
          }),
        }),
        list: async () => [],
      },
    });
    const response = await testApp.request(
      "http://localhost/api/chapters/example.source%3A1/1/pages",
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "content_unavailable",
        message:
          "This chapter has no readable pages available from the selected source.",
      },
    });
  });

  test("returns normalized manga details", async () => {
    const testApp = createApp({
      mangaDexClient: {
        request: async () =>
          new Response(
            JSON.stringify({
              data: {
                id: "a1e53f6e-0a6e-4d03-9f06-e4761ac50de5",
                attributes: {
                  title: { en: "Taiju" },
                  altTitles: [{ ja: "大樹" }],
                  availableTranslatedLanguages: ["en"],
                  tags: [],
                },
                relationships: [
                  { type: "author", attributes: { name: "Author" } },
                ],
              },
            }),
          ),
      },
    });
    const response = await testApp.request(
      "http://localhost/api/manga/mangadex/a1e53f6e-0a6e-4d03-9f06-e4761ac50de5",
    );
    expect(response.status).toBe(200);
    expect((await response.json()).authors).toEqual(["Author"]);
  });

  test("returns normalized chapters with a language filter", async () => {
    const testApp = createApp({
      mangaDexClient: {
        request: async () =>
          new Response(
            JSON.stringify({
              data: [
                {
                  id: "a1e53f6e-0a6e-4d03-9f06-e4761ac50de5",
                  attributes: {
                    chapter: "1",
                    createdAt: "2026-01-01T00:00:00.000Z",
                    translatedLanguage: "en",
                    publishAt: "2026-01-01T00:00:00.000Z",
                  },
                  relationships: [],
                },
              ],
              total: 1,
              limit: 20,
              offset: 0,
            }),
          ),
      },
    });
    const response = await testApp.request(
      "http://localhost/api/manga/mangadex/c1e53f6e-0a6e-4d03-9f06-e4761ac50de5/chapters?language=en",
    );
    expect(response.status).toBe(200);
    expect((await response.json()).items[0].language).toBe("en");
  });

  test("returns resolved reader pages", async () => {
    const testApp = createApp({
      mangaDexClient: {
        request: async () =>
          new Response(
            JSON.stringify({
              baseUrl: "https://uploads.mangadex.org",
              chapter: { hash: "hash", data: ["1.jpg"] },
            }),
          ),
      },
    });
    const response = await testApp.request(
      "http://localhost/api/chapters/mangadex/a1e53f6e-0a6e-4d03-9f06-e4761ac50de5/pages",
    );
    expect(response.status).toBe(200);
    expect((await response.json()).pageUrls).toEqual([
      "https://uploads.mangadex.org/data/hash/1.jpg",
    ]);
  });
});
