CREATE TABLE "recruitment_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid,
	"candidate_name" text,
	"job_title" text,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"group" text NOT NULL,
	"detail" text,
	"from_value" text,
	"to_value" text,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recruitment_log" ADD CONSTRAINT "recruitment_log_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recruitment_log_at_idx" ON "recruitment_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "recruitment_log_application_idx" ON "recruitment_log" USING btree ("application_id");