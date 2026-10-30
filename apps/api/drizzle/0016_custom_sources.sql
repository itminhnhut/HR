CREATE TYPE "public"."source_kind" AS ENUM('system', 'builtin', 'custom');--> statement-breakpoint
CREATE TABLE "application_sources" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"kind" "source_kind" DEFAULT 'custom' NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- The enum default must go before the type changes; the old values become keys of the list below.
ALTER TABLE "applications" ALTER COLUMN "source" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "source" SET DATA TYPE text USING "source"::text;--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "source" SET DEFAULT 'website';--> statement-breakpoint
-- The 8 sources that existed as an enum, with the same keys, before the foreign key is checked.
INSERT INTO "application_sources" ("key", "name", "name_key", "kind", "position") VALUES
  ('website', 'Website', 'website', 'system', 0),
  ('email', 'Email', 'email', 'builtin', 1),
  ('zalo', 'Zalo', 'zalo', 'builtin', 2),
  ('referral', 'Người giới thiệu', 'nguoi gioi thieu', 'builtin', 3),
  ('topcv', 'TopCV', 'topcv', 'builtin', 4),
  ('vietnamworks', 'VietnamWorks', 'vietnamworks', 'builtin', 5),
  ('facebook', 'Facebook', 'facebook', 'builtin', 6),
  ('other', 'Khác', 'khac', 'builtin', 7);--> statement-breakpoint
CREATE UNIQUE INDEX "application_sources_name_key_idx" ON "application_sources" USING btree ("name_key");--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_source_application_sources_key_fk" FOREIGN KEY ("source") REFERENCES "public"."application_sources"("key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
DROP TYPE "public"."application_source";