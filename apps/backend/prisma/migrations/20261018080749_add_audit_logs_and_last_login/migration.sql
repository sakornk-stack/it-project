-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('GRADE_CREATE', 'GRADE_UPDATE', 'GRADE_DELETE', 'STUDENT_SUSPEND', 'STUDENT_REACTIVATE', 'STUDENT_PROFILE_UPDATE', 'STUDENT_INVITATION_CANCEL');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lastLoginAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" "Role" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "studentProfileId" TEXT,
    "programId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_studentProfileId_createdAt_idx" ON "audit_logs"("studentProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_programId_createdAt_idx" ON "audit_logs"("programId", "createdAt");
