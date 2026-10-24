CREATE TABLE "rate_limit_hits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "candidate_updated_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "rate_limit_hits_key_at_idx" ON "rate_limit_hits" USING btree ("key","at");