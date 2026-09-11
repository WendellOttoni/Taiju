import { z } from "zod";

import { sourceLanguageSchema, sourceRefSchema } from "./source";

export const sourceMangaSummarySchema = z.object({
  source: sourceRefSchema,
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  coverUrl: z.string().url().optional(),
  tags: z.array(z.string().trim().min(1)),
});

export const sourceMangaDetailsSchema = sourceMangaSummarySchema.extend({
  alternativeTitles: z.array(z.string().trim().min(1)),
  authors: z.array(z.string().trim().min(1)),
  artists: z.array(z.string().trim().min(1)),
  status: z
    .enum(["ongoing", "completed", "hiatus", "cancelled", "unknown"])
    .optional(),
});

export const sourceSearchQuerySchema = z.object({
  query: z.string().trim().min(1).max(200),
  page: z.number().int().min(1).default(1),
});

export const sourceSearchResponseSchema = z.object({
  hasNextPage: z.boolean(),
  items: z.array(sourceMangaSummarySchema),
});

export const sourceChapterSchema = z.object({
  source: sourceRefSchema,
  manga: sourceRefSchema,
  chapter: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  language: sourceLanguageSchema.optional(),
  publishedAt: z.string().datetime().optional(),
  scanlationGroup: z.string().trim().min(1).optional(),
});

export const sourceChapterListSchema = z.object({
  items: z.array(sourceChapterSchema),
});

export const sourceReaderChapterSchema = z.object({
  source: sourceRefSchema,
  pageUrls: z.array(z.string().url()).min(1),
});

export type SourceMangaSummary = z.infer<typeof sourceMangaSummarySchema>;
export type SourceMangaDetails = z.infer<typeof sourceMangaDetailsSchema>;
export type SourceSearchQuery = z.infer<typeof sourceSearchQuerySchema>;
export type SourceSearchResponse = z.infer<typeof sourceSearchResponseSchema>;
export type SourceChapter = z.infer<typeof sourceChapterSchema>;
export type SourceChapterList = z.infer<typeof sourceChapterListSchema>;
export type SourceReaderChapter = z.infer<typeof sourceReaderChapterSchema>;
