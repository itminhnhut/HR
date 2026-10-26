CREATE TYPE "public"."news_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "news_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "news_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid,
	"title" text DEFAULT '' NOT NULL,
	"slug" text NOT NULL,
	"status" "news_status" DEFAULT 'draft' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"cover" jsonb,
	"content" jsonb,
	"content_html" text DEFAULT '' NOT NULL,
	"plain_text" text DEFAULT '' NOT NULL,
	"headings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_category_id_news_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."news_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "news_categories_slug_idx" ON "news_categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "news_posts_slug_idx" ON "news_posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "news_posts_status_published_idx" ON "news_posts" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "news_posts_category_idx" ON "news_posts" USING btree ("category_id","status","published_at");
