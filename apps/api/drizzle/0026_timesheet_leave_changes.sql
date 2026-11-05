CREATE TABLE "timesheet_leave_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"amount" real NOT NULL,
	"reason" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "timesheet_snapshots" ADD COLUMN "totals" jsonb;--> statement-breakpoint
ALTER TABLE "timesheet_leave_changes" ADD CONSTRAINT "timesheet_leave_changes_period_id_timesheet_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."timesheet_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_leave_changes" ADD CONSTRAINT "timesheet_leave_changes_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "timesheet_leave_changes_period_idx" ON "timesheet_leave_changes" USING btree ("period_id","employee_id");