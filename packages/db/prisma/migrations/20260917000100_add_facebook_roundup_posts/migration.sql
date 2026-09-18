CREATE TABLE "FacebookRoundupPost" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "rangeStart" TEXT NOT NULL,
    "rangeEnd" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHING',
    "postId" TEXT,
    "error" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FacebookRoundupPost_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FacebookRoundupPost_pageId_state_rangeStart_rangeEnd_key"
ON "FacebookRoundupPost"("pageId", "state", "rangeStart", "rangeEnd");
CREATE INDEX "FacebookRoundupPost_pageId_createdAt_idx" ON "FacebookRoundupPost"("pageId", "createdAt");
