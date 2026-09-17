-- CreateEnum
CREATE TYPE "TenantType" AS ENUM ('CLINIC');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "foundingAdminUserId" TEXT,
ADD COLUMN     "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "type" "TenantType" NOT NULL DEFAULT 'CLINIC';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nickname" TEXT,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "role" "Role";

-- CreateIndex
CREATE UNIQUE INDEX "Organization_foundingAdminUserId_key" ON "Organization"("foundingAdminUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_nickname_key" ON "User"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "User_organizationId_email_key" ON "User"("organizationId", "email");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_foundingAdminUserId_fkey" FOREIGN KEY ("foundingAdminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

