DROP INDEX "subscribers_phone_dept_idx";--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "candidate_id" uuid;--> statement-breakpoint
ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_phone_dept_owner_key" UNIQUE NULLS NOT DISTINCT("phone","department","candidate_id");