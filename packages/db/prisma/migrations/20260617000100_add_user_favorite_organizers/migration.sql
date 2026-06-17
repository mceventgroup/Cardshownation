CREATE TABLE "UserFavoriteOrganizer" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserFavoriteOrganizer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserFavoriteOrganizer_userId_organizerId_key"
ON "UserFavoriteOrganizer"("userId", "organizerId");

CREATE INDEX "UserFavoriteOrganizer_organizerId_idx"
ON "UserFavoriteOrganizer"("organizerId");

ALTER TABLE "UserFavoriteOrganizer"
ADD CONSTRAINT "UserFavoriteOrganizer_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserFavoriteOrganizer"
ADD CONSTRAINT "UserFavoriteOrganizer_organizerId_fkey"
FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
