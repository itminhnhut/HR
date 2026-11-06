ALTER TABLE "timesheet_periods" ADD COLUMN "leave_mode" text DEFAULT 'law' NOT NULL;--> statement-breakpoint
UPDATE "timesheet_periods" SET "leave_mode" = 'excel' WHERE "status" = 'closed';
