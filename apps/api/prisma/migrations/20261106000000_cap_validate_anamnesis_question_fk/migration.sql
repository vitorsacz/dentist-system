-- Validate FK added NOT VALID by HAWK in migration 20261104020000_hawk_anamnesis_questions
ALTER TABLE "AnamnesisQuestion" VALIDATE CONSTRAINT "AnamnesisQuestion_organizationId_fkey";
