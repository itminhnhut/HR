-- Candidates sign in with Google only: the account is keyed by id and identified by the verified email.
-- Phone becomes optional profile data. Existing rows are kept where they can still sign in (they have an email).
DROP TABLE "otp_codes";--> statement-breakpoint
ALTER TABLE "saved_jobs" DROP CONSTRAINT "saved_jobs_phone_candidates_phone_fk";--> statement-breakpoint
ALTER TABLE "saved_jobs" DROP CONSTRAINT "saved_jobs_phone_job_id_pk";--> statement-breakpoint
ALTER TABLE "candidates" DROP CONSTRAINT "candidates_pkey";--> statement-breakpoint
DELETE FROM "candidates" WHERE "email" IS NULL;--> statement-breakpoint
UPDATE "candidates" SET "email" = lower("email");--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_pkey" PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "candidates" ALTER COLUMN "email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "candidates" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_jobs" ADD COLUMN "candidate_id" uuid;--> statement-breakpoint
UPDATE "saved_jobs" SET "candidate_id" = "candidates"."id" FROM "candidates" WHERE "candidates"."phone" = "saved_jobs"."phone";--> statement-breakpoint
DELETE FROM "saved_jobs" WHERE "candidate_id" IS NULL;--> statement-breakpoint
ALTER TABLE "saved_jobs" ALTER COLUMN "candidate_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_jobs" DROP COLUMN "phone";--> statement-breakpoint
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_candidate_id_job_id_pk" PRIMARY KEY("candidate_id","job_id");--> statement-breakpoint
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;
