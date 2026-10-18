-- CreateTable
CREATE TABLE "email_signup_requests" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "studentCode" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "admissionYear" INTEGER NOT NULL,
    "privacyPolicyVersion" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL,
    "sendCount" INTEGER NOT NULL DEFAULT 1,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_signup_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_signup_requests_email_key" ON "email_signup_requests"("email");

-- CreateIndex
CREATE UNIQUE INDEX "email_signup_requests_tokenHash_key" ON "email_signup_requests"("tokenHash");

-- CreateIndex
CREATE INDEX "email_signup_requests_expiresAt_idx" ON "email_signup_requests"("expiresAt");
