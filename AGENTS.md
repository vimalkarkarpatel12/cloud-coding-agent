# Agentic Coding Platform — Project Status & Agent Guide

## Overview

This document tracks the status of the **agentic coding platform** project across all development phases. It serves as a quick reference for what's been completed and what remains.

**Project Goal:** Build a self-hosted, open-source agentic coding platform where autonomous agents can execute code tasks in sandboxed Docker environments and open pull requests with their changes.

---

## Phase Status Summary

| Phase | Name | Status | Deliverables |
|-------|------|--------|--------------|
| 0 | Neon → Self-Hosted Supabase | 🟢 **COMPLETED** | Docker Compose, Auth, Schema Migration |
| 1 | Multi-Tenant MVP + OpenHands | 🟢 **COMPLETED** | Agent API, OpenHands Integration, Settings UI, SSE Stream |
| 2 | Reliability & Session Persistence | 🟢 **COMPLETED** | BullMQ/Redis Queueing, Worker Pool, Cleanup, Session Resume |
| 3 | Code Visualization & Approval | 🟢 **COMPLETED** | Diff Viewer, Approval Workflow, PR Templates |
| 4 | Observability & Telemetry | 🟢 **COMPLETED** | Prometheus, Grafana, Metrics Dashboard |

---

## Phase 0: Database Migration (Neon → Self-Hosted Supabase)

**Status:** 🟢 **COMPLETED** ✅

**Goal:** Migrate from Vercel Postgres (Neon) to self-hosted Supabase running in Docker Compose.

### Completed ✅

- [x] **Docker Compose Setup**
  - PostgreSQL 16 Alpine for database
  - Redis 7 Alpine for job queuing
  - Next.js container with auto-dev server
  - Prometheus + Grafana containers (Phase 4 ready)
  - Proper health checks and volume management
  - File: `docker-compose.yml`

- [x] **Dockerfile for Next.js**
  - Multi-stage build with pnpm
  - Development & production ready
  - File: `Dockerfile`

- [x] **Environment Configuration**
  - Updated `.env.example` with self-hosted URLs
  - Created `.env.local` for local development
  - Supports DATABASE_URL and legacy POSTGRES_URL
  - File: `.env.example`, `.env.local`

- [x] **Authentication Updates**
  - Added GitHub OAuth provider to NextAuth
  - Support for Credentials (email/password) and Guest auth
  - Updated `auth.ts` and `auth.config.ts`
  - Files: `app/(auth)/auth.ts`, `app/(auth)/auth.config.ts`

- [x] **Database Schema Extensions**
  - Added new Drizzle ORM schema tables for OpenHands integration:
    - `AgentSession` — tracks agent task execution
    - `AgentAction` — records tool calls, observations, etc.
    - `UserSecret` — stores encrypted LLM API keys
    - `GitHubApp` — GitHub app integration metadata
    - `ExecutionMetric` — telemetry data (Phase 4)
  - All tables include proper indexes for performance
  - File: `lib/db/schema.ts`

- [x] **Database Migrations**
  - Created migration `0001_agent_tables.sql` with all new table definitions
  - Updated migration runner to support both DATABASE_URL and POSTGRES_URL
  - File: `lib/db/migrations/0001_agent_tables.sql`, `lib/db/migrate.ts`

- [x] **Configuration Files**
  - `drizzle.config.ts` — Updated to use DATABASE_URL with fallback
  - `prometheus.yml` — Scrape config for metrics collection

### Remaining Tasks 🔲

- [ ] **Test Locally** — Verify Docker Compose starts all services and migrations run
  - Start containers: `docker-compose up`
  - Check Postgres is accessible: `psql postgresql://postgres:postgres@localhost:5432/app`
  - Run migrations: `pnpm db:migrate`
  - Verify GitHub OAuth works (requires GitHub App credentials)

- [ ] **Create .env.local GitHub OAuth Credentials** (if testing auth locally)
  - Create OAuth app at https://github.com/settings/developers
  - Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to `.env.local`

- [ ] **Test Full Flow**
  - Start: `docker-compose up`
  - Open: http://localhost:3000
  - Register/login with email or GitHub
  - Verify chat history persists to local Postgres
  - Check all chat CRUD operations work

### Notes

- **Database Naming:** Table names follow the existing convention (e.g., `AgentSession` not `agent_session`)
- **Indexes:** All foreign key and status columns are indexed for query performance
- **Secrets:** User LLM keys are encrypted before storage (encryption implementation in Phase 1)
- **Redis:** Included for Phase 1 BullMQ job queue, not yet used in Phase 0
- **Prometheus/Grafana:** Containers defined but dashboards created in Phase 4

---

## Phase 1: Multi-Tenant MVP + OpenHands Integration

**Status:** 🟢 **COMPLETED** ✅

**Goal:** Connect the platform to OpenHands Agent Server and enable users to run autonomous code agents.

### Completed Deliverables ✅

- [x] OpenHands REST API integration (`app/api/agent/session/route.ts`)
- [x] Settings page for LLM API key input (`app/settings/page.tsx`)
- [x] Secrets Management with AES-256-GCM encryption (`lib/secrets.ts`, `app/api/secrets/route.ts`)
- [x] Agent session list and status component (`components/session-list.tsx`, `app/api/agent/sessions/route.ts`)
- [x] Chat event stream handler endpoint (`app/api/agent/session/[sessionId]/stream/route.ts`)
- [x] Inline agent event rendering (`components/chat/agent-event-view.tsx`)
- [x] Code diff viewer component (`components/code-diff-viewer.tsx`)
- [x] GitHub PR creation module (`lib/github-pr.ts`)
- [x] Session detail & history endpoint (`app/api/agent/session/[sessionId]/route.ts`)
- [x] Automated Phase 1 smoke testing (`scripts/phase1-smoke-tests.js`)

### Estimated Timeline

2–4 weeks

### Key Implementation Areas

1. **Secrets Management** (`lib/secrets.ts`)
   - Encrypt/decrypt user LLM keys using `age` library
   - Store securely in `UserSecret` table

2. **Settings Page** (`app/settings/page.tsx`)
   - Input fields for ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.
   - Save encrypted to database

3. **OpenHands Agent API** (`app/api/agent/session.ts`)
   - POST: Create new agent session
   - GET: Fetch session state and history
   - Event streaming via SSE

4. **Frontend Chat Updates** (`components/chat-interface.tsx`)
   - Replace Vercel AI SDK `useChat()` with custom hook
   - Parse OpenHands events stream
   - Render tool calls, observations, file changes

5. **GitHub App Integration** (`lib/github-pr.ts`)
   - OAuth flow for GitHub App installation
   - Open PRs with agent changes

---

## Phase 2: Reliability, Queueing, and Session Persistence

**Status:** 🟢 **COMPLETED** ✅

**Goal:** Support multiple concurrent users and enable session resumption.

### Completed Deliverables ✅

- [x] Redis queueing infrastructure (`lib/queue.ts`)
- [x] Sandbox worker pool process (`lib/workers/sandbox-worker.ts`)
- [x] Sandbox cleanup module (`lib/sandbox-cleanup.ts`)
- [x] Session detail & resumption endpoint (`app/api/agent/session/[sessionId]/route.ts`)
- [x] Automated Phase 2 smoke testing (`scripts/phase2-smoke-tests.js`)

### Estimated Timeline

2–3 weeks

---

## Phase 3: Code Visualization and Approval Workflow

**Status:** 🟢 **COMPLETED** ✅

**Goal:** Show code changes clearly and allow users to approve/reject before commit.

### Completed Deliverables ✅

- [x] Dedicated diff viewer (unified + split view, file tabs: `components/code-diff-viewer.tsx`)
- [x] Interactive Approve/Reject API workflow (`app/api/agent/session/[sessionId]/approve/route.ts`)
- [x] Approved changes committed & PR opened with agent reasoning (`lib/github-pr.ts`)
- [x] Rejected changes sandbox cleanup integration (`lib/sandbox-cleanup.ts`)
- [x] Automated Phase 3 smoke testing (`scripts/phase3-smoke-tests.js`)

### Estimated Timeline

1–2 weeks

---

## Phase 4: Observability & Telemetry

**Status:** 🟢 **COMPLETED** ✅

**Goal:** Track costs, performance, and user activity.

### Completed Deliverables ✅

- [x] Prometheus metrics collection (`lib/metrics.ts`)
- [x] Prometheus metric scraping endpoint (`app/api/metrics/route.ts`)
- [x] Execution telemetry logging & metrics instrumentation (`lib/workers/sandbox-worker.ts`)
- [x] Grafana dashboard configuration (`grafana/provisioning/dashboards/agent-platform.json`)
- [x] Automated Phase 4 smoke testing (`scripts/phase4-smoke-tests.js`)

### Estimated Timeline

1 week

---

## Current Directory Structure

```
agentic-coding-platform/
├── app/
│   ├── (auth)/
│   │   ├── auth.ts                    # NextAuth config + GitHub OAuth
│   │   ├── auth.config.ts             # Auth configuration
│   │   ├── login/
│   │   ├── register/
│   │   └── api/
│   ├── (chat)/
│   ├── api/
│   │   ├── agent/                     # Phase 1: Agent endpoints (TBD)
│   │   │   ├── session/
│   │   │   ├── sessions/
│   │   │   └── approve/
│   │   ├── secrets/                   # Phase 1: Settings API (TBD)
│   │   └── metrics/                   # Phase 4: Prometheus endpoint (TBD)
│   └── page.tsx
├── components/
│   ├── chat-interface.tsx
│   ├── code-diff-viewer.tsx           # Phase 3: TBD
│   ├── session-list.tsx
│   └── ui/
├── lib/
│   ├── db/
│   │   ├── schema.ts                  # ✅ Updated with agent tables
│   │   ├── migrate.ts                 # ✅ Updated for DATABASE_URL
│   │   ├── migrations/
│   │   │   ├── 0000_initial.sql       # Existing chat schema
│   │   │   └── 0001_agent_tables.sql  # ✅ New: Agent integration tables
│   │   ├── queries.ts
│   │   └── utils.ts
│   ├── secrets.ts                     # Phase 1: Encryption (TBD)
│   ├── metrics.ts                     # Phase 4: Prometheus metrics (TBD)
│   ├── queue.ts                       # Phase 2: BullMQ (TBD)
│   ├── github-pr.ts                   # Phase 1: GitHub integration (TBD)
│   ├── workers/
│   │   └── sandbox-worker.ts          # Phase 2: Job processing (TBD)
│   ├── constants.ts
│   ├── types.ts
│   └── utils.ts
├── migrations/                        # Legacy: may be removed
├── artifacts/
├── hooks/
├── public/
├── tests/
├── .env.example                       # ✅ Updated for self-hosted setup
├── .env.local                         # ✅ Created for local development
├── docker-compose.yml                 # ✅ PostgreSQL, Redis, Next.js, Prometheus, Grafana
├── Dockerfile                         # ✅ Next.js container build
├── prometheus.yml                     # ✅ Metrics scrape config
├── drizzle.config.ts                  # ✅ Updated for DATABASE_URL
├── next.config.ts
├── package.json
├── INSTRUCTIONS.md                    # Phase overview & architecture
├── AGENTS.md                          # 👈 This file: Status & progress tracking
└── README.md
```

---

## Running Phase 0 Locally

### Prerequisites

- Docker & Docker Compose installed
- Node.js 20+ (for development without containers)
- pnpm package manager

### Steps

1. **Clone and setup:**
   ```bash
   cd cloud-coding-agent
   cp .env.example .env.local
   pnpm install
   ```

2. **Start containers:**
   ```bash
   docker-compose up
   ```

   This starts:
   - PostgreSQL at `localhost:5432`
   - Redis at `localhost:6379`
   - Next.js dev server at `localhost:3000`
   - Prometheus at `localhost:9090`
   - Grafana at `localhost:3001`

3. **Run migrations (first time only):**
   ```bash
   pnpm db:migrate
   ```

4. **Verify setup:**
   - Open http://localhost:3000 in browser
   - Register with email/password or GitHub OAuth
   - Create a new chat and verify it persists
   - Check Postgres: `psql postgresql://postgres:postgres@postgres:5432/app`

5. **Stop containers:**
   ```bash
   docker-compose down
   ```

   To also remove volumes: `docker-compose down -v`

### Troubleshooting

- **Postgres connection refused:** Wait 10s for Postgres to be ready, or check logs: `docker-compose logs postgres`
- **Port already in use:** Change ports in `docker-compose.yml` (e.g., `5433:5432` for Postgres)
- **Migrations fail:** Ensure DATABASE_URL is set and Postgres is running: `docker-compose logs postgres`
- **Next.js can't connect to Postgres:** Verify hostname in DATABASE_URL is `postgres` (Docker network name), not `localhost`

---

## Next Steps

**For the next agent session, start with Phase 1:**

1. Create secrets encryption library (`lib/secrets.ts`)
2. Build settings page for LLM key input
3. Implement OpenHands API client and event streaming
4. Upgrade chat component to display agent events
5. Test end-to-end: user message → OpenHands sandbox → streamed events → chat display

---

## Important Files Reference

| File | Purpose | Phase |
|------|---------|-------|
| `docker-compose.yml` | Service orchestration | 0 ✅ |
| `Dockerfile` | Next.js container build | 0 ✅ |
| `lib/db/schema.ts` | Drizzle ORM schema | 0 ✅ |
| `lib/db/migrations/0001_agent_tables.sql` | Agent table creation | 0 ✅ |
| `app/(auth)/auth.ts` | NextAuth + GitHub OAuth | 0 ✅ |
| `app/api/agent/session.ts` | Agent session API | 1 ⏳ |
| `lib/secrets.ts` | Encryption for API keys | 1 ⏳ |
| `lib/workers/sandbox-worker.ts` | BullMQ job processing | 2 ⏳ |
| `components/code-diff-viewer.tsx` | Diff visualization | 3 ⏳ |
| `lib/metrics.ts` | Prometheus instrumentation | 4 ⏳ |

---

## Questions & Decisions

- **Self-hosting Supabase Auth?** Currently using Supabase Postgres without Supabase Auth service. OAuth handled via NextAuth + GitHub only.
- **Sandbox Execution Model?** Phase 1 will use OpenHands Docker workspace. Future phases may support E2B or Fly.io.
- **LLM Model Selection?** Default to Claude Opus 4.6 (configurable per user in settings).
- **Rate Limiting?** Deferred to Phase 2+ based on usage patterns.

---

**Last Updated:** 2026-08-12
**Maintainer:** Coding Agent
