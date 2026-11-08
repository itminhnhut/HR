CREATE TABLE "timesheet_absence_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"reason" text NOT NULL,
	"label" text NOT NULL,
	"code" text NOT NULL,
	"from_on" date NOT NULL,
	"to_on" date NOT NULL,
	"approved_by" text,
	"note" text DEFAULT '' NOT NULL,
	"audience" jsonb NOT NULL,
	"employee_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "timesheet_absences" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
CREATE INDEX "timesheet_absence_batches_from_idx" ON "timesheet_absence_batches" USING btree ("from_on");--> statement-breakpoint
ALTER TABLE "timesheet_absences" ADD CONSTRAINT "timesheet_absences_batch_id_timesheet_absence_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."timesheet_absence_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "timesheet_absences_batch_idx" ON "timesheet_absences" USING btree ("batch_id");