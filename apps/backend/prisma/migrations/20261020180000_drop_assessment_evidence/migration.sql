-- Removes the retired assessment-evidence feature (instructor per-assessment scores).
-- Created by 20260829140511_add_assessment_evidence_infrastructure, which stays untouched.
-- The tables were empty on the VPS; the foreign keys, the primary keys and the indexes
-- (including the partial unique index on assessment_clo_mappings) are dropped with their tables.

-- DropTable (child before parent, following the foreign keys)
DROP TABLE "student_assessment_scores";

-- DropTable
DROP TABLE "assessment_clo_mappings";

-- DropTable
DROP TABLE "assessment_definitions";

-- DropEnum
DROP TYPE "AssessmentScoreStatus";

-- DropEnum
DROP TYPE "MissingScorePolicy";
