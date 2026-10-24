-- Job states: draft / published / closed. "Tạm dừng" and "Đã tuyển đủ" both become closed.
ALTER TABLE "jobs" ADD COLUMN "closed_on" date;--> statement-breakpoint
UPDATE "jobs" SET "closed_on" = ("updated_at" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date WHERE "state" IN ('paused', 'filled');--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "state" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."job_state" RENAME TO "job_state_old";--> statement-breakpoint
CREATE TYPE "public"."job_state" AS ENUM('draft', 'published', 'closed');--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "state" SET DATA TYPE "public"."job_state" USING (CASE WHEN "state"::text IN ('paused', 'filled') THEN 'closed' ELSE "state"::text END)::"public"."job_state";--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "state" SET DEFAULT 'draft';--> statement-breakpoint
DROP TYPE "public"."job_state_old";--> statement-breakpoint
-- Application statuses: "Đạt" becomes "Hẹn phỏng vấn"; HR tells the candidate by phone.
ALTER TABLE "applications" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."application_status" RENAME TO "application_status_old";--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('new', 'seen', 'interview', 'rejected');--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "status" SET DATA TYPE "public"."application_status" USING (CASE WHEN "status"::text = 'passed' THEN 'interview' ELSE "status"::text END)::"public"."application_status";--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "status" SET DEFAULT 'new';--> statement-breakpoint
DROP TYPE "public"."application_status_old";--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "interview_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "note_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "note_updated_by" text;--> statement-breakpoint
ALTER TABLE "applications" DROP COLUMN "keep_for_other_jobs";--> statement-breakpoint
ALTER TABLE "applications" DROP COLUMN "thanked_at";--> statement-breakpoint
ALTER TABLE "applications" DROP COLUMN "candidate_updated_at";--> statement-breakpoint
ALTER TABLE "candidates" DROP COLUMN "keep_for_other_jobs";--> statement-breakpoint
DROP TABLE "saved_jobs";--> statement-breakpoint
ALTER TABLE "hr_users" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
CREATE TABLE "job_template" (
	"id" integer PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
