CREATE TABLE "AuthIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "providerEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthIdentity_provider_providerSubject_key"
ON "AuthIdentity"("provider", "providerSubject");

CREATE UNIQUE INDEX "AuthIdentity_provider_userId_key"
ON "AuthIdentity"("provider", "userId");

CREATE INDEX "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");

ALTER TABLE "AuthIdentity"
ADD CONSTRAINT "AuthIdentity_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
