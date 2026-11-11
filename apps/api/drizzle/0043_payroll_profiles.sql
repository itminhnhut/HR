CREATE TABLE "payroll_bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"bank" text NOT NULL,
	"account_cipher" text NOT NULL,
	"key_version" integer NOT NULL,
	"last4" text NOT NULL,
	"payslip_email" text,
	"changed_on" date NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_bank_accounts_last4" CHECK ("payroll_bank_accounts"."last4" ~ '^[0-9]{4}$')
);
--> statement-breakpoint
CREATE TABLE "payroll_dependants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"from_month" text NOT NULL,
	"to_month" text,
	"count" integer NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_dependants_count" CHECK ("payroll_dependants"."count" > 0 and ("payroll_dependants"."to_month" is null or "payroll_dependants"."to_month" >= "payroll_dependants"."from_month"))
);
--> statement-breakpoint
CREATE TABLE "payroll_opening" (
	"employee_id" uuid NOT NULL,
	"tax_year" integer NOT NULL,
	"taxable_income" bigint DEFAULT 0 NOT NULL,
	"tax_withheld" bigint DEFAULT 0 NOT NULL,
	"overtime_hours" numeric(7, 1) DEFAULT 0 NOT NULL,
	"clothing_paid" bigint DEFAULT 0 NOT NULL,
	"months_paid" integer DEFAULT 0 NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "payroll_opening_employee_id_tax_year_pk" PRIMARY KEY("employee_id","tax_year"),
	CONSTRAINT "payroll_opening_amounts" CHECK ("payroll_opening"."taxable_income" >= 0 and "payroll_opening"."tax_withheld" >= 0 and "payroll_opening"."overtime_hours" >= 0 and "payroll_opening"."clothing_paid" >= 0 and "payroll_opening"."months_paid" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payroll_profile_amounts" (
	"profile_id" uuid NOT NULL,
	"component_id" text NOT NULL,
	"amount" bigint NOT NULL,
	CONSTRAINT "payroll_profile_amounts_profile_id_component_id_pk" PRIMARY KEY("profile_id","component_id"),
	CONSTRAINT "payroll_profile_amounts_amount" CHECK ("payroll_profile_amounts"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payroll_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"effective_on" date NOT NULL,
	"contract_type_id" text NOT NULL,
	"probation_days" integer,
	"manages_business" boolean DEFAULT false NOT NULL,
	"union_member" boolean DEFAULT false NOT NULL,
	"kpi_amount" bigint DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_profiles_amounts" CHECK ("payroll_profiles"."kpi_amount" >= 0 and coalesce("payroll_profiles"."probation_days", 0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "payroll_recurring_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"kind" text DEFAULT 'support' NOT NULL,
	"amount" bigint NOT NULL,
	"from_month" text NOT NULL,
	"to_month" text,
	"note" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_recurring_items_kind" CHECK ("payroll_recurring_items"."kind" in ('support', 'refund', 'advance')),
	CONSTRAINT "payroll_recurring_items_amount" CHECK ("payroll_recurring_items"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "payroll_tax_commitments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"signed_on" date NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payroll_bank_accounts" ADD CONSTRAINT "payroll_bank_accounts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_dependants" ADD CONSTRAINT "payroll_dependants_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_opening" ADD CONSTRAINT "payroll_opening_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_profile_amounts" ADD CONSTRAINT "payroll_profile_amounts_profile_id_payroll_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."payroll_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_profiles" ADD CONSTRAINT "payroll_profiles_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_recurring_items" ADD CONSTRAINT "payroll_recurring_items_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_tax_commitments" ADD CONSTRAINT "payroll_tax_commitments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_bank_accounts_person_day_idx" ON "payroll_bank_accounts" USING btree ("employee_id","changed_on");--> statement-breakpoint
CREATE INDEX "payroll_dependants_employee_idx" ON "payroll_dependants" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_profiles_person_day_idx" ON "payroll_profiles" USING btree ("employee_id","effective_on");--> statement-breakpoint
CREATE INDEX "payroll_recurring_items_employee_idx" ON "payroll_recurring_items" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_tax_commitments_person_year_idx" ON "payroll_tax_commitments" USING btree ("employee_id","year");