-- "Cấp bậc", "Số lượng tuyển", "Hình thức làm việc" (spec-job-topcv-fields.md): optional, null on existing jobs.
ALTER TABLE "jobs" ADD COLUMN "level" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "openings" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "work_mode" text;
