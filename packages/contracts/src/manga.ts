import { z } from "zod";

const mangaStatusSchema = z.enum([
  "ongoing",
  "completed",
  "hiatus",
  "cancelled",
  "unknown",
]);

export const mangaSummarySchema = z.object({
  provider: z.literal("mangadex"),
  providerId: z.string().uuid(),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  coverUrl: z.string().url().optional(),
  status: mangaStatusSchema.optional(),
  originalLanguage: z.string().trim().min(1).optional(),
  tags: z.array(z.string().trim().min(1)),
});

export const mangaSearchQuerySchema = z.object({
  query: z.string().trim().min(1).max(200),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const mangaDetailsSchema = mangaSummarySchema.extend({
  alternativeTitles: z.array(z.string().trim().min(1)),
  authors: z.array(z.string().trim().min(1)),
  artists: z.array(z.string().trim().min(1)),
  availableLanguages: z.array(z.string().trim().min(1)),
});

export const mangaSearchResponseSchema = z.object({
  items: z.array(mangaSummarySchema),
  total: z.number().int().min(0),
  limit: z.number().int().min(1).max(100),
  offset: z.number().int().min(0),
});

export const chapterSummarySchema = z.object({
  provider: z.literal("mangadex"),
  providerId: z.string().uuid(),
  mangaProviderId: z.string().uuid(),
  chapter: z.string().trim().min(1).optional(),
  volume: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  language: z.string().trim().min(1),
  publishedAt: z.string().datetime(),
  scanlationGroup: z
    .object({ providerId: z.string().uuid(), name: z.string().trim().min(1) })
    .optional(),
});

export const chapterFeedResponseSchema = z.object({
  items: z.array(chapterSummarySchema),
  total: z.number().int().min(0),
  limit: z.number().int().min(1).max(100),
  offset: z.number().int().min(0),
});

export const chapterFeedQuerySchema = z.object({
  language: z.string().trim().min(1).max(20).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const readerChapterSchema = z.object({
  provider: z.literal("mangadex"),
  providerId: z.string().uuid(),
  pageUrls: z.array(z.string().url()).min(1),
});

export type MangaStatus = z.infer<typeof mangaStatusSchema>;
export type MangaSummary = z.infer<typeof mangaSummarySchema>;
export type MangaDetails = z.infer<typeof mangaDetailsSchema>;
export type MangaSearchQuery = z.infer<typeof mangaSearchQuerySchema>;
export type MangaSearchResponse = z.infer<typeof mangaSearchResponseSchema>;
export type ChapterSummary = z.infer<typeof chapterSummarySchema>;
export type ChapterFeedResponse = z.infer<typeof chapterFeedResponseSchema>;
export type ChapterFeedQuery = z.infer<typeof chapterFeedQuerySchema>;
export type ReaderChapter = z.infer<typeof readerChapterSchema>;
