CREATE TABLE "payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"approval_no" integer NOT NULL,
	"closing_id" uuid NOT NULL,
	"snapshot" jsonb NOT NULL,
	"approved_at" timestamp with time zone NOT NULL,
	"approved_by" text NOT NULL,
	"reopened_at" timestamp with time zone,
	"reopened_by" text,
	"reopen_reason" text,
	CONSTRAINT "payroll_runs_no" CHECK ("payroll_runs"."approval_no" > 0),
	CONSTRAINT "payroll_runs_reopened" CHECK (("payroll_runs"."reopened_at" is null) = ("payroll_runs"."reopened_by" is null) and ("payroll_runs"."reopened_at" is null) = ("payroll_runs"."reopen_reason" is null))
);
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_period_id_payroll_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_closing_id_timesheet_closings_id_fk" FOREIGN KEY ("closing_id") REFERENCES "public"."timesheet_closings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_runs_period_no_idx" ON "payroll_runs" USING btree ("period_id","approval_no");--> statement-breakpoint
CREATE FUNCTION "payroll_runs_unchanged"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."reopened_at" IS NULL
    AND (NEW."id", NEW."period_id", NEW."approval_no", NEW."closing_id", NEW."snapshot", NEW."approved_at", NEW."approved_by")
      IS NOT DISTINCT FROM (OLD."id", OLD."period_id", OLD."approval_no", OLD."closing_id", OLD."snapshot", OLD."approved_at", OLD."approved_by")
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'payroll_runs is never changed but for being reopened once: % refused', TG_OP;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "payroll_runs_unchanged" BEFORE UPDATE OR DELETE ON "payroll_runs" FOR EACH ROW EXECUTE FUNCTION "payroll_runs_unchanged"();
