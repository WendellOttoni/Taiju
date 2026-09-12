import { eq } from "drizzle-orm";

import type { TaijuDatabase } from "./client";
import { userSourcePreferences } from "./schema";

export type UserSourcePreferences = {
  enabledSourceIds: string[];
  preferredLanguages: string[];
  updatedAt: Date;
};

export type SourcePreferencesRepository = {
  get(userId: string): Promise<UserSourcePreferences | undefined>;
  save(
    userId: string,
    preferences: Omit<UserSourcePreferences, "updatedAt">,
  ): Promise<UserSourcePreferences>;
};

export function createSourcePreferencesRepository(
  database: TaijuDatabase,
): SourcePreferencesRepository {
  return {
    async get(userId) {
      const [result] = await database
        .select({
          enabledSourceIds: userSourcePreferences.enabledSourceIds,
          preferredLanguages: userSourcePreferences.preferredLanguages,
          updatedAt: userSourcePreferences.updatedAt,
        })
        .from(userSourcePreferences)
        .where(eq(userSourcePreferences.userId, userId))
        .limit(1);
      return result;
    },
    async save(userId, preferences) {
      const [result] = await database
        .insert(userSourcePreferences)
        .values({ ...preferences, userId })
        .onConflictDoUpdate({
          target: userSourcePreferences.userId,
          set: { ...preferences, updatedAt: new Date() },
        })
        .returning({
          enabledSourceIds: userSourcePreferences.enabledSourceIds,
          preferredLanguages: userSourcePreferences.preferredLanguages,
          updatedAt: userSourcePreferences.updatedAt,
        });
      if (!result) throw new Error("Failed to save source preferences.");
      return result;
    },
  };
}
