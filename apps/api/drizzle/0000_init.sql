CREATE TYPE "public"."application_status" AS ENUM('new', 'seen', 'interview', 'passed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'internship', 'contract');--> statement-breakpoint
CREATE TYPE "public"."job_state" AS ENUM('draft', 'published', 'paused', 'filled');--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"message" text,
	"cv_pathname" text,
	"cv_file_name" text,
	"cv_link" text,
	"keep_for_other_jobs" boolean DEFAULT false NOT NULL,
	"status" "application_status" DEFAULT 'new' NOT NULL,
	"note" text,
	"thanked_at" timestamp with time zone,
	"consent_at" timestamp with time zone NOT NULL,
	"policy_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"phone" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"cv_pathname" text,
	"cv_file_name" text,
	"keep_for_other_jobs" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"department" text NOT NULL,
	"employment_type" "employment_type" NOT NULL,
	"remote" boolean DEFAULT false NOT NULL,
	"city" text NOT NULL,
	"address" text,
	"working_hours" text,
	"level" text,
	"experience" text,
	"education" text,
	"language" text,
	"headcount" integer,
	"salary_min" integer,
	"salary_max" integer,
	"salary_note" text,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"summary" text,
	"team_note" text,
	"responsibilities" text DEFAULT '' NOT NULL,
	"requirements" text DEFAULT '' NOT NULL,
	"nice_to_have" text DEFAULT '' NOT NULL,
	"benefit_income" text DEFAULT '' NOT NULL,
	"benefit_insurance" text DEFAULT '' NOT NULL,
	"benefit_time_off" text DEFAULT '' NOT NULL,
	"benefit_growth" text DEFAULT '' NOT NULL,
	"benefit_environment" text DEFAULT '' NOT NULL,
	"plan_30" text,
	"plan_60" text,
	"plan_90" text,
	"deadline" date NOT NULL,
	"state" "job_state" DEFAULT 'draft' NOT NULL,
	"published_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"phone" text PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_jobs" (
	"phone" text NOT NULL,
	"job_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_jobs_phone_job_id_pk" PRIMARY KEY("phone","job_id")
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"department" text NOT NULL,
	"from_job_id" uuid,
	"consent_at" timestamp with time zone NOT NULL,
	"policy_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_phone_candidates_phone_fk" FOREIGN KEY ("phone") REFERENCES "public"."candidates"("phone") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_from_job_id_jobs_id_fk" FOREIGN KEY ("from_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applications_job_phone_idx" ON "applications" USING btree ("job_id","phone");--> statement-breakpoint
CREATE INDEX "applications_phone_idx" ON "applications" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "applications_created_idx" ON "applications" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "candidates_email_idx" ON "candidates" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_slug_idx" ON "jobs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "jobs_state_idx" ON "jobs" USING btree ("state");--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_phone_dept_idx" ON "subscribers" USING btree ("phone","department");