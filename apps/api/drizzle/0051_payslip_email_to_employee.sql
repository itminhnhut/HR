-- One place for "Email nhận phiếu lương": the person's own record (Chấm công › Nhân viên). The address kept with a
-- bank account is copied there when the person has none: the latest account that has one, lowercased, only if it
-- looks like an email. Nothing is overwritten and the old column stays (unused), so no data is lost.
UPDATE "employees" e
SET "email" = src."email"
FROM (
  SELECT DISTINCT ON ("employee_id") "employee_id", lower(btrim("payslip_email")) AS "email"
  FROM "payroll_bank_accounts"
  WHERE "payslip_email" IS NOT NULL AND btrim("payslip_email") ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ORDER BY "employee_id", "changed_on" DESC, "created_at" DESC
) src
WHERE e."id" = src."employee_id" AND e."email" IS NULL;
