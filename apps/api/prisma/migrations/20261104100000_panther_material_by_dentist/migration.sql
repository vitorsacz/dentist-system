-- Expand-only migration: add materialByDentist flag to Attendance
-- If true: no stock deduction, materialCost treated as 0 in reports.
-- Do NOT edit existing migrations.

ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "materialByDentist" BOOLEAN NOT NULL DEFAULT false;
