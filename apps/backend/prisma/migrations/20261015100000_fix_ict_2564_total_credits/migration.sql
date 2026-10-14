-- ICT curriculum 2564: the published figure is 126 credits (curriculum book, and the
-- sum of its category minCredits), but the early placeholder 132 may still be in the
-- database. Data only, no schema change. Idempotent: matches only the active ICT 2564
-- row that still holds 132, so a re-run, a row already at 126, a manual edit to another
-- value, or a missing row all leave the data untouched. No other curriculum is changed.
UPDATE "curricula"
SET "totalCredits" = 126
WHERE "version" = '2564'
  AND "isActive" = true
  AND "totalCredits" = 132
  AND "programId" IN (SELECT "id" FROM "programs" WHERE "code" = 'ICT');
