CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"full_name" text NOT NULL,
	"department" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"region_id" uuid NOT NULL,
	"employment" text DEFAULT 'probation' NOT NULL,
	"joined_on" date,
	"official_on" date,
	"left_on" date,
	"opening_leave" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheet_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"amount" real NOT NULL,
	"reason" text NOT NULL,
	"from_period" text NOT NULL,
	"to_period" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheet_entries" (
	"employee_id" uuid NOT NULL,
	"day" date NOT NULL,
	"code" text,
	"note" text,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "timesheet_entries_employee_id_day_pk" PRIMARY KEY("employee_id","day")
);
--> statement-breakpoint
CREATE TABLE "timesheet_holidays" (
	"day" date PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheet_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"detail" text NOT NULL,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheet_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"from_on" date NOT NULL,
	"to_on" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"norms" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"leave_threshold" real DEFAULT 14 NOT NULL,
	"leave_per_period" real DEFAULT 1 NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheet_regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"saturdays" integer DEFAULT 0 NOT NULL,
	"tone" text DEFAULT 'blue' NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheet_snapshots" (
	"period_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"code" text NOT NULL,
	"full_name" text NOT NULL,
	"department" text NOT NULL,
	"title" text NOT NULL,
	"region_id" uuid NOT NULL,
	"employment" text NOT NULL,
	"joined_on" date,
	"left_on" date,
	"norm" real NOT NULL,
	"leave_opening" real NOT NULL,
	"leave_closing" real NOT NULL,
	CONSTRAINT "timesheet_snapshots_period_id_employee_id_pk" PRIMARY KEY("period_id","employee_id")
);
--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_region_id_timesheet_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."timesheet_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_adjustments" ADD CONSTRAINT "timesheet_adjustments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_log" ADD CONSTRAINT "timesheet_log_period_id_timesheet_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."timesheet_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_snapshots" ADD CONSTRAINT "timesheet_snapshots_period_id_timesheet_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."timesheet_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_snapshots" ADD CONSTRAINT "timesheet_snapshots_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "employees_code_idx" ON "employees" USING btree ("code");--> statement-breakpoint
CREATE INDEX "timesheet_adjustments_employee_idx" ON "timesheet_adjustments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "timesheet_entries_day_idx" ON "timesheet_entries" USING btree ("day");--> statement-breakpoint
CREATE INDEX "timesheet_log_period_idx" ON "timesheet_log" USING btree ("period_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "timesheet_periods_month_idx" ON "timesheet_periods" USING btree ("year","month");--> statement-breakpoint
CREATE UNIQUE INDEX "timesheet_regions_name_idx" ON "timesheet_regions" USING btree ("name");--> statement-breakpoint
INSERT INTO "timesheet_regions" ("name", "saturdays", "tone") VALUES ('HCM', 2, 'blue'), ('HN', 4, 'rose');
