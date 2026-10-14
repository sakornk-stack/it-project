-- CreateTable
CREATE TABLE "revoked_refresh_tokens" (
    "jti" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revoked_refresh_tokens_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE INDEX "revoked_refresh_tokens_expiresAt_idx" ON "revoked_refresh_tokens"("expiresAt");
