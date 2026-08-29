-- Add global organizer moderation states while preserving existing trusted-market behavior.
CREATE TYPE "OrganizerModerationStatus" AS ENUM ('NEW', 'TRUSTED', 'BLOCKED');

ALTER TABLE "Organizer"
ADD COLUMN "moderationStatus" "OrganizerModerationStatus" NOT NULL DEFAULT 'NEW';

UPDATE "Organizer" AS organizer
SET "moderationStatus" = 'TRUSTED'
WHERE EXISTS (
  SELECT 1
  FROM "OrganizerApproval" AS approval
  WHERE approval."organizerId" = organizer."id"
    AND approval."autoApprove" = true
);

ALTER TABLE "Show"
ADD COLUMN "dedupeKey" TEXT;

ALTER TABLE "ShowSubmission"
ADD COLUMN "organizerId" TEXT,
ADD COLUMN "dedupeKey" TEXT;

UPDATE "ShowSubmission" AS submission
SET "organizerId" = submission."payloadJson" ->> 'organizerId'
WHERE submission."payloadJson" ? 'organizerId'
  AND EXISTS (
    SELECT 1
    FROM "Organizer" AS organizer
    WHERE organizer."id" = submission."payloadJson" ->> 'organizerId'
  );

CREATE TABLE "ModerationDigestDelivery" (
  "id" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "slotKey" TEXT NOT NULL,
  "pendingCount" INTEGER NOT NULL,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModerationDigestDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Show_dedupeKey_key" ON "Show"("dedupeKey");
CREATE INDEX "Organizer_email_idx" ON "Organizer"("email");
CREATE INDEX "Organizer_moderationStatus_idx" ON "Organizer"("moderationStatus");
CREATE INDEX "ShowSubmission_organizerId_status_createdAt_idx"
ON "ShowSubmission"("organizerId", "status", "createdAt");
CREATE INDEX "ShowSubmission_dedupeKey_status_idx"
ON "ShowSubmission"("dedupeKey", "status");
CREATE UNIQUE INDEX "ModerationDigestDelivery_recipientEmail_slotKey_key"
ON "ModerationDigestDelivery"("recipientEmail", "slotKey");
CREATE INDEX "ModerationDigestDelivery_slotKey_sentAt_idx"
ON "ModerationDigestDelivery"("slotKey", "sentAt");

ALTER TABLE "ShowSubmission"
ADD CONSTRAINT "ShowSubmission_organizerId_fkey"
FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
