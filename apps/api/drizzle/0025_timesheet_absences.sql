CREATE TABLE "timesheet_absences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"code" text NOT NULL,
	"from_on" date NOT NULL,
	"to_on" date NOT NULL,
	"days" integer NOT NULL,
	"note" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "timesheet_absences" ADD CONSTRAINT "timesheet_absences_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "timesheet_absences_employee_idx" ON "timesheet_absences" USING btree ("employee_id","from_on");