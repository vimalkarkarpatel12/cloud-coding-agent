-- Add sandbox and OpenHands session fields to Chat
ALTER TABLE "Chat"
  ADD COLUMN IF NOT EXISTS "sandboxId" text;

ALTER TABLE "Chat"
  ADD COLUMN IF NOT EXISTS "openhandsSessionId" text;

-- Backfill or future updates can populate these fields from AgentSession if desired
