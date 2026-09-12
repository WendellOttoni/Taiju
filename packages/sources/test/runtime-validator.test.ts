import { describe, expect, test } from "bun:test";

import type { ReadingSource } from "../src";
import { validateReadingSource } from "../src";

function source(overrides: Partial<ReadingSource> = {}): ReadingSource {
  return {
    descriptor: {
      capabilities: ["search", "details", "chapters", "pages"],
      compatible: true,
      id: "fixture:1",
      language: "en",
      name: "Fixture",
      provenance: {
        catalogUrl: "https://catalog.test/index.pb",
        packageName: "fixture",
      },
      version: "1",
    },
    search: async () => ({
      failedSourceIds: [],
      hasNextPage: false,
      items: [
        {
          source: { externalId: "m1", sourceId: "fixture:1" },
          title: "Manga",
          tags: [],
        },
      ],
    }),
    details: async () => ({
      alternativeTitles: [],
      artists: [],
      authors: [],
      source: { externalId: "m1", sourceId: "fixture:1" },
      status: "unknown",
      tags: [],
      title: "Manga",
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
      pageUrls: ["https://images.test/1.jpg"],
      source: { externalId: "c1", sourceId: "fixture:1" },
    }),
    ...overrides,
  };
}

describe("runtime capability validator", () => {
  test("probes capabilities in order and carries discovered IDs", async () => {
    const report = await validateReadingSource(source(), { query: "fixture" });
    expect(report.passed).toBe(true);
    expect(report.results.map((result) => result.status)).toEqual([
      "passed",
      "passed",
      "passed",
      "passed",
    ]);
    expect(report.mangaExternalId).toBe("m1");
    expect(report.chapterExternalId).toBe("c1");
  });

  test("isolates a failed search and skips dependent operations", async () => {
    const report = await validateReadingSource(
      source({
        search: async () => ({
          failedSourceIds: [],
          hasNextPage: false,
          items: [],
        }),
      }),
      { query: "missing" },
    );
    expect(report.passed).toBe(false);
    expect(report.results.map((result) => result.status)).toEqual([
      "failed",
      "skipped",
      "skipped",
      "skipped",
    ]);
  });
});
