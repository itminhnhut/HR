-- Adds "hidden" (was public, taken down) and turns drafts that were once published into hidden posts.
-- Not "ALTER TYPE ... ADD VALUE": drizzle's migrator runs every pending migration in ONE transaction, and
-- Postgres refuses to use a value added that way before it commits ("unsafe use of new value"), so a data
-- fix in this or a later migration would fail whenever both are pending. A new type created in the same
-- transaction has no such limit. ALTER COLUMN ... TYPE rebuilds the indexes on "status".
ALTER TYPE "public"."news_status" RENAME TO "news_status_old";--> statement-breakpoint
CREATE TYPE "public"."news_status" AS ENUM('draft', 'published', 'hidden');--> statement-breakpoint
ALTER TABLE "news_posts" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "news_posts" ALTER COLUMN "status" SET DATA TYPE "public"."news_status" USING (
	CASE WHEN "status"::text = 'draft' AND "published_at" IS NOT NULL THEN 'hidden' ELSE "status"::text END
)::"public"."news_status";--> statement-breakpoint
ALTER TABLE "news_posts" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
DROP TYPE "public"."news_status_old";
