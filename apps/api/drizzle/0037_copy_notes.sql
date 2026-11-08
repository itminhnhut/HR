-- Each old "Ghi chú nội bộ" becomes the first entry of its timeline, word for word, with the time and author of its
-- last save. A note saved before those were written down takes the application's last change as its time and no
-- author. Blank notes are left out. applications.note stays as it was (spec-nhat-ky-ho-so.md).
INSERT INTO "application_notes" ("application_id", "body", "created_by", "created_at", "updated_at")
SELECT a."id", a."note", a."note_updated_by", COALESCE(a."note_updated_at", a."updated_at"), COALESCE(a."note_updated_at", a."updated_at")
FROM "applications" a
WHERE a."note" IS NOT NULL
  AND btrim(a."note", E' \t\r\n') <> ''
  AND NOT EXISTS (SELECT 1 FROM "application_notes" n WHERE n."application_id" = a."id");
