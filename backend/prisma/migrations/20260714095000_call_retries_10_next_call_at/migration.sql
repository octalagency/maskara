-- 10 attempts/day: ASAP + 2min + 8 staggered; call window 08:00–22:00 Asia/Dhaka
ALTER TABLE "Merchant" ALTER COLUMN "maxCallRetries" SET DEFAULT 10;

UPDATE "Merchant"
SET "maxCallRetries" = 10
WHERE "maxCallRetries" = 9;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "nextCallAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Order_nextCallAt_idx" ON "Order"("nextCallAt");
