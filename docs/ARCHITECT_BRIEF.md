# OmniPlan — Architect Brief

> **Audience:** AI architect agent tasked with producing a detailed, agent-executable implementation plan.
> **Repo:** `https://github.com/vincenth20100/omniplan` (already bootstrapped — see below)
> **Date:** 2026-03-24

---

## 1. What This App Is

A fast, self-hostable, AI-capable, multi-user project scheduling application. It handles projects with thousands of tasks, Gantt views, Kanban views, critical path scheduling (CPM), OmniPlan/MS Project import/export, and AI-assisted conflict detection and suggestions.

It must run fully offline from a single `docker compose up` — no external SaaS required. It is a standalone product first; future integration with a separate "nexus" app is a soft requirement.

---

## 2. Current State of the Repo

The repo at `/home/vincenth/data/projects/omniplan` (and `https://github.com/vincenth20100/omniplan`) was bootstrapped by cloning `vincenth20100/studio`. It contains:

```
omniplan/
├── src/
│   ├── ai/                    # Genkit + Gemini 2.5 Flash — one flow: identify-scheduling-conflicts
│   ├── app/
│   │   ├── page.tsx           # Auth gate → project list (Firebase Auth)
│   │   ├── [projectId]/       # Main app page (Firebase Auth + Firestore)
│   │   ├── converter/         # Standalone MPP converter UI
│   │   └── api/convert-project/route.ts  # Calls scripts/convert_project.py via subprocess
│   ├── components/            # ~70 React components (Gantt, Kanban, Resources, AI panel, shadcn/ui)
│   ├── firebase/              # FirebaseClientProvider, useFirestore hooks, non-blocking writes
│   ├── hooks/
│   │   └── use-project.ts     # 139KB monolith — useReducer + all Firestore calls + CPM triggers
│   └── lib/
│       ├── types.ts           # Full domain model (Task, Link, Resource, Project, etc.)
│       ├── scheduler.ts       # CPM engine (32KB, pure TypeScript — KEEP THIS)
│       ├── import-utils.ts    # XML/Excel parsers
│       ├── omniplan-utils.ts  # Maps /analyze JSON → internal types (calls HF Space)
│       └── export-utils.ts    # CSV, Excel, MS Project XML
├── converter/                 # Python Flask service (MPP/OmniPlan → JSON via MPXJ + JPype)
│   ├── app.py                 # Flask app, ~900 lines, single file
│   ├── Dockerfile             # python:3.9-slim + openjdk-21 + MPXJ JARs
│   └── requirements.txt       # flask, jpype1, mpxj, gunicorn, pandas, openpyxl
├── docs/
│   ├── ARCHITECT_BRIEF.md     # This file
│   └── blueprint.md           # Earlier notes
├── scripts/
│   └── convert_project.py     # Local Python fallback (subset of converter/app.py)
├── next.config.ts             # ignoreBuildErrors: true — MUST be fixed
├── package.json               # postinstall runs pip3 (fragile) — MUST be removed
├── apphosting.yaml            # Firebase App Hosting config — will be replaced by Docker
└── firestore.rules            # Firebase security rules — will be replaced by server-side auth
```

### What to keep as-is (do not rewrite)
- `src/lib/scheduler.ts` — CPM engine, correct, well-tested
- `src/lib/types.ts` — domain types (extend, do not replace)
- `src/components/omni-gantt/` — custom Gantt engine (keep, may need minor wiring changes)
- `src/components/ui/` — shadcn/ui primitives (keep entirely)
- `src/components/kanban/`, `src/components/resources/`, `src/components/details/` — keep
- `converter/app.py` + `converter/requirements.txt` — keep as-is, just re-containerised

---

## 3. Target Architecture

### Single-Container Design (User Requirement)

The user wants the Python converter **integrated into the same Docker image** as the Next.js app. This is not the classic microservice pattern, but it is the correct choice here because:
- Eliminates inter-container networking for the converter
- Simplifies deployment to one image + postgres + pocketbase
- The converter is a low-traffic internal tool, not a public API

**Runtime model:** Use `supervisord` to run two processes in one container:
1. **Node.js** — Next.js production server on port 3000
2. **Python/Gunicorn** — Flask converter on port 7860 (internal only, not exposed outside the container)

Next.js Route Handlers call `http://localhost:7860/analyze` server-side. The browser never touches the converter.

### Full System Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                        │
│  Next.js React app (client components)                         │
│  ├── fetch() → /api/*        (server route handlers)           │
│  └── EventSource → /api/events/[projectId]   (SSE)             │
└───────────────────┬─────────────────────────────────────────────┘
                    │ HTTPS (Cloudflare Tunnel)
┌───────────────────▼─────────────────────────────────────────────┐
│  omniplan container                                             │
│                                                                 │
│  ┌─ Next.js (port 3000) ──────────────────────────────────┐    │
│  │  Route Handlers (/api/*)                               │    │
│  │  ├── auth middleware → validates PocketBase JWT        │    │
│  │  ├── /api/projects, /api/tasks, /api/links, ...       │    │
│  │  ├── /api/events/[projectId]   SSE real-time          │    │
│  │  ├── /api/import               → proxies to :7860     │    │
│  │  └── /api/ai/*                 → Genkit flows         │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─ Flask/Gunicorn (port 7860, internal only) ─────────────┐   │
│  │  POST /analyze   (MPP/OmniPlan → JSON via MPXJ/JPype)  │   │
│  └────────────────────────────────────────────────────────┘    │
└──────┬──────────────────────┬───────────────────────────────────┘
       │ SQL (node-postgres)   │ HTTP
       │                       │
┌──────▼──────┐       ┌────────▼──────────┐
│ PostgreSQL  │       │  PocketBase        │
│ + pgvector  │       │  (Auth + Users)    │
│ (port 5432) │       │  (port 8090)       │
└─────────────┘       └───────────────────┘

All on one Docker network. Only port 3000 is exposed to Cloudflare tunnel.
```

### docker-compose.yml (target)

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://omniplan:${DB_PASSWORD}@postgres:5432/omniplan
      POCKETBASE_URL: http://pocketbase:8090
      POCKETBASE_ADMIN_TOKEN: ${POCKETBASE_ADMIN_TOKEN}
      GOOGLE_AI_API_KEY: ${GOOGLE_AI_API_KEY}
      CONVERTER_URL: http://localhost:7860
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - omniplan-net

  postgres:
    image: pgvector/pgvector:pg16
    restart: unless-stopped
    environment:
      POSTGRES_USER: omniplan
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: omniplan
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U omniplan"]
      interval: 5s
      retries: 5
    networks:
      - omniplan-net

  pocketbase:
    image: ghcr.io/muchobien/pocketbase:latest
    restart: unless-stopped
    volumes:
      - pocketbase_data:/pb/pb_data
    ports:
      - "8090:8090"
    networks:
      - omniplan-net

volumes:
  postgres_data:
  pocketbase_data:

networks:
  omniplan-net:
    driver: bridge
```

### Multi-Stage Dockerfile (target)

```
Stage 1 (node-deps):   node:22-alpine — npm ci
Stage 2 (builder):     node:22-alpine — next build (output: standalone)
Stage 3 (runner):      python:3.11-slim
                         → install openjdk-21-headless
                         → install python deps (flask, jpype1, mpxj, gunicorn, pandas)
                         → install Node.js 22 (via NodeSource apt)
                         → copy Next.js standalone output from stage 2
                         → copy converter/app.py
                         → install supervisord
                         → supervisord.conf starts: gunicorn on :7860, node server.js on :3000
```

---

## 4. What Must Change in the Codebase

### 4a. Remove Firebase entirely

The entire `src/firebase/` directory and all Firebase SDK imports must be removed and replaced.

**Replace with:**
- **Auth:** PocketBase JS SDK (`pocketbase` npm package) — client-side login/logout/session management
- **Data layer:** Fetch calls to `/api/*` Route Handlers (no direct DB access from client)
- **Real-time:** `EventSource` (SSE) connecting to `/api/events/[projectId]`

Key files to rewrite:
- `src/firebase/config.ts` → delete
- `src/firebase/provider.tsx` → replace with `src/providers/auth-provider.tsx` (PocketBase)
- `src/firebase/firestore/` → delete
- `src/firebase/non-blocking-updates.tsx` → delete
- `src/hooks/use-project.ts` → major surgery (see §4b)
- `src/app/page.tsx` → swap Firebase auth check for PocketBase session check
- `src/app/[projectId]/page.tsx` → same

### 4b. Decompose `use-project.ts`

Split the 139KB monolith into:

```
src/
├── services/
│   ├── project-api.ts     # fetch wrappers for /api/projects, /api/tasks, etc.
│   ├── sse-client.ts      # EventSource connection + message dispatch
│   └── ai-api.ts          # fetch wrappers for /api/ai/*
├── hooks/
│   ├── use-project.ts     # Thin: useReducer + local UI state only (no DB calls)
│   ├── use-project-sync.ts # Mounts SSE listener, dispatches remote events to reducer
│   └── use-schedule.ts    # Wraps calculateSchedule() — consider debouncing
```

The reducer actions and state shape stay the same. Only the side effects (Firestore calls → fetch calls) change.

### 4c. Add API Route Handlers

Create `src/app/api/` route handlers:

```
src/app/api/
├── health/route.ts                   # GET → 200 OK (for Docker healthcheck)
├── auth/
│   └── validate/route.ts            # POST — validates PocketBase JWT, returns user
├── projects/
│   ├── route.ts                     # GET (list), POST (create)
│   └── [projectId]/
│       ├── route.ts                 # GET, PATCH, DELETE
│       ├── tasks/route.ts           # GET, POST
│       ├── tasks/[taskId]/route.ts  # PATCH, DELETE
│       ├── links/route.ts           # GET, POST
│       ├── links/[linkId]/route.ts  # DELETE
│       ├── resources/route.ts       # GET, POST, PATCH, DELETE
│       ├── assignments/route.ts     # GET, POST, DELETE
│       ├── schedule/route.ts        # POST — runs CPM, returns updated task dates
│       └── export/route.ts          # GET — returns MS Project XML / CSV / XLSX
├── import/route.ts                  # POST — receives file, calls localhost:7860/analyze, saves to DB
├── events/
│   └── [projectId]/route.ts        # GET — SSE stream for real-time task updates
└── ai/
    ├── conflicts/route.ts           # POST — Genkit identifySchedulingConflicts flow
    └── suggest/route.ts             # POST — future: natural language → tasks
```

**All route handlers must:**
1. Extract and validate the PocketBase JWT from `Authorization: Bearer <token>` header
2. Scope all DB queries to the authenticated `user_id`
3. Never return data belonging to other users unless the user has project membership

### 4d. Database Layer — Drizzle ORM + PostgreSQL

Add `drizzle-orm` and `postgres` (node-postgres) as dependencies.

Schema files in `src/db/`:
```
src/db/
├── schema.ts          # All table definitions (Drizzle schema)
├── index.ts           # DB connection singleton
└── migrations/        # Drizzle-generated SQL migration files
```

**Schema (Drizzle TypeScript):**

```typescript
// Projects
projects: id, owner_id, name, status, settings (jsonb), created_at, updated_at
project_members: project_id, user_id, role ('owner'|'editor'|'viewer')

// Scheduling core
tasks: id, project_id, parent_id (nullable), name, start_date, finish_date,
       duration, work, constraint_type, constraint_date,
       percent_complete, priority, notes, is_milestone, is_summary,
       wbs, outline_level, custom_fields (jsonb), created_at, updated_at,
       embedding (vector(1536))  -- pgvector, populated when AI is enabled

links: id, project_id, source_task_id, target_task_id,
       link_type ('FS'|'SS'|'FF'|'SF'), lag, lag_unit

resources: id, project_id, name, type, max_units, cost_per_hour, email
assignments: id, task_id, resource_id, units, work

// Supporting
calendars: id, project_id, name, definition (jsonb)
baselines: id, project_id, name, snapshot (jsonb), created_at
history: id, project_id, user_id, action, diff (jsonb), created_at
```

All foreign keys enforced. Indexes on: `tasks(project_id)`, `tasks(parent_id)`, `links(project_id)`, `links(source_task_id)`, `history(project_id, created_at DESC)`.

### 4e. Auth — PocketBase

PocketBase runs as a separate container. It manages users, sessions, and project invitations.

**PocketBase collections needed:**
- `users` (built-in) — email/password auth
- `invitations` — `{ project_id, inviter_id, invitee_email, role, token, expires_at }`

**Auth flow:**
1. Client calls `pb.authWithPassword(email, password)` → PocketBase JWT
2. Client sends JWT in `Authorization: Bearer` on every `/api/*` request
3. Next.js Route Handler calls `pb.authRefresh()` with the token to validate it and get `userId`
4. Route Handler scopes all queries: `WHERE project_members.user_id = $userId`

**Client-side:** Replace `FirebaseClientProvider` with `AuthProvider` using the `pocketbase` npm SDK. Store the PocketBase instance in a React context. Auto-refresh the token on app focus.

### 4f. Real-time via SSE

Replace Firestore `onSnapshot` listeners with Server-Sent Events.

`/api/events/[projectId]` route:
- Validates auth
- Opens a Postgres `LISTEN omniplan_project_{projectId}` channel
- Streams `data: {...}\n\n` whenever a write triggers a `pg_notify`
- Client `use-project-sync.ts` dispatches the received event into the local reducer

Postgres trigger (SQL migration):
```sql
CREATE OR REPLACE FUNCTION notify_project_change()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'omniplan_project_' || NEW.project_id::text,
    json_build_object('table', TG_TABLE_NAME, 'op', TG_OP, 'id', NEW.id)::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach to tasks and links tables
CREATE TRIGGER tasks_notify AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION notify_project_change();
CREATE TRIGGER links_notify AFTER INSERT OR UPDATE OR DELETE ON links
  FOR EACH ROW EXECUTE FUNCTION notify_project_change();
```

### 4g. CPM Schedule Recalculation

Move the heavy CPM recalculation out of the client-side reducer and onto the server.

`/api/projects/[projectId]/schedule` (POST):
- Fetches all tasks + links for the project from PostgreSQL
- Calls `calculateSchedule()` (the existing `scheduler.ts` function — import it server-side)
- Writes updated `start_date`, `finish_date`, `total_float`, `is_critical` back to the DB
- Returns the updated task array
- Triggers SSE notification so all connected clients get the update

Client-side: the reducer still does optimistic local recalculation for immediate feedback, but the server is the source of truth.

### 4h. Import Route

`/api/import` (POST):
- Accepts `multipart/form-data` with a project file
- Calls `http://localhost:7860/analyze` (Flask converter, internal)
- Maps the `HFAnalyzeResponse` using the existing `mapAnalyzeResponse()` from `omniplan-utils.ts`
- Saves the resulting project + tasks + links + resources to PostgreSQL via Drizzle
- Returns the new `projectId`

Remove `NEXT_PUBLIC_OMNIPLAN_API_URL` — the converter URL is now always `http://localhost:7860` (server-side env var `CONVERTER_URL`).

### 4i. Fix Build Configuration

**`next.config.ts` changes:**
```typescript
const config: NextConfig = {
  output: 'standalone',        // Required for Docker multi-stage build
  // Remove: ignoreBuildErrors, ignoreDuringBuilds
};
```

**`package.json` changes:**
- Remove `postinstall` pip3 script entirely
- Add `drizzle-orm`, `postgres`, `pocketbase` to dependencies
- Remove `firebase` and all `@firebase/*` packages

### 4j. `.env.example`

Create `.env.example` at repo root:
```
DB_PASSWORD=changeme
POCKETBASE_ADMIN_TOKEN=
GOOGLE_AI_API_KEY=
NODE_ENV=production
```

---

## 5. Files to Delete

```
src/firebase/                        # Entire directory
src/app/api/convert-project/         # Replaced by /api/import
scripts/convert_project.py           # Replaced by converter/ module
apphosting.yaml                      # Firebase App Hosting config
firestore.rules                      # Firebase security rules
requirements.txt                     # Root-level pip requirements (fragile postinstall)
```

---

## 6. Constraints for All Agents

1. **TypeScript strictly** — fix `ignoreBuildErrors` and resolve all type errors. No `any` without a comment explaining why.
2. **No new external SaaS** — AI calls go to Google AI (configurable), nothing else calls home.
3. **Keep the Gantt, CPM engine, and all UI components** — these are not rewritten, only rewired.
4. **Docker image must be production-hardened** — multi-stage, non-root user, no dev deps in the final image.
5. **One `docker compose up` must start the full stack** — postgres, pocketbase, app.
6. **The converter Flask service runs inside the app container** on port 7860 (internal), managed by supervisord.
7. **PocketBase is auth-only** — all project/task/scheduling data lives in PostgreSQL.
8. **SSE, not WebSockets** — simpler to implement behind Cloudflare tunnel without WebSocket upgrade issues.
9. **AI API keys never reach the browser** — all Genkit flows remain in Route Handlers or Server Actions.
10. **Drizzle ORM** for all database access — schema-as-code, typed queries, migration files committed to the repo.

---

## 7. Acceptance Criteria

The rebuild is complete when:
- [ ] `docker compose up` starts all services with no errors
- [ ] A user can register and log in via PocketBase auth
- [ ] A user can create a project, add tasks and links, see them in Gantt view
- [ ] CPM schedule recalculates correctly on task changes
- [ ] A user can import an `.mpp` or `.omplan` file and see the project populated
- [ ] The AI conflict detector works (calls Genkit flow, returns results)
- [ ] Real-time: two browser tabs on the same project see each other's changes within 2 seconds
- [ ] Zero Firebase SDK imports remain in the codebase
- [ ] `next build` completes with zero TypeScript errors
- [ ] The Docker image builds successfully and the app runs in production mode

---

## 8. Out of Scope (Do Not Implement)

- nexus integration (described separately, not part of this rebuild)
- Vector embeddings / semantic search (add pgvector extension but leave embedding population for a follow-up)
- OAuth2 / social login (PocketBase supports it, but configure manually post-deploy)
- Mobile responsiveness improvements
- Export to PDF (existing `jspdf`/`html2canvas` code can stay, just needs rewiring)
