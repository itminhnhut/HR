CREATE TABLE "timesheet_absence_kinds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"days" integer,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "timesheet_absences" ALTER COLUMN "days" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "timesheet_absences" ADD COLUMN "label" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "timesheet_absences" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "timesheet_absences" ADD COLUMN "handover" text DEFAULT '' NOT NULL;