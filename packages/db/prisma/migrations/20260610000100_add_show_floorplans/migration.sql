-- CreateTable
CREATE TABLE "ShowFloorplan" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "venueId" TEXT,
    "name" TEXT NOT NULL,
    "dataJson" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "tableCount" INTEGER NOT NULL DEFAULT 0,
    "vendorCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShowFloorplan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShowFloorplan_showId_updatedAt_idx" ON "ShowFloorplan"("showId", "updatedAt");

-- CreateIndex
CREATE INDEX "ShowFloorplan_venueId_idx" ON "ShowFloorplan"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "ShowFloorplan_showId_name_key" ON "ShowFloorplan"("showId", "name");

-- AddForeignKey
ALTER TABLE "ShowFloorplan" ADD CONSTRAINT "ShowFloorplan_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowFloorplan" ADD CONSTRAINT "ShowFloorplan_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
