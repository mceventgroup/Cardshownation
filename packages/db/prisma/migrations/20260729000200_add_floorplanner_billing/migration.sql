-- CreateTable
CREATE TABLE "FloorplannerSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripePriceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FloorplannerSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingWebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FloorplannerSubscription_userId_key" ON "FloorplannerSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FloorplannerSubscription_stripeCustomerId_key" ON "FloorplannerSubscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "FloorplannerSubscription_stripeSubscriptionId_key" ON "FloorplannerSubscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "FloorplannerSubscription_status_currentPeriodEnd_idx" ON "FloorplannerSubscription"("status", "currentPeriodEnd");

-- CreateIndex
CREATE INDEX "BillingWebhookEvent_type_processedAt_idx" ON "BillingWebhookEvent"("type", "processedAt");

-- CreateIndex
CREATE INDEX "BillingWebhookEvent_userId_processedAt_idx" ON "BillingWebhookEvent"("userId", "processedAt");

-- AddForeignKey
ALTER TABLE "FloorplannerSubscription" ADD CONSTRAINT "FloorplannerSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingWebhookEvent" ADD CONSTRAINT "BillingWebhookEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
