-- Agent session management (Phase 1)
CREATE TABLE IF NOT EXISTS "agent_sessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "task_description" TEXT,
  "status" TEXT DEFAULT 'idle',
  "sandbox_id" TEXT,
  "openhands_session_id" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

-- Agent tool calls and observations
CREATE TABLE IF NOT EXISTS "agent_actions" (
  "id" BIGSERIAL PRIMARY KEY,
  "session_id" UUID NOT NULL REFERENCES "agent_sessions"("id") ON DELETE CASCADE,
  "action_type" TEXT,
  "action_data" JSONB,
  "created_at" TIMESTAMP DEFAULT NOW()
);

-- Encrypted user secrets (LLM API keys, GitHub tokens)
CREATE TABLE IF NOT EXISTS "user_secrets" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "secret_name" TEXT NOT NULL,
  "encrypted_value" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW(),
  UNIQUE("user_id", "secret_name")
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user ON "agent_sessions"("user_id");
CREATE INDEX IF NOT EXISTS idx_agent_actions_session ON "agent_actions"("session_id");
