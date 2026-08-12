# Agentic Coding Platform — Development Agent Prompt

> **📋 For current project status, phase progress, and completed deliverables, see [`AGENTS.md`](./AGENTS.md)**

## Your Mission

You are responsible for building an **agentic coding platform** — a self-hosted, open-source system that lets users run autonomous coding agents on their personal servers or PCs. The agent receives code requests via chat interface, executes tasks in a sandboxed Docker environment, and opens PRs with its changes.

**This is a phased, iterative project.** You will start with the Vercel AI Chatbot template, progressively enhance it, and eventually connect it to OpenHands SDK for true agentic code execution. You wont commit things yourself and will stop after implementing parts of the project, waiting for user feedback and instructions to move to the next part. Create and maintain an AGENTS.md file and modify this INSTRUCTIONS.md file as you go along so that multiple chat sessions can gather the latest context of the repo easily.

---

## Starting Point: Migrate Vercel Template from Neon to Self-Hosted Supabase

### Current State (Phase 0 - IN PROGRESS ✅ MOSTLY COMPLETE)
The Vercel AI Chatbot template uses:
- **Database:** Neon (Vercel Postgres)
- **Auth:** NextAuth.js with GitHub OAuth ✅ (Added in Phase 0)
- **Frontend:** Next.js App Router + shadcn/ui
- **Storage:** Vercel Blob
- **Framework:** Vercel AI SDK (will be replaced later)

### Phase 0 Complete Checklist (Remaining: Test & Verify)

**✅ Completed:**
- Docker Compose setup with PostgreSQL 16, Redis 7, Prometheus, Grafana
- Dockerfile for Next.js container
- Updated auth configuration with GitHub OAuth provider
- Database schema extended with OpenHands integration tables
- Drizzle migrations for agent tables (AgentSession, AgentAction, UserSecret, GitHubApp, ExecutionMetric)
- Environment configuration (.env.example, .env.local) updated for self-hosted setup
- AGENTS.md created for phase tracking across sessions

**🔲 Remaining:**
- Test locally: `docker-compose up` and verify all services start
- Run migrations and verify database schema is created
- Test GitHub OAuth login (requires GitHub App credentials)
- End-to-end testing: login → chat → verify persistence

### Your First Task (Phase 0 - Final Testing)

2. **Swap Neon for locally running Supabase:**
   - Set up Supabase in Docker Compose (postgres + auth services)
   - Update `.env` to point to local Supabase instance
   - Migrate the database schema from `migrations/` folder
   - Update auth configuration to use local Supabase Auth with GitHub OAuth
   - Remove Vercel Blob dependency; use local file system or Supabase Storage

3. **Create initial Docker Compose setup:**
   ```yaml
   version: '3.9'
   services:
     postgres:
       image: postgres:16
       environment:
         POSTGRES_PASSWORD: postgres
         POSTGRES_DB: app
       volumes:
         - postgres_data:/var/lib/postgresql/data
     
     supabase-auth:
       image: ghcr.io/supabase/auth:latest
       environment:
         DB_DRIVER: postgres
         POSTGRES_URL: postgresql://postgres:postgres@postgres:5432/app
     
     supabase-storage:
       image: ghcr.io/supabase/storage-api:latest
       environment:
         POSTGRES_URL: postgresql://postgres:postgres@postgres:5432/app
     
     nextjs:
       build: .
       ports:
         - "3000:3000"
       environment:
         DATABASE_URL: postgresql://postgres:postgres@postgres:5432/app
         SUPABASE_URL: http://localhost:8000
         SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
       depends_on:
         - postgres
   
   volumes:
     postgres_data:
   ```

4. **Update database schema** to add fields for OpenHands integration (you'll populate these in Phase 1):
   ```sql
   -- Add to schema.sql
   ALTER TABLE "chat" ADD COLUMN sandbox_id TEXT;
   ALTER TABLE "chat" ADD COLUMN openhands_session_id TEXT;
   
   CREATE TABLE IF NOT EXISTS "agent_sessions" (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES auth.users,
     task_description TEXT,
     status TEXT DEFAULT 'idle', -- 'idle', 'running', 'paused', 'complete', 'failed'
     sandbox_id TEXT,
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );
   
   CREATE TABLE IF NOT EXISTS "agent_actions" (
     id BIGSERIAL PRIMARY KEY,
     session_id UUID NOT NULL REFERENCES agent_sessions,
     action_type TEXT, -- 'tool_call', 'observation', 'user_message', 'agent_message'
     action_data JSONB,
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   CREATE TABLE IF NOT EXISTS "user_secrets" (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES auth.users,
     secret_name TEXT NOT NULL,
     encrypted_value TEXT NOT NULL,
     created_at TIMESTAMP DEFAULT NOW(),
     UNIQUE(user_id, secret_name)
   );
   ```

5. **Test locally:**
   - `docker-compose up` should start everything
   - Verify Next.js connects to Supabase
   - GitHub OAuth login works
   - Chat history persists to local Postgres

**Deliverable:** A working chatbot running entirely on self-hosted containers, no Vercel/Neon dependencies.

---

## Phase 1 — Multi-Tenant MVP with OpenHands Integration (2–4 weeks)

### Goals
- Connect to OpenHands Agent Server (runs in a separate Docker container)
- Replace Vercel AI SDK's `streamText()` with a WebSocket handler that streams OpenHands events
- Users can ask the agent to code; agent spins up a sandbox, executes, streams changes back to chat
- Basic chat UI shows tool calls inline
- GitHub App integration so agent can open PRs

### Key Changes

#### 1. Add GitHub App Integration
- Replace simple GitHub OAuth with GitHub App + installation tokens
- Allows the agent to:
  - Clone user repos
  - Open PRs with agent-written code
  - Commit on behalf of the agent
  - Request reviews

**Needed in schema:**
```sql
CREATE TABLE IF NOT EXISTS "github_apps" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users,
  installation_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. Update Backend to Handle OpenHands Events
Replace `app/api/chat/route.ts` (which uses Vercel AI SDK's `streamText()`) with a new OpenHands handler:

**Remove:**
- Vercel AI SDK `streamText()` call
- Direct LLM provider calls

**Add:**
```typescript
// app/api/agent/session.ts
import { WebSocket } from 'ws';

export async function POST(req: Request) {
  const { message, sessionId, userSecret } = await req.json();
  
  // Fetch encrypted LLM key from DB
  const secret = await db.query(
    'SELECT encrypted_value FROM user_secrets WHERE user_id = $1 AND secret_name = $2',
    [userId, 'ANTHROPIC_API_KEY']
  );
  
  const decryptedKey = decrypt(secret.encrypted_value);
  
  // Call OpenHands REST API
  const response = await fetch('http://openhands:3001/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task: message,
      llm_api_key: decryptedKey,
      model: 'claude-opus-4.6', // or user preference
      workspace: 'docker', // DockerWorkspace
    })
  });
  
  const sessionData = await response.json();
  
  // Save session to DB
  await db.query(
    'INSERT INTO agent_sessions (user_id, openhands_session_id, task_description, status) VALUES ($1, $2, $3, $4)',
    [userId, sessionData.session_id, message, 'running']
  );
  
  // Stream events back to client via SSE or WebSocket
  return streamOpenHandsEvents(sessionData.session_id);
}
```

#### 3. Update Frontend Chat UI
Keep the shadcn/ui chat components, but replace the message stream handler:

**Remove:**
- `useChat()` hook from Vercel AI SDK
- Direct streaming response parsing

**Add:**
```typescript
// components/chat-interface.tsx
'use client';

import { useEffect, useState } from 'react';

export function ChatInterface({ sessionId }: { sessionId: string }) {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  async function handleSendMessage(message: string) {
    setIsLoading(true);
    
    const response = await fetch('/api/agent/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId })
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const text = decoder.decode(value);
      const lines = text.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const event = JSON.parse(line.slice(6));
          
          // Render different event types
          if (event.type === 'tool_call') {
            setEvents(prev => [...prev, {
              type: 'tool_call',
              tool: event.tool,
              input: event.input,
              timestamp: new Date()
            }]);
          } else if (event.type === 'observation') {
            setEvents(prev => [...prev, {
              type: 'observation',
              result: event.result,
              timestamp: new Date()
            }]);
          } else if (event.type === 'file_change') {
            setEvents(prev => [...prev, {
              type: 'file_change',
              path: event.path,
              diff: event.diff,
              timestamp: new Date()
            }]);
          }
        }
      }
    }
    
    setIsLoading(false);
  }
  
  return (
    <div className="flex flex-col h-screen">
      {/* Chat messages + event visualization */}
      <div className="flex-1 overflow-y-auto">
        {events.map((event, i) => (
          <div key={i} className="p-4 border-b">
            {event.type === 'tool_call' && (
              <div className="bg-blue-50 p-3 rounded">
                <p className="font-mono text-sm">
                  🔧 Calling: <strong>{event.tool}</strong>
                </p>
                <pre className="text-xs mt-2 bg-blue-100 p-2 rounded overflow-x-auto">
                  {JSON.stringify(event.input, null, 2)}
                </pre>
              </div>
            )}
            {event.type === 'observation' && (
              <div className="bg-green-50 p-3 rounded">
                <p className="font-mono text-sm">📊 Result:</p>
                <pre className="text-xs mt-2 bg-green-100 p-2 rounded overflow-x-auto">
                  {event.result}
                </pre>
              </div>
            )}
            {event.type === 'file_change' && (
              <div className="bg-yellow-50 p-3 rounded">
                <p className="font-mono text-sm">📝 {event.path}</p>
                <pre className="text-xs mt-2 bg-yellow-100 p-2 rounded overflow-x-auto">
                  {event.diff}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Input */}
      <div className="p-4 border-t">
        <input
          type="text"
          placeholder="Describe the code change you want..."
          onKeyDown={async (e) => {
            if (e.key === 'Enter' && e.currentTarget.value) {
              await handleSendMessage(e.currentTarget.value);
              e.currentTarget.value = '';
            }
          }}
          className="w-full p-2 border rounded"
        />
      </div>
    </div>
  );
}
```

#### 4. Add Redis + BullMQ for Sandbox Concurrency
```typescript
// lib/queue.ts
import Bull from 'bull';

export const sandboxQueue = new Bull('sandbox-jobs', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
});

sandboxQueue.process(async (job) => {
  const { sessionId, message, userId } = job.data;
  
  // Call OpenHands, stream events, save to DB
  // Update job progress as events come in
});

sandboxQueue.on('progress', (job, progress) => {
  // Notify frontend via WebSocket
});
```

Update `docker-compose.yml`:
```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  openhands:
    image: ghcr.io/all-hands-ai/openhands-server:latest
    ports:
      - "3001:3000"
    environment:
      OPENHANDS_LLM_API_KEY: ${ANTHROPIC_API_KEY}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - openhands_data:/tmp/openhands
    depends_on:
      - postgres
```

#### 5. Encrypt User LLM Keys at Rest
```typescript
// lib/secrets.ts
import * as age from 'age-encryption';

const MASTER_KEY = process.env.SECRETS_ENCRYPTION_KEY; // Store in .env, never in code

export async function encryptSecret(plaintext: string): Promise<string> {
  return age.encrypt([MASTER_KEY], plaintext);
}

export async function decryptSecret(ciphertext: string): Promise<string> {
  return age.decrypt([MASTER_KEY], ciphertext);
}

// Usage in settings page
export async function saveUserSecret(userId: string, name: string, value: string) {
  const encrypted = await encryptSecret(value);
  await db.query(
    'INSERT INTO user_secrets (user_id, secret_name, encrypted_value) VALUES ($1, $2, $3) ON CONFLICT (user_id, secret_name) DO UPDATE SET encrypted_value = $3',
    [userId, name, encrypted]
  );
}
```

#### 6. Basic Settings Page
Allow users to input their LLM API key:

```typescript
// app/settings/page.tsx
'use client';

export function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  
  async function handleSave() {
    await fetch('/api/secrets', {
      method: 'POST',
      body: JSON.stringify({
        secretName: 'ANTHROPIC_API_KEY',
        value: apiKey
      })
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }
  
  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Anthropic API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full p-2 border rounded"
          />
          <p className="text-xs text-gray-500 mt-1">
            Your key is encrypted before storing and never shared.
          </p>
        </div>
        
        <button
          onClick={handleSave}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
        >
          Save Settings
        </button>
        
        {saved && <p className="text-green-600 text-sm">✓ Settings saved</p>}
      </div>
    </div>
  );
}
```

### Phase 1 Deliverables
- ✅ Docker Compose includes Postgres, Redis, OpenHands, Next.js
- ✅ Users log in with GitHub OAuth (basic, not yet App)
- ✅ Users input LLM API key (encrypted storage)
- ✅ Chat interface receives user message
- ✅ Message sent to OpenHands agent
- ✅ OpenHands events streamed back to chat
- ✅ Tool calls + observations displayed inline
- ✅ File changes shown as diffs in chat
- ✅ One user, one session, basic flow works end-to-end

---

## Phase 2 — Reliability, Queueing, and Session Persistence (2–3 weeks)

### Goals
- Multiple concurrent users without sandbox contention
- Session resume: close app, reconnect to in-progress agent task
- Aggressive sandbox cleanup (timeouts, resource limits)
- Better error handling and user feedback

### Key Changes

#### 1. BullMQ Worker Pool
```typescript
// lib/workers/sandbox-worker.ts
import { Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379')
});

export const sandboxWorker = new Worker(
  'sandbox-jobs',
  async (job) => {
    console.log(`Processing job ${job.id}`);
    
    const { sessionId, message, userId, llmModel } = job.data;
    
    // Fetch user's encrypted LLM key
    const secretRow = await db.query(
      'SELECT encrypted_value FROM user_secrets WHERE user_id = $1 AND secret_name = $2',
      [userId, 'ANTHROPIC_API_KEY']
    );
    
    const llmKey = await decryptSecret(secretRow.rows[0].encrypted_value);
    
    // Call OpenHands
    const opResponse = await fetch('http://openhands:3001/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: message,
        llm_api_key: llmKey,
        model: llmModel || 'claude-opus-4.6',
        workspace: 'docker'
      })
    });
    
    const { session_id: opSessionId } = await opResponse.json();
    
    // Update DB with OpenHands session ID
    await db.query(
      'UPDATE agent_sessions SET openhands_session_id = $1, status = $2 WHERE id = $3',
      [opSessionId, 'running', sessionId]
    );
    
    // Stream events
    const eventSource = new EventSource(`http://openhands:3001/api/sessions/${opSessionId}/events`);
    
    eventSource.onmessage = async (event) => {
      const parsedEvent = JSON.parse(event.data);
      
      // Save each event to DB
      await db.query(
        'INSERT INTO agent_actions (session_id, action_type, action_data) VALUES ($1, $2, $3)',
        [sessionId, parsedEvent.type, JSON.stringify(parsedEvent)]
      );
      
      // Notify connected clients via WebSocket
      notifyClient(sessionId, parsedEvent);
      
      // Update job progress
      job.updateProgress({
        eventCount: (job.progress() as any).eventCount + 1,
        lastEvent: parsedEvent.type
      });
    };
    
    eventSource.onerror = () => {
      eventSource.close();
      return { success: true, finalStatus: 'complete' };
    };
  },
  { connection }
);

sandboxWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

sandboxWorker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
  // Update DB: session status = 'failed'
});
```

#### 2. Session Resume Capability
```typescript
// app/api/agent/session/[sessionId]/route.ts
export async function GET(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  // Fetch existing session from DB
  const session = await db.query(
    'SELECT * FROM agent_sessions WHERE id = $1',
    [params.sessionId]
  );
  
  if (!session.rows.length) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404
    });
  }
  
  const sessionData = session.rows[0];
  
  // Return current state + history
  const actions = await db.query(
    'SELECT * FROM agent_actions WHERE session_id = $1 ORDER BY created_at',
    [params.sessionId]
  );
  
  return new Response(JSON.stringify({
    sessionId: sessionData.id,
    status: sessionData.status,
    taskDescription: sessionData.task_description,
    actions: actions.rows,
    createdAt: sessionData.created_at,
    updatedAt: sessionData.updated_at
  }));
}
```

Update frontend to reconnect to existing sessions:
```typescript
// components/session-list.tsx
'use client';

export function SessionList() {
  const [sessions, setSessions] = useState([]);
  
  useEffect(() => {
    fetch('/api/agent/sessions')
      .then(r => r.json())
      .then(data => setSessions(data))
      .catch(console.error);
  }, []);
  
  return (
    <div>
      <h2>Your Sessions</h2>
      {sessions.map(session => (
        <Link
          key={session.id}
          href={`/chat/${session.id}`}
          className="block p-4 border rounded hover:bg-gray-50"
        >
          <p className="font-medium">{session.taskDescription}</p>
          <p className="text-sm text-gray-500">
            {session.status} • {new Date(session.createdAt).toLocaleDateString()}
          </p>
        </Link>
      ))}
    </div>
  );
}
```

#### 3. Sandbox Cleanup & Timeouts
```typescript
// lib/sandbox-cleanup.ts
export async function cleanupSandbox(sessionId: string) {
  const session = await db.query(
    'SELECT openhands_session_id FROM agent_sessions WHERE id = $1',
    [sessionId]
  );
  
  if (!session.rows[0]?.openhands_session_id) return;
  
  // Call OpenHands API to delete sandbox
  await fetch(
    `http://openhands:3001/api/sessions/${session.rows[0].openhands_session_id}`,
    { method: 'DELETE' }
  );
  
  // Update DB
  await db.query(
    'UPDATE agent_sessions SET status = $1 WHERE id = $2',
    ['cleaned_up', sessionId]
  );
}

// Run every hour as a cron job (use a library like node-cron)
import cron from 'node-cron';

cron.schedule('0 * * * *', async () => {
  // Find sessions older than 24 hours
  const oldSessions = await db.query(
    `SELECT id FROM agent_sessions 
     WHERE status = 'complete' 
     AND created_at < NOW() - INTERVAL '24 hours'`
  );
  
  for (const session of oldSessions.rows) {
    await cleanupSandbox(session.id);
  }
});
```

#### 4. Add Timeouts to Agent Execution
In the BullMQ worker, add a timeout:

```typescript
const JOB_TIMEOUT = 30 * 60 * 1000; // 30 minutes

sandboxWorker.process(
  async (job) => {
    // ... existing logic ...
  },
  {
    concurrency: 5, // Max 5 concurrent sandboxes
    timeout: JOB_TIMEOUT
  }
);
```

### Phase 2 Deliverables
- ✅ Multiple users can run agents concurrently (BullMQ queue)
- ✅ Sessions persist in DB; users can resume later
- ✅ Aggressive cleanup: sandboxes deleted after completion or timeout
- ✅ Better error messages when sandbox fails
- ✅ Metrics: track concurrent sessions, avg execution time, success rate

---

## Phase 3 — Code Visualization and Approval Workflow (1–2 weeks)

### Goals
- Dedicated diff viewer (side-by-side or unified)
- Approval workflow: pause before risky operations
- Better PR templates with agent reasoning
- Visual feedback on what's changing

### Key Changes

#### 1. Add shadcn/ui Diff Viewer Block
```typescript
// components/code-diff-viewer.tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

interface DiffViewerProps {
  changes: Array<{
    path: string;
    before: string;
    after: string;
    status: 'added' | 'modified' | 'deleted';
  }>;
  onApprove: () => void;
  onReject: () => void;
  isLoading?: boolean;
}

export function CodeDiffViewer({
  changes,
  onApprove,
  onReject,
  isLoading
}: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');
  
  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Code Changes</h3>
        <div className="flex gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <TabsList>
              <TabsTrigger value="unified">Unified</TabsTrigger>
              <TabsTrigger value="split">Split</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      
      <Tabs defaultValue={changes[0]?.path} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          {changes.map((change) => (
            <TabsTrigger key={change.path} value={change.path} className="text-xs">
              <span className="mr-2">
                {change.status === 'added' && '➕'}
                {change.status === 'modified' && '✏️'}
                {change.status === 'deleted' && '🗑️'}
              </span>
              {change.path}
            </TabsTrigger>
          ))}
        </TabsList>
        
        {changes.map((change) => (
          <TabsContent key={change.path} value={change.path} className="mt-4">
            <div className="bg-gray-50 rounded p-4 font-mono text-sm overflow-x-auto">
              {viewMode === 'unified' ? (
                <UnifiedDiffView before={change.before} after={change.after} />
              ) : (
                <SplitDiffView before={change.before} after={change.after} />
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
      
      <div className="flex gap-2 mt-6 pt-4 border-t">
        <Button
          onClick={onApprove}
          disabled={isLoading}
          className="flex-1 bg-green-600 hover:bg-green-700"
        >
          ✓ Approve & Commit
        </Button>
        <Button
          onClick={onReject}
          disabled={isLoading}
          variant="outline"
          className="flex-1"
        >
          ✗ Reject Changes
        </Button>
      </div>
    </div>
  );
}

function UnifiedDiffView({ before, after }: { before: string; after: string }) {
  const diffLines = generateDiff(before, after);
  
  return (
    <div>
      {diffLines.map((line, i) => (
        <div
          key={i}
          className={`py-1 px-2 ${
            line.type === 'add'
              ? 'bg-green-100 text-green-900'
              : line.type === 'remove'
              ? 'bg-red-100 text-red-900'
              : 'bg-white'
          }`}
        >
          <span className="mr-2 w-4 inline-block">
            {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
          </span>
          {line.content}
        </div>
      ))}
    </div>
  );
}

function SplitDiffView({ before, after }: { before: string; after: string }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">Before</p>
        <pre className="bg-red-50 p-2 rounded text-red-900">{before}</pre>
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">After</p>
        <pre className="bg-green-50 p-2 rounded text-green-900">{after}</pre>
      </div>
    </div>
  );
}
```

#### 2. Add Approval Workflow
```typescript
// app/api/agent/session/[sessionId]/approve/route.ts
export async function POST(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  const { approved } = await req.json();
  
  if (approved) {
    // Fetch all file changes from agent_actions
    const actions = await db.query(
      `SELECT action_data FROM agent_actions 
       WHERE session_id = $1 AND action_type = 'file_change'
       ORDER BY created_at`,
      [params.sessionId]
    );
    
    const changes = actions.rows.map(r => r.action_data);
    
    // Call OpenHands API to commit and push
    await fetch(`http://openhands:3001/api/sessions/${sessionId}/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Automated changes by agent`,
        files: changes
      })
    });
    
    // If GitHub App is connected, open PR
    const githubApp = await db.query(
      'SELECT installation_id FROM github_apps WHERE user_id = $1',
      [userId]
    );
    
    if (githubApp.rows.length) {
      // Open PR via GitHub API
      await openPullRequest(userId, changes);
    }
    
    // Update session status
    await db.query(
      'UPDATE agent_sessions SET status = $1 WHERE id = $2',
      ['approved', params.sessionId]
    );
    
    return new Response(JSON.stringify({ success: true }));
  } else {
    // Reject: cleanup sandbox
    await cleanupSandbox(params.sessionId);
    await db.query(
      'UPDATE agent_sessions SET status = $1 WHERE id = $2',
      ['rejected', params.sessionId]
    );
    
    return new Response(JSON.stringify({ success: true }));
  }
}
```

#### 3. Enhanced PR Template
```typescript
// lib/github-pr.ts
export async function openPullRequest(
  userId: string,
  changes: FileChange[],
  agentReasoning?: string
) {
  const githubApp = await getGitHubApp(userId);
  
  const prBody = `
## Automated Code Changes

**AI Agent:** OpenHands

${agentReasoning ? `### Reasoning\n${agentReasoning}` : ''}

### Files Changed
${changes.map(c => `- ${c.path} (${c.status})`).join('\n')}

### Summary
This PR was automatically generated by an AI agent. Please review carefully before merging.

---
*Generated at ${new Date().toISOString()}*
  `;
  
  return githubApp.createPullRequest({
    title: `[Agent] ${changes.length} file(s) modified`,
    body: prBody,
    head: 'agent-changes',
    base: 'main'
  });
}
```

### Phase 3 Deliverables
- ✅ Dedicated diff viewer (unified + split view)
- ✅ File tabs showing all changes
- ✅ Approve/Reject buttons pause execution
- ✅ Approved changes committed to git
- ✅ PR opened with agent reasoning in description

---

## Phase 4 — Observability & Telemetry (Last part of V1, 1 week)

### Goals
- Track agent execution costs and performance
- Metrics dashboard with Prometheus + Grafana
- Understand what works and what doesn't
- Usage analytics per user

### Key Metrics to Track

1. **Token Usage**
   - Tokens sent to LLM
   - Tokens received from LLM
   - Cost per task (LLM cost, not compute)

2. **Sandbox Execution**
   - Execution time per tool call
   - Number of tool calls per task
   - Success/failure rate

3. **Agent Quality**
   - Tasks completed successfully
   - Tasks failed / timeout
   - Avg execution time
   - Human approval rate (for Phase 3+)

4. **Resource Usage**
   - Concurrent sandboxes
   - CPU/memory per sandbox
   - Disk space used

5. **Model Performance**
   - Which LLM was used
   - Token efficiency (output/input ratio)
   - Task type breakdown

### Implementation

#### 1. Add Prometheus Instrumentation
```typescript
// lib/metrics.ts
import { register, Counter, Histogram, Gauge } from 'prom-client';

export const tokenCounter = new Counter({
  name: 'agent_tokens_total',
  help: 'Total tokens used',
  labelNames: ['model', 'type'] // type: 'input' or 'output'
});

export const executionTimeHistogram = new Histogram({
  name: 'agent_execution_seconds',
  help: 'Agent task execution time',
  labelNames: ['status', 'model'], // status: 'success' or 'failure'
  buckets: [10, 30, 60, 120, 300, 600]
});

export const toolCallCounter = new Counter({
  name: 'agent_tool_calls_total',
  help: 'Tool calls made by agent',
  labelNames: ['tool_name', 'success']
});

export const concurrentSandboxesGauge = new Gauge({
  name: 'agent_concurrent_sandboxes',
  help: 'Number of currently running sandboxes'
});

export const agentQualityCounter = new Counter({
  name: 'agent_tasks_total',
  help: 'Tasks completed by agent',
  labelNames: ['status', 'model'] // status: 'success', 'failed', 'timeout', 'rejected'
});
```

#### 2. Instrument Agent Execution
```typescript
// lib/workers/sandbox-worker.ts (update existing worker)

const startTime = Date.now();
const model = job.data.llmModel || 'claude-opus-4.6';

let tokenCount = { input: 0, output: 0 };
let toolCount = 0;
let taskStatus = 'success';

try {
  const eventSource = new EventSource(`http://openhands:3001/api/sessions/${opSessionId}/events`);
  
  eventSource.onmessage = async (event) => {
    const parsedEvent = JSON.parse(event.data);
    
    // Count tokens if provided by OpenHands
    if (parsedEvent.type === 'llm_response') {
      tokenCount.input += parsedEvent.input_tokens || 0;
      tokenCount.output += parsedEvent.output_tokens || 0;
      
      tokenCounter.inc({
        model,
        type: 'input'
      }, tokenCount.input);
      
      tokenCounter.inc({
        model,
        type: 'output'
      }, tokenCount.output);
    }
    
    // Count tool calls
    if (parsedEvent.type === 'tool_call') {
      toolCount++;
      toolCallCounter.inc({
        tool_name: parsedEvent.tool,
        success: parsedEvent.success ? 'true' : 'false'
      });
    }
    
    // Update concurrent sandboxes
    const runningCount = await db.query(
      `SELECT COUNT(*) FROM agent_sessions WHERE status = 'running'`
    );
    concurrentSandboxesGauge.set(parseInt(runningCount.rows[0].count));
  };
} catch (error) {
  taskStatus = 'failed';
} finally {
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  
  executionTimeHistogram.observe({
    status: taskStatus,
    model
  }, duration);
  
  agentQualityCounter.inc({
    status: taskStatus,
    model
  });
  
  // Save metrics to DB for historical analysis
  await db.query(
    `INSERT INTO execution_metrics 
     (session_id, model, duration_seconds, input_tokens, output_tokens, tool_calls, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [sessionId, model, duration, tokenCount.input, tokenCount.output, toolCount, taskStatus]
  );
}
```

#### 3. Add Metrics Endpoint
```typescript
// app/api/metrics/route.ts
import { register } from 'prom-client';

export async function GET() {
  return new Response(register.metrics(), {
    headers: { 'Content-Type': register.contentType }
  });
}
```

#### 4. Update Docker Compose with Prometheus + Grafana
```yaml
version: '3.9'
services:
  # ... existing services ...
  
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
  
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    depends_on:
      - prometheus

volumes:
  prometheus_data:
  grafana_data:
```

Create `prometheus.yml`:
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'agent-platform'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'
```

#### 5. Grafana Dashboard
Create dashboards to visualize:
- Tokens used over time (by model)
- Execution time distribution
- Task success rate
- Concurrent sandboxes
- Cost estimate (if you have LLM pricing data)
- Top tools used
- Failure reasons

Create `grafana/provisioning/dashboards/agent-platform.json`:
```json
{
  "dashboard": {
    "title": "Agent Platform Metrics",
    "panels": [
      {
        "title": "Token Usage (24h)",
        "targets": [
          { "expr": "increase(agent_tokens_total[24h])" }
        ]
      },
      {
        "title": "Task Success Rate",
        "targets": [
          { "expr": "rate(agent_tasks_total{status='success'}[1h]) / rate(agent_tasks_total[1h])" }
        ]
      },
      {
        "title": "Avg Execution Time",
        "targets": [
          { "expr": "histogram_quantile(0.5, agent_execution_seconds)" }
        ]
      },
      {
        "title": "Concurrent Sandboxes",
        "targets": [
          { "expr": "agent_concurrent_sandboxes" }
        ]
      },
      {
        "title": "Tool Calls by Type",
        "targets": [
          { "expr": "sum by (tool_name) (rate(agent_tool_calls_total[1h]))" }
        ]
      }
    ]
  }
}
```

#### 6. Database Schema for Metrics
```sql
CREATE TABLE IF NOT EXISTS "execution_metrics" (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES agent_sessions,
  model TEXT NOT NULL,
  duration_seconds INT NOT NULL,
  input_tokens INT,
  output_tokens INT,
  tool_calls INT,
  status TEXT, -- 'success', 'failed', 'timeout', etc.
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_execution_metrics_session ON execution_metrics(session_id);
CREATE INDEX idx_execution_metrics_created ON execution_metrics(created_at);
```

### Phase 4 Deliverables
- ✅ Prometheus collects metrics from agent platform
- ✅ Grafana dashboard shows:
  - Tokens used (by model, cumulative cost)
  - Task execution time distribution
  - Success/failure breakdown
  - Concurrent sandbox count
  - Tool call frequency
  - LLM model usage
- ✅ Historical data stored in Postgres
- ✅ Accessible at `http://localhost:3001` (Grafana)

---

## Post-V1 Features (Backlog)

These are important but not blocking for launch:

1. **Snapshot/Resume for Sandboxes** — persist sandbox state across sessions
2. **Sandbox Resource Caps** — CPU/memory limits, network egress policy
3. **Approval Workflow** — pause before risky operations (git push, rm -rf)
4. **Code Diff Viewer** — side-by-side diffs (Phase 3, but can defer)
5. **Pluggable Sandbox Backends** — support E2B, Fly.io in addition to Docker
6. **Streaming LLM Input** — show agent thinking in real-time
7. **Multi-LLM Support** — switch between Claude, GPT, local Llama during task
8. **Batch Tasks** — queue multiple agent tasks, run overnight
9. **Rate Limiting** — prevent abuse of token/compute quota
10. **Team/Organization Support** — multi-user with shared repos

---

## Development Guidelines

### Code Style
- TypeScript for all frontend + backend
- Functional components in React
- Server Actions for mutations
- async/await over promises
- shadcn/ui for components

### Testing
- Unit tests for critical paths (encryption, metrics)
- Integration tests for OpenHands → DB → Frontend flow
- Manual testing on mobile before each phase

### Git Workflow
1. Create feature branch per phase: `phase-1`, `phase-2`, etc.
2. Commit frequently with clear messages
3. Include migration files in `migrations/` folder
4. Document schema changes in README

### Deployment Assumptions
- User runs `docker-compose up` on their own hardware
- All services communicate via Docker network
- Environment variables in `.env` (never committed)
- Supabase runs locally; users do NOT use Supabase Cloud

### Security Checklist
- [ ] Encrypt LLM keys at rest (use `age` library)
- [ ] Never log API keys or secrets
- [ ] Validate all user input before passing to OpenHands
- [ ] Use HTTPS in production (user's responsibility)
- [ ] Docker sandbox runs with `cap_drop: ALL`
- [ ] Secrets stored per-user, not globally

---

## Success Criteria

### Phase 1 Complete When:
- [ ] User can log in via GitHub
- [ ] User can input LLM API key (encrypted)
- [ ] User can send message to agent
- [ ] Agent receives message in OpenHands
- [ ] OpenHands spins up sandbox
- [ ] Tool calls displayed in chat
- [ ] File changes shown as diffs
- [ ] `docker-compose up` works end-to-end

### Phase 2 Complete When:
- [ ] 5+ concurrent users can run agents simultaneously
- [ ] Sessions persist in DB
- [ ] User can close browser, reopen, resume task
- [ ] Sandboxes auto-cleanup after completion
- [ ] Metrics tracked (basic)

### Phase 3 Complete When:
- [ ] Dedicated diff viewer component built
- [ ] Approve/Reject buttons functional
- [ ] GitHub App integration works
- [ ] PR opened with agent changes

### Phase 4 (V1 Final) Complete When:
- [ ] Prometheus scraping metrics
- [ ] Grafana dashboard displays data
- [ ] Token costs tracked per LLM
- [ ] Task success rate visible
- [ ] README has architecture diagram
- [ ] Open-source ready (LICENSE, CONTRIBUTING)

---

## Repository Structure

```
agentic-coding-platform/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── settings/
│   ├── api/
│   │   ├── agent/
│   │   │   ├── session/
│   │   │   ├── sessions/
│   │   │   └── approve/
│   │   ├── secrets/
│   │   └── metrics/
│   ├── chat/
│   │   └── [sessionId]/
│   └── page.tsx
├── components/
│   ├── chat-interface.tsx
│   ├── code-diff-viewer.tsx
│   ├── session-list.tsx
│   └── ui/ (shadcn)
├── lib/
│   ├── db.ts
│   ├── secrets.ts
│   ├── metrics.ts
│   ├── queue.ts
│   ├── github-pr.ts
│   └── workers/
│       └── sandbox-worker.ts
├── migrations/
│   ├── 001-init-schema.sql
│   ├── 002-agent-tables.sql
│   └── 003-metrics.sql
├── docker-compose.yml
├── prometheus.yml
├── Dockerfile
├── .env.example
├── package.json
└── README.md
```

---

## Final Notes

- **Start small.** Phase 1 is MVP; don't over-engineer.
- **Test locally.** Use your own PC as the "user" server during development.
- **Iterate quickly.** Each phase should be 2-4 weeks.
- **Ship incomplete features.** Code diff viewer, approval workflow, multi-LLM — these are nice-to-haves for v2.
- **Monitor users.** Once v1 is live, watch the metrics dashboard to see what users actually need.
- **Stay opinionated.** This is a self-hosted, single-sandbox, Docker-based system. Don't try to support every use case.

Good luck building! 🚀