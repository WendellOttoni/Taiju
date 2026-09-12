CREATE TABLE "user_source_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"preferred_languages" text[] DEFAULT ARRAY['pt-BR','en']::text[] NOT NULL,
	"enabled_source_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_source_preferences" ADD CONSTRAINT "user_source_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
