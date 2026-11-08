CREATE TABLE "timesheet_absence_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"absence_id" uuid NOT NULL,
	"pathname" text NOT NULL,
	"name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheet_reason_settings" (
	"reason_key" text PRIMARY KEY NOT NULL,
	"needs_paper" boolean NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "timesheet_absence_kinds" ADD COLUMN "needs_paper" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "timesheet_absence_files" ADD CONSTRAINT "timesheet_absence_files_absence_id_timesheet_absences_id_fk" FOREIGN KEY ("absence_id") REFERENCES "public"."timesheet_absences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "timesheet_absence_files_absence_idx" ON "timesheet_absence_files" USING btree ("absence_id","created_at");