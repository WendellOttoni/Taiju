import { expect, test } from "bun:test";

import type { SourceSummary } from "../../contracts/src";
import { SuwayomiReadingSource, SuwayomiRuntimeClient } from "../src";

const descriptor: SourceSummary = {
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
};

test("maps Suwayomi search results to Taiju-owned source references", async () => {
  const source = new SuwayomiReadingSource(
    descriptor,
    "1",
    new SuwayomiRuntimeClient({
      baseUrl: "http://suwayomi.test",
      fetch: async () =>
        Response.json({
          data: {
            fetchSourceManga: {
              hasNextPage: false,
              mangas: [
                {
                  artist: null,
                  author: "Author",
                  description: "Description",
                  genre: ["Action"],
                  id: "42",
                  status: "ONGOING",
                  thumbnailUrl: "https://images.example/cover.jpg",
                  title: "Taiju",
                },
              ],
            },
          },
        }),
    }),
  );

  await expect(source.search({ page: 1, query: "Taiju" })).resolves.toEqual({
    failedSourceIds: [],
    hasNextPage: false,
    items: [
      {
        coverUrl: "https://images.example/cover.jpg",
        description: "Description",
        source: { externalId: "42", sourceId: "example.source:1" },
        tags: ["Action"],
        title: "Taiju",
      },
    ],
  });
});
