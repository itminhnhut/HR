UPDATE "jobs" SET "employment_type" = 'full_time' WHERE "employment_type" = 'contract';--> statement-breakpoint
ALTER TYPE "public"."employment_type" RENAME TO "employment_type_old";--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'internship');--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "employment_type" SET DATA TYPE "public"."employment_type" USING "employment_type"::text::"public"."employment_type";--> statement-breakpoint
DROP TYPE "public"."employment_type_old";--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "benefits" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "roadmap" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
-- The five benefit boxes become one list, one benefit per line, bullets stripped.
UPDATE "jobs" SET "benefits" = coalesce((
  SELECT array_agg(item ORDER BY ord)
  FROM (
    SELECT btrim(regexp_replace(line, '^[-•*[:space:]]+', '')) AS item, ord
    FROM unnest(string_to_array(concat_ws(E'\n', "benefit_income", "benefit_insurance", "benefit_time_off", "benefit_growth", "benefit_environment"), E'\n')) WITH ORDINALITY AS t(line, ord)
  ) lines
  WHERE item <> ''
), '{}');--> statement-breakpoint
-- "Điểm cộng" now lives at the end of "Yêu cầu".
UPDATE "jobs" SET "requirements" = concat_ws(E'\n', nullif("requirements", ''), nullif("nice_to_have", ''));--> statement-breakpoint
-- Salaries were millions of VND; now plain VND.
UPDATE "jobs" SET "salary_min" = "salary_min" * 1000000, "salary_max" = "salary_max" * 1000000;--> statement-breakpoint
-- The 30/60/90-day plan becomes the company's standard probation roadmap.
UPDATE "jobs" SET "roadmap" = ARRAY[
  'Nhận máy, tài khoản; gặp quản lý và cả nhóm.',
  'Nắm quy trình làm việc của phòng, làm việc nhỏ cùng người kèm.',
  'Tự làm công việc hằng ngày, người kèm xem lại.',
  'Làm độc lập phần việc chính, thống nhất mục tiêu thử việc với quản lý.',
  'Đánh giá cùng quản lý và ký hợp đồng chính thức.'
];--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "remote";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "city";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "level";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "language";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "headcount";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "salary_note";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "skills";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "summary";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "team_note";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "nice_to_have";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "benefit_income";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "benefit_insurance";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "benefit_time_off";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "benefit_growth";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "benefit_environment";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "plan_30";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "plan_60";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "plan_90";
