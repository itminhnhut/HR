CREATE TABLE "payroll_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"employee_id" uuid,
	"applies_from" text NOT NULL,
	"value" jsonb,
	"stop" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"superseded_by" uuid,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_settings_value_or_stop" CHECK ("payroll_settings"."stop" or "payroll_settings"."value" is not null),
	CONSTRAINT "payroll_settings_from" CHECK ("payroll_settings"."applies_from" ~ '^[0-9]{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12][0-9]|3[01]))?$')
);
--> statement-breakpoint
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_settings_live_idx" ON "payroll_settings" USING btree ("key",coalesce("employee_id", '00000000-0000-0000-0000-000000000000'::uuid),"applies_from") WHERE "payroll_settings"."superseded_by" is null;--> statement-breakpoint
CREATE INDEX "payroll_settings_employee_idx" ON "payroll_settings" USING btree ("employee_id");