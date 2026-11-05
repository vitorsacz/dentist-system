-- Migration: expand-only — add nullable profile fields to Organization
ALTER TABLE "Organization" ADD COLUMN "phone"       TEXT;
ALTER TABLE "Organization" ADD COLUMN "email"       TEXT;
ALTER TABLE "Organization" ADD COLUMN "address"     TEXT;
ALTER TABLE "Organization" ADD COLUMN "logoDataUrl" TEXT;
