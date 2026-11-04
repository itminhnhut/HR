ALTER TYPE "public"."application_status" ADD VALUE 'passed';--> statement-breakpoint
ALTER TYPE "public"."application_status" ADD VALUE 'hired';--> statement-breakpoint
CREATE TABLE "application_status_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"source" text NOT NULL,
	"to_status" text NOT NULL,
	"reject_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "reject_reason" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "reject_note" text;--> statement-breakpoint
ALTER TABLE "application_status_log" ADD CONSTRAINT "application_status_log_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_status_log_application_idx" ON "application_status_log" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "application_status_log_created_idx" ON "application_status_log" USING btree ("created_at");--> statement-breakpoint
-- What is known of the applications already there: when they came in, and the step they stand at. The new status values are not used here: Postgres refuses them in the transaction that adds them.
INSERT INTO "application_status_log" ("application_id", "job_id", "source", "to_status", "created_at")
SELECT "id", "job_id", "source", 'new', "created_at" FROM "applications";--> statement-breakpoint
INSERT INTO "application_status_log" ("application_id", "job_id", "source", "to_status", "created_at")
SELECT "id", "job_id", "source", 'interview', GREATEST(COALESCE("interview_at", "updated_at"), "created_at")
FROM "applications"
WHERE "status" = 'interview' OR ("status" = 'rejected' AND "interview_at" IS NOT NULL);--> statement-breakpoint
INSERT INTO "application_status_log" ("application_id", "job_id", "source", "to_status", "created_at")
SELECT "id", "job_id", "source", 'rejected', GREATEST("updated_at", "created_at")
FROM "applications"
WHERE "status" = 'rejected';
