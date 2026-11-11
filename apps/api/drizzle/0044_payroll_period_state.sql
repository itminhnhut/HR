ALTER TABLE "payroll_periods" ADD COLUMN "pay_date" date;--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN "approval_no" integer;--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN "paid_on" date;--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_approval" CHECK (("payroll_periods"."approval_no" is null) = ("payroll_periods"."approved_at" is null) and ("payroll_periods"."approval_no" is null) = ("payroll_periods"."approved_by" is null) and coalesce("payroll_periods"."approval_no", 1) > 0);--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_paid" CHECK ("payroll_periods"."paid_on" is null or "payroll_periods"."status" = 'paid');