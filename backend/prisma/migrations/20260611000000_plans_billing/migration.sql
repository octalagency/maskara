-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBangla" TEXT,
    "description" TEXT,
    "priceMonthly" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "callLimit" INTEGER NOT NULL,
    "smsLimit" INTEGER NOT NULL,
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "features" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingRecord" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "BillingStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "paymentRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE INDEX "BillingRecord_merchantId_idx" ON "BillingRecord"("merchantId");
CREATE INDEX "BillingRecord_status_idx" ON "BillingRecord"("status");
CREATE INDEX "BillingRecord_createdAt_idx" ON "BillingRecord"("createdAt");

-- AddForeignKey
ALTER TABLE "BillingRecord" ADD CONSTRAINT "BillingRecord_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
