import { and, desc, eq } from "drizzle-orm";

import type { TaijuDatabase } from "./client";
import { libraryEntries } from "./schema";

export type LibraryEntry = {
  createdAt: Date;
  mangaProvider: string;
  mangaProviderId: string;
};

export type LibraryRepository = {
  add(
    userId: string,
    mangaProvider: string,
    mangaProviderId: string,
  ): Promise<void>;
  list(userId: string): Promise<LibraryEntry[]>;
  remove(
    userId: string,
    mangaProvider: string,
    mangaProviderId: string,
  ): Promise<void>;
};

export function createLibraryRepository(
  database: TaijuDatabase,
): LibraryRepository {
  return {
    async add(userId, mangaProvider, mangaProviderId) {
      await database
        .insert(libraryEntries)
        .values({ mangaProvider, mangaProviderId, userId })
        .onConflictDoNothing();
    },
    async list(userId) {
      return database
        .select({
          createdAt: libraryEntries.createdAt,
          mangaProvider: libraryEntries.mangaProvider,
          mangaProviderId: libraryEntries.mangaProviderId,
        })
        .from(libraryEntries)
        .where(eq(libraryEntries.userId, userId))
        .orderBy(desc(libraryEntries.createdAt));
    },
    async remove(userId, mangaProvider, mangaProviderId) {
      await database
        .delete(libraryEntries)
        .where(
          and(
            eq(libraryEntries.userId, userId),
            eq(libraryEntries.mangaProvider, mangaProvider),
            eq(libraryEntries.mangaProviderId, mangaProviderId),
          ),
        );
    },
  };
}
