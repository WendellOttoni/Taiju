import {
  type MangaSearchQuery,
  type MangaSearchResponse,
  type MangaStatus,
  mangaSearchResponseSchema,
} from "@taiju/contracts";
import { z } from "zod";
import type { MangaDexClient } from "./client";

const responseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().uuid(),
      attributes: z.object({
        title: z.record(z.string(), z.string()),
        description: z.record(z.string(), z.string()).optional(),
        status: z.string().optional(),
        originalLanguage: z.string().optional(),
        tags: z
          .array(
            z.object({
              attributes: z.object({ name: z.record(z.string(), z.string()) }),
            }),
          )
          .default([]),
      }),
      relationships: z
        .array(
          z.object({
            type: z.string(),
            attributes: z.object({ fileName: z.string() }).optional(),
          }),
        )
        .default([]),
    }),
  ),
  total: z.number().int().min(0),
  limit: z.number().int().min(1),
  offset: z.number().int().min(0),
});

export async function searchManga(
  client: Pick<MangaDexClient, "request">,
  query: MangaSearchQuery,
): Promise<MangaSearchResponse> {
  const params = new URLSearchParams({
    title: query.query,
    limit: String(query.limit),
    offset: String(query.offset),
    "includes[]": "cover_art",
  });
  const payload = responseSchema.parse(
    await (await client.request(`/manga?${params}`)).json(),
  );
  return mangaSearchResponseSchema.parse({
    items: payload.data.map((manga) => ({
      provider: "mangadex",
      providerId: manga.id,
      title: value(manga.attributes.title),
      description:
        manga.attributes.description === undefined
          ? undefined
          : value(manga.attributes.description),
      coverUrl: cover(manga.id, manga.relationships),
      status: status(manga.attributes.status),
      originalLanguage: manga.attributes.originalLanguage,
      tags: manga.attributes.tags.map((tag) => value(tag.attributes.name)),
    })),
    total: payload.total,
    limit: payload.limit,
    offset: payload.offset,
  });
}

function value(values: Record<string, string>): string {
  return (
    values.en ??
    Object.values(values).find((item) => item.trim().length > 0) ??
    "Untitled"
  );
}
function cover(
  id: string,
  relationships: Array<{ type: string; attributes?: { fileName: string } }>,
): string | undefined {
  const item = relationships.find(
    (relationship) => relationship.type === "cover_art",
  );
  return item?.attributes === undefined
    ? undefined
    : `https://uploads.mangadex.org/covers/${id}/${item.attributes.fileName}`;
}
function status(value: string | undefined): MangaStatus | undefined {
  if (value === undefined) return undefined;
  if (
    value === "ongoing" ||
    value === "completed" ||
    value === "hiatus" ||
    value === "cancelled"
  )
    return value;
  return value === "paused" ? "hiatus" : "unknown";
}
