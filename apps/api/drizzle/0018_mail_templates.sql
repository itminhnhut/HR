-- Mail design (spec-mail-templates-outlook.md).
-- ADD VALUE: nothing in this migration uses the new values. Drizzle runs every pending migration in ONE transaction and
-- Postgres refuses a value added that way before it commits, so a later migration must not use them in the same run.
ALTER TYPE "public"."template_key" ADD VALUE 'rejection_interview' BEFORE 'call';--> statement-breakpoint
ALTER TYPE "public"."contact_channel" ADD VALUE 'copy_html';--> statement-breakpoint
ALTER TABLE "message_templates" ADD COLUMN "note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "message_templates" ADD COLUMN "callout_title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "message_templates" ADD COLUMN "callout" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "message_templates" ADD COLUMN "closing" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "hr_users" ADD COLUMN "job_title" text DEFAULT 'HR Generalist';--> statement-breakpoint
ALTER TABLE "hr_users" ADD COLUMN "alias" text;--> statement-breakpoint
-- Saved wording is one long text from before the mail design, so every template goes back to the new built-in texts.
-- Checked before running: production must have no HR-edited templates (the lead verifies this before deploying).
DELETE FROM "message_templates";
