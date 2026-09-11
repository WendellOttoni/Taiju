import { z } from "zod";

export const libraryEntrySchema = z.object({
  createdAt: z.string().datetime(),
  mangaProvider: z.literal("mangadex"),
  mangaProviderId: z.string().uuid(),
});

export const libraryResponseSchema = z.object({
  items: z.array(libraryEntrySchema),
});

export type LibraryEntry = z.infer<typeof libraryEntrySchema>;
