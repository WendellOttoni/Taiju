CREATE TABLE "source_runtime_validations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" text NOT NULL,
	"query" text NOT NULL,
	"passed" boolean NOT NULL,
	"report" jsonb NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "source_runtime_validations_source_checked_index" ON "source_runtime_validations" USING btree ("source_id","checked_at");
