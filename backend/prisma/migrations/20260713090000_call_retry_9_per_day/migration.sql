-- First call ASAP; max 9 attempts/day spread across call window
ALTER TABLE "Merchant" ALTER COLUMN "maxCallRetries" SET DEFAULT 9;
ALTER TABLE "Merchant" ALTER COLUMN "retryIntervalMin" SET DEFAULT 90;
UPDATE "Merchant" SET "maxCallRetries" = 9, "retryIntervalMin" = 90;
