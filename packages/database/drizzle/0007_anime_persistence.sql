CREATE TABLE "anime_library_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "source_id" text NOT NULL,
  "anime_external_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "anime_library_entries_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "anime_watch_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "source_id" text NOT NULL,
  "anime_external_id" text NOT NULL,
  "episode_external_id" text NOT NULL,
  "position_seconds" integer NOT NULL,
  "duration_seconds" integer,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "anime_watch_history_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE cascade ON UPDATE no action
);

CREATE UNIQUE INDEX "anime_library_entries_user_anime_unique"
  ON "anime_library_entries" USING btree ("user_id", "source_id", "anime_external_id");
CREATE INDEX "anime_library_entries_user_created_at_index"
  ON "anime_library_entries" USING btree ("user_id", "created_at");
CREATE UNIQUE INDEX "anime_watch_history_user_episode_unique"
  ON "anime_watch_history" USING btree ("user_id", "source_id", "anime_external_id", "episode_external_id");
CREATE INDEX "anime_watch_history_user_updated_at_index"
  ON "anime_watch_history" USING btree ("user_id", "updated_at");
