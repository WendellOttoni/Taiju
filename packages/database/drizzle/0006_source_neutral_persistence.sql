ALTER TABLE "library_entries"
  ALTER COLUMN "manga_provider_id" TYPE text USING "manga_provider_id"::text;

ALTER TABLE "reading_history"
  ALTER COLUMN "manga_provider_id" TYPE text USING "manga_provider_id"::text,
  ALTER COLUMN "chapter_provider_id" TYPE text USING "chapter_provider_id"::text;
