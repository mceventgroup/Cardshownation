CREATE TABLE "ImportCursor" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "cursorKey" TEXT NOT NULL,
    "seenExternalIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportCursor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImportCursor_source_scope_cursorKey_key" ON "ImportCursor"("source", "scope", "cursorKey");
CREATE INDEX "ImportCursor_source_scope_updatedAt_idx" ON "ImportCursor"("source", "scope", "updatedAt");
