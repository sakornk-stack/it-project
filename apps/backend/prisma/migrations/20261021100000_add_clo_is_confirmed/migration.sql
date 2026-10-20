-- AlterTable: existing CLOs count as confirmed; a one-off script marks copied ones false.
ALTER TABLE "clos" ADD COLUMN "isConfirmed" BOOLEAN NOT NULL DEFAULT true;
