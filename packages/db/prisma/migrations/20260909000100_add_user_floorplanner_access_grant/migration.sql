ALTER TABLE "User"
ADD COLUMN "floorplannerAccessGranted" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User" AS users
SET "floorplannerAccessGranted" = true
FROM "Organizer" AS organizers
WHERE organizers."userId" = users."id"
  AND organizers."floorplanEnabled" = true;
