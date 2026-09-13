import { describe, expect, test } from "bun:test";
import { buildDiscoveryUrl, parseDiscoveryResponse } from "./discovery";

describe("adult discovery source filtering", () => {
  test("keeps the content filter when querying every source", () => {
    expect(
      buildDiscoveryUrl({
        content: "adult",
        kind: "latest",
        page: 2,
        sourceId: "all",
      }),
    ).toBe("/api/manga/discover?kind=latest&page=2&source=all&content=adult");
  });

  test("queries a selected source without the aggregate content filter", () => {
    expect(
      buildDiscoveryUrl({
        content: "adult",
        kind: "latest",
        page: 3,
        sourceId: "adult.source:1",
      }),
    ).toBe("/api/manga/discover?kind=latest&page=3&source=adult.source%3A1");
  });

  test("normalizes a selected source response into display groups", () => {
    const result = parseDiscoveryResponse(
      {
        failedSourceIds: [],
        hasNextPage: true,
        items: [
          {
            source: {
              externalId: "manga-1",
              sourceId: "adult.source:1",
            },
            tags: ["Action"],
            title: "Example",
          },
        ],
      },
      "adult.source:1",
    );

    expect(result.items).toEqual([
      {
        coverUrl: undefined,
        description: undefined,
        items: [
          {
            source: {
              externalId: "manga-1",
              sourceId: "adult.source:1",
            },
            tags: ["Action"],
            title: "Example",
          },
        ],
        key: "adult.source:1:manga-1",
        tags: ["Action"],
        title: "Example",
      },
    ]);
    expect(result.hasNextPage).toBe(true);
  });
});
