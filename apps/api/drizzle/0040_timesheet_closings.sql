CREATE TABLE "timesheet_closing_rows" (
	"closing_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"code" text NOT NULL,
	"full_name" text NOT NULL,
	"department" text NOT NULL,
	"title" text NOT NULL,
	"region_id" uuid NOT NULL,
	"staff_kind_id" uuid,
	"staff_label" text,
	"employment" text NOT NULL,
	"joined_on" date,
	"official_on" date,
	"left_on" date,
	"norm" real NOT NULL,
	"totals" jsonb,
	"codes" jsonb,
	"cannot_rebuild" boolean DEFAULT false NOT NULL,
	CONSTRAINT "timesheet_closing_rows_closing_id_employee_id_pk" PRIMARY KEY("closing_id","employee_id"),
	CONSTRAINT "timesheet_closing_rows_codes_or_flag" CHECK ("timesheet_closing_rows"."cannot_rebuild" = ("timesheet_closing_rows"."codes" is null))
);
--> statement-breakpoint
CREATE TABLE "timesheet_closings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"close_no" integer NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"from_on" date NOT NULL,
	"to_on" date NOT NULL,
	"closed_at" timestamp with time zone NOT NULL,
	"closed_by" text NOT NULL,
	"source" text DEFAULT 'web' NOT NULL,
	"holidays" jsonb NOT NULL,
	"regions" jsonb NOT NULL,
	"norms" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "timesheet_closing_rows" ADD CONSTRAINT "timesheet_closing_rows_closing_id_timesheet_closings_id_fk" FOREIGN KEY ("closing_id") REFERENCES "public"."timesheet_closings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_closing_rows" ADD CONSTRAINT "timesheet_closing_rows_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_closings" ADD CONSTRAINT "timesheet_closings_period_id_timesheet_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."timesheet_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "timesheet_closing_rows_employee_idx" ON "timesheet_closing_rows" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "timesheet_closings_period_no_idx" ON "timesheet_closings" USING btree ("period_id","close_no");--> statement-breakpoint
CREATE FUNCTION "timesheet_closing_never_changed"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'a timesheet close is never changed or removed: % on % refused', TG_OP, TG_TABLE_NAME;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "timesheet_closings_never_changed" BEFORE UPDATE OR DELETE ON "timesheet_closings" FOR EACH ROW EXECUTE FUNCTION "timesheet_closing_never_changed"();--> statement-breakpoint
CREATE TRIGGER "timesheet_closing_rows_never_changed" BEFORE UPDATE OR DELETE ON "timesheet_closing_rows" FOR EACH ROW EXECUTE FUNCTION "timesheet_closing_never_changed"();--> statement-breakpoint
-- Backfill (spec-luong.md 10.1): every period closed now becomes close number 1, copied from its snapshot.
INSERT INTO "timesheet_closings" ("period_id", "close_no", "year", "month", "from_on", "to_on", "closed_at", "closed_by", "source", "holidays", "regions", "norms")
SELECT p."id", 1, p."year", p."month", p."from_on", p."to_on", coalesce(p."closed_at", p."created_at"), coalesce(p."closed_by", ''), 'backfill',
  coalesce(p."frozen" -> 'holidays', '[]'::jsonb), coalesce(p."frozen" -> 'regions', '[]'::jsonb), p."norms"
FROM "timesheet_periods" p
WHERE p."status" = 'closed';--> statement-breakpoint
-- The code of each day, as dayCode in @careers/shared gives it on the day of the close: outside the person's dates none,
-- else what HR entered, else NL on a holiday of the close, else 1 on Mon–Fri. Then the counts the codes alone decide are
-- checked against the snapshot's totals; a person they do not match keeps no codes and the flag, nothing guessed.
INSERT INTO "timesheet_closing_rows" ("closing_id", "employee_id", "code", "full_name", "department", "title", "region_id", "staff_kind_id", "staff_label", "employment", "joined_on", "official_on", "left_on", "norm", "totals", "codes", "cannot_rebuild")
WITH "days" AS (
  SELECT c."id" AS "closing_id", s."employee_id", d::date AS "day",
    extract(isodow FROM d) AS "dow",
    EXISTS (SELECT 1 FROM jsonb_array_elements(c."holidays") h WHERE h ->> 'day' = to_char(d, 'YYYY-MM-DD')) AS "is_holiday",
    CASE
      WHEN (s."joined_on" IS NOT NULL AND d::date < s."joined_on") OR (s."left_on" IS NOT NULL AND d::date > s."left_on") THEN NULL
      WHEN e."code" IS NOT NULL THEN e."code"
      WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(c."holidays") h WHERE h ->> 'day' = to_char(d, 'YYYY-MM-DD')) THEN 'NL'
      WHEN extract(isodow FROM d) < 6 AND d::date <= (c."closed_at" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN '1'
      ELSE NULL
    END AS "code"
  FROM "timesheet_closings" c
  JOIN "timesheet_snapshots" s ON s."period_id" = c."period_id"
  CROSS JOIN generate_series(c."from_on"::timestamp, c."to_on"::timestamp, interval '1 day') d
  LEFT JOIN "timesheet_entries" e ON e."employee_id" = s."employee_id" AND e."day" = d::date
  WHERE c."source" = 'backfill'
), "counted" AS (
  SELECT "closing_id", "employee_id",
    jsonb_object_agg(to_char("day", 'YYYY-MM-DD'), "code") AS "codes",
    jsonb_build_object(
      'actual', count(*) FILTER (WHERE "code" IN ('1', 'M')) + 0.5 * count(*) FILTER (WHERE "code" IN ('P/2', 'KL/2')),
      'lateCount', count(*) FILTER (WHERE "code" = 'M'),
      'leave', count(*) FILTER (WHERE "code" = 'P') + 0.5 * count(*) FILTER (WHERE "code" = 'P/2'),
      'unpaidLeave', count(*) FILTER (WHERE "code" = 'KL') + 0.5 * count(*) FILTER (WHERE "code" = 'KL/2'),
      'absent', count(*) FILTER (WHERE "code" = 'KP'),
      'holiday', count(*) FILTER (WHERE "code" = 'NL'),
      'personalPaid', count(*) FILTER (WHERE "code" = 'CL'),
      'insured', count(*) FILTER (WHERE "code" IN ('TS', 'OM')),
      'maternity', count(*) FILTER (WHERE "code" = 'TS'),
      'sick', count(*) FILTER (WHERE "code" = 'OM'),
      'holidayWorked', count(*) FILTER (WHERE "code" IN ('1', 'M') AND "is_holiday"),
      'sundayWorked', count(*) FILTER (WHERE "code" IN ('1', 'M') AND NOT "is_holiday" AND "dow" = 7)
    ) AS "counts"
  FROM "days"
  GROUP BY "closing_id", "employee_id"
), "checked" AS (
  SELECT k."closing_id", k."employee_id", k."codes",
    s."totals" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM jsonb_each(k."counts") n
      WHERE s."totals" ? n.key AND (s."totals" ->> n.key)::numeric <> (n.value #>> '{}')::numeric
    ) AS "matches"
  FROM "counted" k
  JOIN "timesheet_closings" c ON c."id" = k."closing_id"
  JOIN "timesheet_snapshots" s ON s."period_id" = c."period_id" AND s."employee_id" = k."employee_id"
)
SELECT c."id", s."employee_id", s."code", s."full_name", s."department", s."title", s."region_id",
  (SELECT k."id" FROM "timesheet_staff_kinds" k WHERE lower(k."name") = lower(s."staff_label")),
  s."staff_label", s."employment", s."joined_on", emp."official_on", s."left_on", s."norm", s."totals",
  CASE WHEN ch."matches" THEN ch."codes" END, NOT ch."matches"
FROM "timesheet_closings" c
JOIN "timesheet_snapshots" s ON s."period_id" = c."period_id"
JOIN "employees" emp ON emp."id" = s."employee_id"
JOIN "checked" ch ON ch."closing_id" = c."id" AND ch."employee_id" = s."employee_id"
WHERE c."source" = 'backfill';
