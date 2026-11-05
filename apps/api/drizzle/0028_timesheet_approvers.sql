CREATE TABLE "timesheet_approvers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "timesheet_approvers_name_idx" ON "timesheet_approvers" USING btree (lower("name"));