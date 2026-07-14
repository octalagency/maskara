-- Force-migrate merchants still on Azure নবনীতা (or null voice) to Chirp3 Algieba.
-- Live ePBX path also remaps at runtime; this keeps Settings UI + DB aligned.
UPDATE "Merchant"
SET "voiceId" = 'google:bn-IN-Chirp3-HD-Algieba'
WHERE "voiceId" IS NULL
   OR "voiceId" ILIKE '%Nabanita%'
   OR "voiceId" = 'azure:bn-BD-NabanitaNeural';
