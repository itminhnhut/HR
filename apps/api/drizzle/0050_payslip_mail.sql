ALTER TYPE "public"."template_key" ADD VALUE 'payslip';--> statement-breakpoint
CREATE TABLE "payroll_payslip_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"approval_no" integer NOT NULL,
	"status" text NOT NULL,
	"channel" text NOT NULL,
	"email" text NOT NULL,
	"sent_to" text NOT NULL,
	"error" text,
	"at" timestamp with time zone NOT NULL,
	"actor" text NOT NULL,
	CONSTRAINT "payroll_payslip_sends_status" CHECK ("payroll_payslip_sends"."status" in ('sent', 'failed')),
	CONSTRAINT "payroll_payslip_sends_channel" CHECK ("payroll_payslip_sends"."channel" in ('manual', 'auto'))
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "payroll_payslip_sends" ADD CONSTRAINT "payroll_payslip_sends_period_id_payroll_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_payslip_sends" ADD CONSTRAINT "payroll_payslip_sends_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_payslip_sends_person_idx" ON "payroll_payslip_sends" USING btree ("period_id","employee_id","approval_no");