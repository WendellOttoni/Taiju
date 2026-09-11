import { describe, expect, test } from "bun:test";
import type { MangaSummary } from "../src";
import {
  mangaSearchQuerySchema,
  mangaSearchResponseSchema,
  mangaSummarySchema,
} from "../src";

const manga = {
  provider: "mangadex",
  providerId: "a1e53f6e-0a6e-4d03-9f06-e4761ac50de5",
  title: "Taiju",
  description: "A manga summary.",
  coverUrl: "https://uploads.mangadex.org/covers/example.jpg",
  status: "ongoing",
  originalLanguage: "ja",
  tags: ["Action", "Fantasy"],
} satisfies MangaSummary;

describe("manga contracts", () => {
  test("validates a Taiju-owned manga summary", () => {
    expect(mangaSummarySchema.parse(manga)).toEqual(manga);
  });

  test("keeps provider identity explicit", () => {
    expect(
      mangaSummarySchema.safeParse({ ...manga, provider: "anilist" }).success,
    ).toBeFalse();
    expect(
      mangaSummarySchema.safeParse({ ...manga, providerId: "ambiguous-id" })
        .success,
    ).toBeFalse();
  });

  test("applies bounded search defaults", () => {
    expect(mangaSearchQuerySchema.parse({ query: "  Berserk  " })).toEqual({
      query: "Berserk",
      limit: 20,
      offset: 0,
    });
  });

  test("validates normalized paginated search responses", () => {
    expect(
      mangaSearchResponseSchema.parse({
        items: [manga],
        total: 1,
        limit: 20,
        offset: 0,
      }),
    ).toEqual({ items: [manga], total: 1, limit: 20, offset: 0 });
  });
});
