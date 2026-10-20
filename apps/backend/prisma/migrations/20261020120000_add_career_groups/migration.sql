-- Additive only: one new table and one nullable column. Existing rows and the
-- career_courses links are untouched; code from before this migration ignores both.
--
-- Rollback (only after reverting the app image; data in these two objects is lost):
--   ALTER TABLE "careers" DROP CONSTRAINT "careers_groupId_fkey";
--   DROP INDEX "careers_groupId_idx";
--   ALTER TABLE "careers" DROP COLUMN "groupId";
--   DROP TABLE "career_groups";

-- CreateTable
CREATE TABLE "career_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "career_groups_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "careers" ADD COLUMN "groupId" TEXT;

-- CreateIndex
CREATE INDEX "careers_groupId_idx" ON "careers"("groupId");

-- AddForeignKey
ALTER TABLE "careers" ADD CONSTRAINT "careers_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "career_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Soft-delete partial unique index (CONVENTIONS.md §7), same pattern as careers.
CREATE UNIQUE INDEX "career_groups_active_name_key"
  ON "career_groups" ("name")
  WHERE "isActive" = true;
