CREATE TABLE "EmailSuppression" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailSuppression_email_key" ON "EmailSuppression"("email");
