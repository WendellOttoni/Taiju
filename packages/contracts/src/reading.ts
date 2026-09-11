import { z } from "zod";

export const readingProgressSchema = z.object({
  chapterProvider: z.literal("mangadex"),
  chapterProviderId: z.string().uuid(),
  mangaProvider: z.literal("mangadex"),
  mangaProviderId: z.string().uuid(),
  page: z.number().int().min(1),
  updatedAt: z.string().datetime().optional(),
});

export const readingHistoryResponseSchema = z.object({
  items: z.array(readingProgressSchema.required({ updatedAt: true })),
});

export type ReadingProgress = z.infer<typeof readingProgressSchema>;
