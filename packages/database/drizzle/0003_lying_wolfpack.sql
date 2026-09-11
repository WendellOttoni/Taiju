CREATE TABLE "reading_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"manga_provider" text NOT NULL,
	"manga_provider_id" uuid NOT NULL,
	"chapter_provider" text NOT NULL,
	"chapter_provider_id" uuid NOT NULL,
	"page" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reading_history" ADD CONSTRAINT "reading_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reading_history_user_manga_unique" ON "reading_history" USING btree ("user_id","manga_provider","manga_provider_id");--> statement-breakpoint
CREATE INDEX "reading_history_user_updated_at_index" ON "reading_history" USING btree ("user_id","updated_at");