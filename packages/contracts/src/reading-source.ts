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
  failedSourceIds: z.array(z.string().trim().min(1)).default([]),
  hasNextPage: z.boolean(),
  items: z.array(sourceMangaSummarySchema),
});

export const sourceDiscoveryKindSchema = z.enum(["popular", "latest"]);

export const sourceDiscoveryQuerySchema = z.object({
  kind: sourceDiscoveryKindSchema,
  page: z.number().int().min(1).default(1),
});

/** A conservative, discovery-only grouping with title and shared-tag evidence. */
export const sourceMangaGroupSchema = z.object({
  coverUrl: z.string().url().optional(),
  description: z.string().trim().min(1).optional(),
  items: z.array(sourceMangaSummarySchema).min(1),
  key: z.string().trim().min(1),
  tags: z.array(z.string().trim().min(1)),
  title: z.string().trim().min(1),
});

export const sourceGroupedSearchResponseSchema = z.object({
  failedSourceIds: z.array(z.string().trim().min(1)).default([]),
  hasNextPage: z.boolean(),
  items: z.array(sourceMangaGroupSchema),
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

export const sourceLibraryEntrySchema = z.object({
  createdAt: z.string().datetime(),
  manga: sourceRefSchema,
});

export const sourceLibraryResponseSchema = z.object({
  items: z.array(sourceLibraryEntrySchema),
});

export const sourceReadingProgressSchema = z.object({
  chapter: sourceRefSchema,
  manga: sourceRefSchema,
  page: z.number().int().min(1),
  updatedAt: z.string().datetime().optional(),
});

export const sourceReadingHistoryResponseSchema = z.object({
  items: z.array(sourceReadingProgressSchema.required({ updatedAt: true })),
});

export type SourceMangaSummary = z.infer<typeof sourceMangaSummarySchema>;
export type SourceMangaDetails = z.infer<typeof sourceMangaDetailsSchema>;
export type SourceSearchQuery = z.infer<typeof sourceSearchQuerySchema>;
export type SourceDiscoveryKind = z.infer<typeof sourceDiscoveryKindSchema>;
export type SourceDiscoveryQuery = z.infer<typeof sourceDiscoveryQuerySchema>;
export type SourceSearchResponse = z.infer<typeof sourceSearchResponseSchema>;
export type SourceMangaGroup = z.infer<typeof sourceMangaGroupSchema>;
export type SourceGroupedSearchResponse = z.infer<
  typeof sourceGroupedSearchResponseSchema
>;
export type SourceChapter = z.infer<typeof sourceChapterSchema>;
export type SourceChapterList = z.infer<typeof sourceChapterListSchema>;
export type SourceReaderChapter = z.infer<typeof sourceReaderChapterSchema>;
export type SourceLibraryEntry = z.infer<typeof sourceLibraryEntrySchema>;
export type SourceReadingProgress = z.infer<typeof sourceReadingProgressSchema>;
