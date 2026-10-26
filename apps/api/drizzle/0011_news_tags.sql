CREATE TABLE "news_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "news_post_tags" (
	"post_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "news_post_tags_post_id_tag_id_pk" PRIMARY KEY("post_id","tag_id")
);--> statement-breakpoint
ALTER TABLE "news_post_tags" ADD CONSTRAINT "news_post_tags_post_id_news_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."news_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_post_tags" ADD CONSTRAINT "news_post_tags_tag_id_news_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."news_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "news_tags_slug_idx" ON "news_tags" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "news_post_tags_tag_idx" ON "news_post_tags" USING btree ("tag_id");
