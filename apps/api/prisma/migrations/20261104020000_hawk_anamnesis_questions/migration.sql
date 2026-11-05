CREATE TYPE "AnamnesisQuestionKind" AS ENUM ('YES_NO', 'TEXT');

CREATE TABLE "AnamnesisQuestion" (
  "id"                    TEXT NOT NULL,
  "organizationId"        TEXT NOT NULL,
  "key"                   TEXT NOT NULL,
  "label"                 TEXT NOT NULL,
  "kind"                  "AnamnesisQuestionKind" NOT NULL DEFAULT 'YES_NO',
  "detailRequiredWhenYes" BOOLEAN NOT NULL DEFAULT false,
  "alertWhenYes"          BOOLEAN NOT NULL DEFAULT false,
  "sensitive"             BOOLEAN NOT NULL DEFAULT false,
  "active"                BOOLEAN NOT NULL DEFAULT true,
  "order"                 INTEGER NOT NULL DEFAULT 0,
  "deletedAt"             TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnamnesisQuestion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AnamnesisQuestion"
  ADD CONSTRAINT "AnamnesisQuestion_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

CREATE UNIQUE INDEX "AnamnesisQuestion_organizationId_key_key"
  ON "AnamnesisQuestion"("organizationId", "key");

CREATE INDEX "AnamnesisQuestion_organizationId_idx"
  ON "AnamnesisQuestion"("organizationId");
