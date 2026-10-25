CREATE TABLE "cv_scores" (
	"application_id" uuid PRIMARY KEY NOT NULL,
	"percent" integer,
	"items" jsonb NOT NULL,
	"note" text,
	"version" integer NOT NULL,
	"cv_pathname" text,
	"requirements_key" text NOT NULL,
	"scored_at" timestamp with time zone NOT NULL
);--> statement-breakpoint
ALTER TABLE "cv_scores" ADD CONSTRAINT "cv_scores_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;
