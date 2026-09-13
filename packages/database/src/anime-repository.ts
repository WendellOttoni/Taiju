import { and, desc, eq } from "drizzle-orm";

import type { TaijuDatabase } from "./client";
import { animeLibraryEntries, animeWatchHistory } from "./schema";

export type AnimeLibraryEntry = {
  animeExternalId: string;
  createdAt: Date;
  sourceId: string;
};

export type AnimeLibraryRepository = {
  add(userId: string, sourceId: string, animeExternalId: string): Promise<void>;
  list(userId: string): Promise<AnimeLibraryEntry[]>;
  remove(
    userId: string,
    sourceId: string,
    animeExternalId: string,
  ): Promise<void>;
};

export type AnimeWatchHistoryEntry = {
  animeExternalId: string;
  durationSeconds?: number;
  episodeExternalId: string;
  positionSeconds: number;
  sourceId: string;
  updatedAt: Date;
};

export type AnimeWatchHistoryRepository = {
  list(userId: string): Promise<AnimeWatchHistoryEntry[]>;
  save(
    userId: string,
    entry: Omit<AnimeWatchHistoryEntry, "updatedAt">,
  ): Promise<void>;
};

export function createAnimeLibraryRepository(
  database: TaijuDatabase,
): AnimeLibraryRepository {
  return {
    async add(userId, sourceId, animeExternalId) {
      await database
        .insert(animeLibraryEntries)
        .values({ animeExternalId, sourceId, userId })
        .onConflictDoNothing();
    },
    async list(userId) {
      return database
        .select({
          animeExternalId: animeLibraryEntries.animeExternalId,
          createdAt: animeLibraryEntries.createdAt,
          sourceId: animeLibraryEntries.sourceId,
        })
        .from(animeLibraryEntries)
        .where(eq(animeLibraryEntries.userId, userId))
        .orderBy(desc(animeLibraryEntries.createdAt));
    },
    async remove(userId, sourceId, animeExternalId) {
      await database
        .delete(animeLibraryEntries)
        .where(
          and(
            eq(animeLibraryEntries.userId, userId),
            eq(animeLibraryEntries.sourceId, sourceId),
            eq(animeLibraryEntries.animeExternalId, animeExternalId),
          ),
        );
    },
  };
}

export function createAnimeWatchHistoryRepository(
  database: TaijuDatabase,
): AnimeWatchHistoryRepository {
  return {
    async list(userId) {
      const entries = await database
        .select({
          animeExternalId: animeWatchHistory.animeExternalId,
          durationSeconds: animeWatchHistory.durationSeconds,
          episodeExternalId: animeWatchHistory.episodeExternalId,
          positionSeconds: animeWatchHistory.positionSeconds,
          sourceId: animeWatchHistory.sourceId,
          updatedAt: animeWatchHistory.updatedAt,
        })
        .from(animeWatchHistory)
        .where(eq(animeWatchHistory.userId, userId))
        .orderBy(desc(animeWatchHistory.updatedAt));
      return entries.map((entry) => ({
        ...entry,
        durationSeconds: entry.durationSeconds ?? undefined,
      }));
    },
    async save(userId, entry) {
      await database
        .insert(animeWatchHistory)
        .values({ ...entry, userId })
        .onConflictDoUpdate({
          set: { ...entry, updatedAt: new Date() },
          target: [
            animeWatchHistory.userId,
            animeWatchHistory.sourceId,
            animeWatchHistory.animeExternalId,
            animeWatchHistory.episodeExternalId,
          ],
        });
    },
  };
}
