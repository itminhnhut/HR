-- "Ưu tiên (không bắt buộc)": nice-to-have qualifications, kept apart from "Yêu cầu".
ALTER TABLE "jobs" ADD COLUMN "preferred" text DEFAULT '' NOT NULL;
