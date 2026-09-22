-- CreateEnum
CREATE TYPE "PaletteColorToken" AS ENUM ('BRAND', 'SUCCESS', 'WARNING', 'ERROR', 'INFO');

-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN     "colorToken" "PaletteColorToken";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "colorToken" "PaletteColorToken";
