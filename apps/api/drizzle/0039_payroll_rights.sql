CREATE TABLE "payroll_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"area" text NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"detail" text NOT NULL,
	"month" text,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hr_users" ADD COLUMN "can_payroll" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "hr_users" ADD COLUMN "can_approve_payroll" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "payroll_log_at_idx" ON "payroll_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "payroll_log_month_idx" ON "payroll_log" USING btree ("month","at");--> statement-breakpoint
ALTER TABLE "hr_users" ADD CONSTRAINT "hr_users_approve_needs_payroll" CHECK (not "hr_users"."can_approve_payroll" or "hr_users"."can_payroll");--> statement-breakpoint
CREATE FUNCTION "payroll_log_only_added"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'payroll_log is only added to: % refused', TG_OP;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "payroll_log_only_added" BEFORE UPDATE OR DELETE ON "payroll_log" FOR EACH ROW EXECUTE FUNCTION "payroll_log_only_added"();
