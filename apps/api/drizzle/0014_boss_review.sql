CREATE TYPE "public"."review_decision" AS ENUM('approve', 'reject', 'ask');--> statement-breakpoint
CREATE TYPE "public"."review_pick" AS ENUM('yes', 'maybe');--> statement-breakpoint
CREATE TABLE "review_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"title" text NOT NULL,
	"sender_name" text NOT NULL,
	"reviewer_name" text NOT NULL,
	"message" text,
	"respond_by" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"application_id" uuid,
	"kind" text NOT NULL,
	"decision" "review_decision",
	"actor" text NOT NULL,
	"detail" text,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"hr_pick" "review_pick" DEFAULT 'maybe' NOT NULL,
	"hr_comment" text,
	"decision" "review_decision",
	"reviewer_comment" text,
	"decided_at" timestamp with time zone,
	"hr_reply" text,
	"hr_replied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_items_batch_application_unique" UNIQUE("batch_id","application_id")
);
--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_batch_id_review_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."review_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_batch_id_review_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."review_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "review_batches_token_idx" ON "review_batches" USING btree ("token");--> statement-breakpoint
CREATE INDEX "review_events_batch_idx" ON "review_events" USING btree ("batch_id","at");--> statement-breakpoint
CREATE INDEX "review_items_application_idx" ON "review_items" USING btree ("application_id");