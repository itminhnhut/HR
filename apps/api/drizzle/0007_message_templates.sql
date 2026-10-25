CREATE TYPE "public"."interview_mode" AS ENUM('onsite', 'online');--> statement-breakpoint
CREATE TYPE "public"."template_key" AS ENUM('interview_onsite', 'interview_online', 'rejection', 'call');--> statement-breakpoint
CREATE TYPE "public"."contact_channel" AS ENUM('gmail', 'mailto', 'copy');--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "interview_mode" "interview_mode";--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "meeting_url" text;--> statement-breakpoint
ALTER TABLE "hr_users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "hr_users" ADD COLUMN "contact_email" text;--> statement-breakpoint
CREATE TABLE "message_templates" (
	"key" "template_key" PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "contact_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"template_key" "template_key" NOT NULL,
	"channel" "contact_channel" NOT NULL,
	"hr_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "contact_log" ADD CONSTRAINT "contact_log_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_log_application_idx" ON "contact_log" USING btree ("application_id");
