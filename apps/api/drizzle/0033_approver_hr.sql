-- "HR" approves the leave HR types straight into the sheet; kept if HR already added it.
INSERT INTO "timesheet_approvers" ("name") VALUES ('HR') ON CONFLICT DO NOTHING;
