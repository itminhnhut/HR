CREATE TYPE "public"."application_source" AS ENUM('website', 'email', 'zalo', 'referral', 'topcv', 'vietnamworks', 'facebook', 'other');--> statement-breakpoint
CREATE TABLE "cv_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"changed_by" text NOT NULL,
	"previous" text,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "source" "application_source" DEFAULT 'website' NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "referrer" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "added_by" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "consent_by" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "candidate_cv_changes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "cv_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "cv_changed_by" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "cv_change_seen" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "cv_changes" ADD CONSTRAINT "cv_changes_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cv_changes_application_idx" ON "cv_changes" USING btree ("application_id","at");