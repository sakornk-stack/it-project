-- CreateTable
CREATE TABLE "careers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "careers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_courses" (
    "id" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "reason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "careerId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "career_courses_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "career_courses" ADD CONSTRAINT "career_courses_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "careers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_courses" ADD CONSTRAINT "career_courses_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Soft-delete partial unique indexes (CONVENTIONS.md §7): a plain @@unique would
-- keep blocking a natural key after its row is soft-deleted.
CREATE UNIQUE INDEX "careers_active_name_key"
  ON "careers" ("name")
  WHERE "isActive" = true;

CREATE UNIQUE INDEX "career_courses_active_careerId_courseId_key"
  ON "career_courses" ("careerId", "courseId")
  WHERE "isActive" = true;
