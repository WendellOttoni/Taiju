import { z } from "zod";

import { sourceLanguageSchema, sourceRefSchema } from "./source";

export const animeSourceSchema = z.object({
  id: z.string().trim().min(1),
  language: sourceLanguageSchema,
  name: z.string().trim().min(1),
  packageName: z.string().trim().min(1).optional(),
});

export const animeSourceListResponseSchema = z.object({
  items: z.array(animeSourceSchema),
});

export const animeSummarySchema = z.object({
  coverUrl: z.string().url().optional(),
  description: z.string().trim().min(1).optional(),
  source: sourceRefSchema,
  tags: z.array(z.string().trim().min(1)),
  title: z.string().trim().min(1),
});

export const animeSearchQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  query: z.string().trim().min(1).max(200),
});

export const animeSearchResponseSchema = z.object({
  hasNextPage: z.boolean(),
  items: z.array(animeSummarySchema),
});

export const animeDetailsSchema = animeSummarySchema.extend({
  alternativeTitles: z.array(z.string().trim().min(1)),
  artists: z.array(z.string().trim().min(1)),
  authors: z.array(z.string().trim().min(1)),
  backgroundUrl: z.string().url().optional(),
  status: z.enum(["ongoing", "completed", "unknown"]),
});

export const animeEpisodeSchema = z.object({
  anime: sourceRefSchema,
  description: z.string().trim().min(1).optional(),
  number: z.number().finite().optional(),
  previewUrl: z.string().url().optional(),
  source: sourceRefSchema,
  title: z.string().trim().min(1),
});

export const animeEpisodeListSchema = z.object({
  items: z.array(animeEpisodeSchema),
});

export const animeTrackSchema = z.object({
  label: z.string().trim().min(1),
  url: z.string().url(),
});

export const animeStreamSchema = z.object({
  audioTracks: z.array(animeTrackSchema),
  bitrate: z.number().int().positive().optional(),
  isPreferred: z.boolean(),
  playbackId: z.string().uuid(),
  quality: z.number().int().positive().optional(),
  source: sourceRefSchema,
  subtitleTracks: z.array(animeTrackSchema),
  title: z.string().trim().min(1),
});

export const animeStreamResponseSchema = z.object({
  items: z.array(animeStreamSchema).min(1),
});

export const animeWatchProgressSchema = z.object({
  anime: sourceRefSchema,
  durationSeconds: z.number().finite().nonnegative().optional(),
  episode: sourceRefSchema,
  positionSeconds: z.number().finite().nonnegative(),
  updatedAt: z.string().datetime().optional(),
});

export const animeLibraryEntrySchema = z.object({
  anime: sourceRefSchema,
  createdAt: z.string().datetime(),
});

export const animeLibraryResponseSchema = z.object({
  items: z.array(animeLibraryEntrySchema),
});

export const animeWatchHistoryResponseSchema = z.object({
  items: z.array(animeWatchProgressSchema.required({ updatedAt: true })),
});

export type AnimeDetails = z.infer<typeof animeDetailsSchema>;
export type AnimeEpisode = z.infer<typeof animeEpisodeSchema>;
export type AnimeEpisodeList = z.infer<typeof animeEpisodeListSchema>;
export type AnimeLibraryEntry = z.infer<typeof animeLibraryEntrySchema>;
export type AnimeSearchQuery = z.infer<typeof animeSearchQuerySchema>;
export type AnimeSearchResponse = z.infer<typeof animeSearchResponseSchema>;
export type AnimeSource = z.infer<typeof animeSourceSchema>;
export type AnimeStream = z.infer<typeof animeStreamSchema>;
export type AnimeStreamResponse = z.infer<typeof animeStreamResponseSchema>;
export type AnimeSummary = z.infer<typeof animeSummarySchema>;
export type AnimeTrack = z.infer<typeof animeTrackSchema>;
export type AnimeWatchProgress = z.infer<typeof animeWatchProgressSchema>;
