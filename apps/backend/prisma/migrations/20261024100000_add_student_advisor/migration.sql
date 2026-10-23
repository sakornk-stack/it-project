-- AlterEnum: STAFF setting or changing a student's academic advisor.
ALTER TYPE "AuditAction" ADD VALUE 'STUDENT_ADVISOR_UPDATE';

-- AlterTable: one advisor (an INSTRUCTOR account) per student; existing students start with none.
ALTER TABLE "student_profiles" ADD COLUMN     "advisorUserId" TEXT;

-- CreateIndex
CREATE INDEX "student_profiles_advisorUserId_idx" ON "student_profiles"("advisorUserId");

-- AddForeignKey: Restrict, like course_instructors, so a permanent user delete is refused while the account still advises students.
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_advisorUserId_fkey" FOREIGN KEY ("advisorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
