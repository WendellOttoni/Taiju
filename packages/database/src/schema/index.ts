import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("users_email_lowercase", sql`${table.email} = lower(${table.email})`),
  ],
);

export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const passwordCredentials = pgTable("password_credentials", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const libraryEntries = pgTable(
  "library_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mangaProvider: text("manga_provider").notNull(),
    mangaProviderId: text("manga_provider_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("library_entries_user_manga_unique").on(
      table.userId,
      table.mangaProvider,
      table.mangaProviderId,
    ),
    index("library_entries_user_created_at_index").on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export const readingHistory = pgTable(
  "reading_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mangaProvider: text("manga_provider").notNull(),
    mangaProviderId: text("manga_provider_id").notNull(),
    chapterProvider: text("chapter_provider").notNull(),
    chapterProviderId: text("chapter_provider_id").notNull(),
    page: text("page").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("reading_history_user_manga_unique").on(
      table.userId,
      table.mangaProvider,
      table.mangaProviderId,
    ),
    index("reading_history_user_updated_at_index").on(
      table.userId,
      table.updatedAt,
    ),
  ],
);

export const animeLibraryEntries = pgTable(
  "anime_library_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceId: text("source_id").notNull(),
    animeExternalId: text("anime_external_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("anime_library_entries_user_anime_unique").on(
      table.userId,
      table.sourceId,
      table.animeExternalId,
    ),
    index("anime_library_entries_user_created_at_index").on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export const animeWatchHistory = pgTable(
  "anime_watch_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceId: text("source_id").notNull(),
    animeExternalId: text("anime_external_id").notNull(),
    episodeExternalId: text("episode_external_id").notNull(),
    positionSeconds: integer("position_seconds").notNull(),
    durationSeconds: integer("duration_seconds"),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("anime_watch_history_user_episode_unique").on(
      table.userId,
      table.sourceId,
      table.animeExternalId,
      table.episodeExternalId,
    ),
    index("anime_watch_history_user_updated_at_index").on(
      table.userId,
      table.updatedAt,
    ),
  ],
);

export const sourceRuntimeValidations = pgTable(
  "source_runtime_validations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: text("source_id").notNull(),
    query: text("query").notNull(),
    passed: boolean("passed").notNull(),
    report: jsonb("report").notNull(),
    checkedAt: timestamp("checked_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("source_runtime_validations_source_checked_index").on(
      table.sourceId,
      table.checkedAt,
    ),
  ],
);

export const userSourcePreferences = pgTable("user_source_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  preferredLanguages: text("preferred_languages")
    .array()
    .notNull()
    .default(["pt-BR", "en"]),
  enabledSourceIds: text("enabled_source_ids").array().notNull().default([]),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});
