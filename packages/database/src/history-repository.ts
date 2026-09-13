import { and, desc, eq } from "drizzle-orm";

import type { TaijuDatabase } from "./client";
import { readingHistory } from "./schema";

export type ReadingHistoryEntry = {
  chapterProvider: string;
  chapterProviderId: string;
  mangaProvider: string;
  mangaProviderId: string;
  page: string;
  updatedAt: Date;
};

export type HistoryRepository = {
  list(userId: string): Promise<ReadingHistoryEntry[]>;
  remove(
    userId: string,
    mangaProvider: string,
    mangaProviderId: string,
  ): Promise<void>;
  save(
    userId: string,
    entry: Omit<ReadingHistoryEntry, "updatedAt">,
  ): Promise<void>;
};

export function createHistoryRepository(
  database: TaijuDatabase,
): HistoryRepository {
  return {
    async list(userId) {
      return database
        .select({
          chapterProvider: readingHistory.chapterProvider,
          chapterProviderId: readingHistory.chapterProviderId,
          mangaProvider: readingHistory.mangaProvider,
          mangaProviderId: readingHistory.mangaProviderId,
          page: readingHistory.page,
          updatedAt: readingHistory.updatedAt,
        })
        .from(readingHistory)
        .where(eq(readingHistory.userId, userId))
        .orderBy(desc(readingHistory.updatedAt));
    },
    async remove(userId, mangaProvider, mangaProviderId) {
      await database
        .delete(readingHistory)
        .where(
          and(
            eq(readingHistory.userId, userId),
            eq(readingHistory.mangaProvider, mangaProvider),
            eq(readingHistory.mangaProviderId, mangaProviderId),
          ),
        );
    },
    async save(userId, entry) {
      await database
        .insert(readingHistory)
        .values({ ...entry, userId })
        .onConflictDoUpdate({
          set: { ...entry, updatedAt: new Date() },
          target: [
            readingHistory.userId,
            readingHistory.mangaProvider,
            readingHistory.mangaProviderId,
          ],
        });
    },
  };
}
