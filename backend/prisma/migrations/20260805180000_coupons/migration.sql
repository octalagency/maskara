-- Coupon codes for merchant subscription discounts
CREATE TYPE "CouponType" AS ENUM ('PERCENT', 'FIXED');

ALTER TABLE "BillingRecord" ADD COLUMN IF NOT EXISTS "couponCode" TEXT;
ALTER TABLE "BillingRecord" ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(10,2);
ALTER TABLE "BillingRecord" ADD COLUMN IF NOT EXISTS "originalAmount" DECIMAL(10,2);

CREATE INDEX IF NOT EXISTS "BillingRecord_couponCode_idx" ON "BillingRecord"("couponCode");

CREATE TABLE IF NOT EXISTS "Coupon" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "type" "CouponType" NOT NULL,
  "value" DECIMAL(10,2) NOT NULL,
  "planCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "merchantIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "maxRedemptions" INTEGER,
  "perMerchantLimit" INTEGER NOT NULL DEFAULT 1,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX IF NOT EXISTS "Coupon_isActive_idx" ON "Coupon"("isActive");

CREATE TABLE IF NOT EXISTS "CouponRedemption" (
  "id" TEXT NOT NULL,
  "couponId" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "billingId" TEXT,
  "planCode" TEXT NOT NULL,
  "originalAmount" DECIMAL(10,2) NOT NULL,
  "discountAmount" DECIMAL(10,2) NOT NULL,
  "finalAmount" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");
CREATE INDEX IF NOT EXISTS "CouponRedemption_merchantId_idx" ON "CouponRedemption"("merchantId");
CREATE INDEX IF NOT EXISTS "CouponRedemption_billingId_idx" ON "CouponRedemption"("billingId");

DO $$ BEGIN
  ALTER TABLE "CouponRedemption"
    ADD CONSTRAINT "CouponRedemption_couponId_fkey"
    FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CouponRedemption"
    ADD CONSTRAINT "CouponRedemption_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
