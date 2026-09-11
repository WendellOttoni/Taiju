import {
  type ChapterFeedResponse,
  chapterFeedResponseSchema,
} from "@taiju/contracts";
import { z } from "zod";
import type { MangaDexClient } from "./client";

const responseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().uuid(),
      attributes: z.object({
        chapter: z.string().nullable().optional(),
        volume: z.string().nullable().optional(),
        title: z.string().nullable().optional(),
        translatedLanguage: z.string(),
        publishAt: z.string().datetime(),
      }),
      relationships: z
        .array(
          z.object({
            type: z.string(),
            id: z.string().uuid(),
            attributes: z.object({ name: z.string() }).optional(),
          }),
        )
        .default([]),
    }),
  ),
  total: z.number().int().min(0),
  limit: z.number().int().min(1),
  offset: z.number().int().min(0),
});

export type ChapterFeedOptions = {
  languages?: string[];
  limit?: number;
  offset?: number;
};

export async function getChapterFeed(
  client: Pick<MangaDexClient, "request">,
  mangaId: string,
  options: ChapterFeedOptions = {},
): Promise<ChapterFeedResponse> {
  const params = new URLSearchParams({
    manga: mangaId,
    limit: String(options.limit ?? 20),
    offset: String(options.offset ?? 0),
    "includes[]": "scanlation_group",
  });
  for (const language of options.languages ?? [])
    params.append("translatedLanguage[]", language);
  const payload = responseSchema.parse(
    await (await client.request(`/chapter?${params}`)).json(),
  );
  return chapterFeedResponseSchema.parse({
    items: payload.data.map((chapter) => {
      const group = chapter.relationships.find(
        (relation) => relation.type === "scanlation_group",
      );
      return {
        provider: "mangadex",
        providerId: chapter.id,
        mangaProviderId: mangaId,
        chapter: chapter.attributes.chapter ?? undefined,
        volume: chapter.attributes.volume ?? undefined,
        title: chapter.attributes.title ?? undefined,
        language: chapter.attributes.translatedLanguage,
        publishedAt: chapter.attributes.publishAt,
        scanlationGroup:
          group?.attributes === undefined
            ? undefined
            : { providerId: group.id, name: group.attributes.name },
      };
    }),
    total: payload.total,
    limit: payload.limit,
    offset: payload.offset,
  });
}
