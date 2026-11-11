CREATE TABLE "payroll_month_inputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"employee_id" uuid NOT NULL,
	"kpi_percent" numeric(8, 6),
	"overtime_hours" numeric(5, 1) DEFAULT 0 NOT NULL,
	"rest_days" numeric(4, 1),
	"holiday_days" numeric(4, 1),
	"other_income" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cash" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "payroll_month_inputs_month" CHECK ("payroll_month_inputs"."month" between 1 and 12),
	CONSTRAINT "payroll_month_inputs_numbers" CHECK (("payroll_month_inputs"."kpi_percent" is null or "payroll_month_inputs"."kpi_percent" between 0 and 2) and "payroll_month_inputs"."overtime_hours" >= 0 and ("payroll_month_inputs"."rest_days" is null or "payroll_month_inputs"."rest_days" >= 0) and ("payroll_month_inputs"."holiday_days" is null or "payroll_month_inputs"."holiday_days" >= 0))
);
--> statement-breakpoint
ALTER TABLE "payroll_month_inputs" ADD CONSTRAINT "payroll_month_inputs_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_month_inputs_period_person_idx" ON "payroll_month_inputs" USING btree ("year","month","employee_id");--> statement-breakpoint
CREATE INDEX "payroll_month_inputs_employee_idx" ON "payroll_month_inputs" USING btree ("employee_id");