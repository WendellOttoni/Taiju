CREATE TABLE "library_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"manga_provider" text NOT NULL,
	"manga_provider_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "library_entries_user_manga_unique" ON "library_entries" USING btree ("user_id","manga_provider","manga_provider_id");--> statement-breakpoint
CREATE INDEX "library_entries_user_created_at_index" ON "library_entries" USING btree ("user_id","created_at");