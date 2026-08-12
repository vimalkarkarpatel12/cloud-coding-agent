-- Agent Sessions Table
CREATE TABLE IF NOT EXISTS "AgentSession" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "taskDescription" text NOT NULL,
  "status" varchar NOT NULL DEFAULT 'idle',
  "sandboxId" text,
  "openhands_session_id" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

-- Agent Actions Table
CREATE TABLE IF NOT EXISTS "AgentAction" (
  "id" bigserial PRIMARY KEY,
  "sessionId" uuid NOT NULL REFERENCES "AgentSession"("id"),
  "actionType" varchar NOT NULL,
  "actionData" json NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

-- User Secrets Table (for encrypted API keys)
CREATE TABLE IF NOT EXISTS "UserSecret" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "secretName" varchar NOT NULL,
  "encryptedValue" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT unique_user_secret UNIQUE ("userId", "secretName")
);

-- GitHub Apps Table (for PR integration)
CREATE TABLE IF NOT EXISTS "GitHubApp" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "installationId" varchar NOT NULL,
  "appId" varchar NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

-- Execution Metrics Table (for Phase 4 telemetry)
CREATE TABLE IF NOT EXISTS "ExecutionMetric" (
  "id" bigserial PRIMARY KEY,
  "sessionId" uuid NOT NULL REFERENCES "AgentSession"("id"),
  "model" varchar NOT NULL,
  "durationSeconds" int NOT NULL,
  "inputTokens" int,
  "outputTokens" int,
  "toolCalls" int,
  "status" varchar,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_agent_sessions_user" ON "AgentSession"("userId");
CREATE INDEX IF NOT EXISTS "idx_agent_sessions_status" ON "AgentSession"("status");
CREATE INDEX IF NOT EXISTS "idx_agent_actions_session" ON "AgentAction"("sessionId");
CREATE INDEX IF NOT EXISTS "idx_user_secrets_user" ON "UserSecret"("userId");
CREATE INDEX IF NOT EXISTS "idx_github_apps_user" ON "GitHubApp"("userId");
CREATE INDEX IF NOT EXISTS "idx_execution_metrics_session" ON "ExecutionMetric"("sessionId");
CREATE INDEX IF NOT EXISTS "idx_execution_metrics_created" ON "ExecutionMetric"("createdAt");
