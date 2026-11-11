CREATE TABLE "payroll_first_month_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item" text NOT NULL,
	"employee_id" uuid,
	"closing_id" uuid,
	"confirmed" boolean DEFAULT false NOT NULL,
	"confirmed_at" timestamp with time zone NOT NULL,
	"confirmed_by" text NOT NULL,
	CONSTRAINT "payroll_first_month_checks_item_idx" UNIQUE NULLS NOT DISTINCT("item","employee_id","closing_id")
);
--> statement-breakpoint
CREATE TABLE "payroll_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"closing_id" uuid,
	"timesheet_reopened_at" timestamp with time zone,
	"timesheet_reopened_by" text,
	"timesheet_reopen_reason" text,
	"row_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_periods_status" CHECK ("payroll_periods"."status" in ('waiting', 'draft', 'approved', 'paid')),
	CONSTRAINT "payroll_periods_approved_on_a_close" CHECK ("payroll_periods"."status" in ('waiting', 'draft') or "payroll_periods"."closing_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "block" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "joined_on_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "official_on_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "left_on_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "timesheet_closing_rows" ADD COLUMN "block" text;--> statement-breakpoint
ALTER TABLE "payroll_first_month_checks" ADD CONSTRAINT "payroll_first_month_checks_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_first_month_checks" ADD CONSTRAINT "payroll_first_month_checks_closing_id_timesheet_closings_id_fk" FOREIGN KEY ("closing_id") REFERENCES "public"."timesheet_closings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_closing_id_timesheet_closings_id_fk" FOREIGN KEY ("closing_id") REFERENCES "public"."timesheet_closings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_periods_month_idx" ON "payroll_periods" USING btree ("year","month");--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_block" CHECK ("employees"."block" in ('BO', 'KD'));