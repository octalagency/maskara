-- Dial schedule: window, daily/lifetime/first-hour limits
ALTER TABLE "Merchant" ALTER COLUMN "maxCallRetries" SET DEFAULT 20;

ALTER TABLE "Merchant" ADD COLUMN IF NOT EXISTS "callWindowStartMin" INTEGER NOT NULL DEFAULT 580;
ALTER TABLE "Merchant" ADD COLUMN IF NOT EXISTS "callWindowEndMin" INTEGER NOT NULL DEFAULT 1320;
ALTER TABLE "Merchant" ADD COLUMN IF NOT EXISTS "dailyCallLimit" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Merchant" ADD COLUMN IF NOT EXISTS "lifetimeCallLimit" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "Merchant" ADD COLUMN IF NOT EXISTS "firstHourCallLimit" INTEGER NOT NULL DEFAULT 3;

UPDATE "Merchant"
SET
  "maxCallRetries" = 20,
  "lifetimeCallLimit" = 20,
  "dailyCallLimit" = COALESCE("dailyCallLimit", 10),
  "callWindowStartMin" = COALESCE("callWindowStartMin", 580),
  "callWindowEndMin" = COALESCE("callWindowEndMin", 1320),
  "firstHourCallLimit" = COALESCE("firstHourCallLimit", 3);
