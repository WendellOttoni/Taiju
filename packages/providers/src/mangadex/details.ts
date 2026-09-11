import {
  type MangaDetails,
  type MangaStatus,
  mangaDetailsSchema,
} from "@taiju/contracts";
import { z } from "zod";
import type { MangaDexClient } from "./client";

const localized = z.record(z.string(), z.string());
const responseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    attributes: z.object({
      title: localized,
      altTitles: z.array(localized).default([]),
      description: localized.optional(),
      status: z.string().optional(),
      originalLanguage: z.string().optional(),
      availableTranslatedLanguages: z.array(z.string()).default([]),
      tags: z
        .array(z.object({ attributes: z.object({ name: localized }) }))
        .default([]),
    }),
    relationships: z
      .array(
        z.object({
          type: z.string(),
          attributes: z
            .object({ name: z.string(), fileName: z.string() })
            .partial()
            .optional(),
        }),
      )
      .default([]),
  }),
});

export async function getMangaDetails(
  client: Pick<MangaDexClient, "request">,
  id: string,
): Promise<MangaDetails> {
  const payload = responseSchema.parse(
    await (
      await client.request(
        `/manga/${id}?includes[]=author&includes[]=artist&includes[]=cover_art`,
      )
    ).json(),
  ).data;
  const relations = payload.relationships;
  return mangaDetailsSchema.parse({
    provider: "mangadex",
    providerId: payload.id,
    title: value(payload.attributes.title),
    alternativeTitles: payload.attributes.altTitles.map(value),
    description:
      payload.attributes.description === undefined
        ? undefined
        : value(payload.attributes.description),
    coverUrl: cover(payload.id, relations),
    status: status(payload.attributes.status),
    originalLanguage: payload.attributes.originalLanguage,
    availableLanguages: payload.attributes.availableTranslatedLanguages,
    tags: payload.attributes.tags.map((tag) => value(tag.attributes.name)),
    authors: names(relations, "author"),
    artists: names(relations, "artist"),
  });
}
function value(values: Record<string, string>): string {
  return (
    values.en ??
    Object.values(values).find((item) => item.trim().length > 0) ??
    "Untitled"
  );
}
function names(
  relations: Array<{
    type: string;
    attributes?: { name?: string; fileName?: string };
  }>,
  type: string,
) {
  return relations
    .filter((relation) => relation.type === type)
    .flatMap((relation) =>
      relation.attributes?.name === undefined ? [] : [relation.attributes.name],
    );
}
function cover(
  id: string,
  relations: Array<{
    type: string;
    attributes?: { name?: string; fileName?: string };
  }>,
) {
  const relation = relations.find((item) => item.type === "cover_art");
  return relation?.attributes?.fileName === undefined
    ? undefined
    : `https://uploads.mangadex.org/covers/${id}/${relation.attributes.fileName}`;
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
