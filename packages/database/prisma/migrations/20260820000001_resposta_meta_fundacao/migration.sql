-- AlterTable
ALTER TABLE "tenant_usage_monthly" ADD COLUMN     "aiAttendances" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "closeReason" TEXT;

-- CreateTable
CREATE TABLE "meta_billing_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "wamid" TEXT NOT NULL,
    "recipientId" TEXT,
    "status" TEXT NOT NULL,
    "billable" BOOLEAN,
    "pricingModel" TEXT,
    "category" TEXT,
    "pricingType" TEXT,
    "phoneNumberId" TEXT,
    "conversationId" TEXT,
    "messageId" TEXT,
    "rawPricing" JSONB,
    "statusTs" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_health_checks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "ok" BOOLEAN NOT NULL,
    "qualityRating" TEXT,
    "messagingTier" TEXT,
    "errorCode" TEXT,
    "detail" JSONB,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meta_billing_events_wamid_key" ON "meta_billing_events"("wamid");

-- CreateIndex
CREATE INDEX "meta_billing_events_organizationId_statusTs_idx" ON "meta_billing_events"("organizationId", "statusTs");

-- CreateIndex
CREATE INDEX "meta_billing_events_organizationId_deliveredAt_idx" ON "meta_billing_events"("organizationId", "deliveredAt");

-- CreateIndex
CREATE INDEX "channel_health_checks_organizationId_checkedAt_idx" ON "channel_health_checks"("organizationId", "checkedAt");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "meta_billing_events" ADD CONSTRAINT "meta_billing_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_health_checks" ADD CONSTRAINT "channel_health_checks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

