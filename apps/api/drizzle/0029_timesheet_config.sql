CREATE TABLE "timesheet_departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheet_staff_kinds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"rule" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "staff_kind_id" uuid;--> statement-breakpoint
ALTER TABLE "timesheet_snapshots" ADD COLUMN "staff_label" text;--> statement-breakpoint
CREATE UNIQUE INDEX "timesheet_departments_name_idx" ON "timesheet_departments" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "timesheet_staff_kinds_name_idx" ON "timesheet_staff_kinds" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_staff_kind_id_timesheet_staff_kinds_id_fk" FOREIGN KEY ("staff_kind_id") REFERENCES "public"."timesheet_staff_kinds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "timesheet_staff_kinds" ("name", "rule", "is_default") VALUES ('Chính thức', 'official', true), ('Thử việc', 'probation', true);--> statement-breakpoint
INSERT INTO "timesheet_departments" ("name") SELECT DISTINCT "department" FROM "employees" WHERE "department" <> '' ON CONFLICT DO NOTHING;
