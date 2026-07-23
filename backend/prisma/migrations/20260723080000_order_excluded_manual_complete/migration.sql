-- Website cancel/trash/delete vs Maskara dashboard visibility
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "excludedFromStats" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "manualComplete" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Order_excludedFromStats_idx" ON "Order"("excludedFromStats");

-- Backfill from metadata flags set by earlier webhook logic
UPDATE "Order"
SET "excludedFromStats" = true
WHERE COALESCE(("metadata"->>'cancelledFromWebsite')::boolean, false) = true
   OR COALESCE(("metadata"->>'deletedFromWebsite')::boolean, false) = true
   OR COALESCE(("metadata"->>'trashedFromWebsite')::boolean, false) = true;

UPDATE "Order"
SET "manualComplete" = true
WHERE COALESCE(("metadata"->>'manualCompleteFromWebsite')::boolean, false) = true;
