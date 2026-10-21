-- One-off, NOT run automatically. Marks the CLOs copied from ICT 2569 into ICT 2564
-- (copy-clo-ict-2569-to-2564.ts) as not yet confirmed, so ADMIN sees the
-- "ยังไม่ยืนยัน" badge on /admin/curriculum/[id]/outcomes until each one is checked.
--
-- Scope: active CLOs of active courses of the ICT program's version "2564" curriculum
-- only. Other curricula are never touched. Run it once, BEFORE ADMIN adds CLOs by
-- hand in 2564 (a second run would flag those too). Needs migration
-- 20261021100000_add_clo_is_confirmed applied. Back up first: on the dev machine
-- `bash scripts/db-backup.sh <label>`, on the VPS `bash deploy/backup-db.sh <label>`.
--
-- Usage (inside the postgres container; never print the connection string):
--   docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
--     < apps/backend/prisma/mark-ict-2564-clos-unconfirmed.sql
-- Compare the "before" total with the number of copied CLOs you expect (the dev database
-- held 70 active ICT 2564 CLOs on 2026-10-21, not 85). "after" must show confirmed = 0 and
-- unconfirmed = that same total. To dry-run, replace COMMIT with ROLLBACK.

BEGIN;

CREATE TEMP VIEW ict_2564_clos AS
SELECT c.id, c."isConfirmed"
FROM clos c
JOIN courses co ON co.id = c."courseId" AND co."isActive"
JOIN curricula cu ON cu.id = co."curriculumId" AND cu."isActive" AND cu.version = '2564'
JOIN programs p ON p.id = cu."programId" AND p."isActive" AND p.code = 'ICT'
WHERE c."isActive";

SELECT 'before' AS stage,
       count(*) FILTER (WHERE "isConfirmed") AS confirmed,
       count(*) FILTER (WHERE NOT "isConfirmed") AS unconfirmed,
       count(*) AS total
FROM ict_2564_clos;

UPDATE clos SET "isConfirmed" = false
WHERE id IN (SELECT id FROM ict_2564_clos WHERE "isConfirmed");

SELECT 'after' AS stage,
       count(*) FILTER (WHERE "isConfirmed") AS confirmed,
       count(*) FILTER (WHERE NOT "isConfirmed") AS unconfirmed,
       count(*) AS total
FROM ict_2564_clos;

COMMIT;
