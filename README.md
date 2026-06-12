# Citi Governance Application

A single integrated web application replacing the scattered Excel sheets used to run the
Citi engagement's governance — onboarding tracking, PTS timesheets, skill profiles,
training/certifications, and the KARAT assessment prep.

## Tech Stack

| Layer    | Choice                                            |
|----------|---------------------------------------------------|
| Frontend | React 19 + Vite, React Router v6, Recharts        |
| Backend  | Java 21 / Spring Boot 3.5 (REST + JPA/Hibernate)  |
| Database | PostgreSQL 16 (Docker)                            |
| Auth     | Token-based (BCrypt + 7-day bearer tokens)        |
| Docs     | Swagger/OpenAPI at `/swagger-ui.html`             |

## Project Layout

```
docker-compose.yml   → app + PostgreSQL 16 (citi_governance DB)
Dockerfile           → single-image build: Vite build → Spring static → one jar
backend/             → Spring Boot API on :8080 (also serves the built UI in prod)
frontend/            → React app on :5173 in dev (Vite proxies /api → :8080)
```

## Running Locally

Prereqs: Java 21+, Docker, Node 22 (installed at `~/.local/node22`).

```bash
# 1. Database
docker compose up -d postgres        # container: citi-governance-db, volume: pgdata

# 2. Backend (:8080) — seeds sample data on first run only (idempotent fix-ups every boot)
cd backend && ./mvnw spring-boot:run

# 3. Frontend (:5173)
export PATH="$HOME/.local/node22/bin:$PATH"   # Node lives here, not on PATH by default
cd frontend && npm run dev
```

Open **http://localhost:5173**. After login everyone lands on the Dashboard.

### Single-container deploy

`docker compose up --build` runs `app` (:8080, serves UI **and** API) + `postgres`.
The image is a multi-stage build (Node builds the frontend → copied into Spring Boot's
static resources → Maven packages one jar). `SpaConfig` forwards SPA routes to
`index.html`; datasource is env-driven (`SPRING_DATASOURCE_URL/USERNAME/PASSWORD`).
GitHub Pages **cannot** host this (no backend/DB) — use a container host.

### Demo accounts (password `Citi@123`)

| Tier | Email | Band |
|------|-------|------|
| Senior Manager | jitendrkumar@deloitte.com | B5H |
| Manager | suresh.iyer@deloitte.com | B6H |
| Manager | anita.desai@deloitte.com | B5H |
| Manager | tsbhargav@deloitte.com | B6H |
| Developer | any seeded candidate email | B8 / B7 / B6L |

Role checks are enforced **server-side** (401/403), not just hidden in the UI.
Every `/api/**` call needs `Authorization: Bearer <token>`; `/auth/login`, `/register`
and `/auth/managers` are public.

## Roles & Bands

There is **no role picker at signup** — the band you register with sets your role.

```
Seniority (low → high):  b8 < b7 < b6l < b6h < b5l < b5h < b4l < b4h
                          └──── Developer ────┘ └──────── Manager ────────┘
                                                        └── Senior Manager ──┘  (b5l+)
```

- **Manager** = band `b6h` and above; **Developer** = `b6l` and below.
- **Senior Manager** = a Manager whose band is `b5l/b5h/b4l/b4h` (derived, not a separate role).
- A **reporting manager must hold a strictly more senior band** than the person reporting
  to them — registration and the profile re-map only list (and only accept) more-senior,
  onboarded managers.
- Bands are stored lowercase (`b6h`) and **displayed uppercase** (`B6H`) via `bandLabel`.
- Single source of truth: `backend/.../model/Bands.java` and `ALL_BANDS`/`bandRank`/
  `roleForBand` in `frontend/src/api.js`.

## Modules

1. **Dashboard** — scoped to the signed-in user (managers see their reportees, developers
   see themselves). Clickable KPI cards, stage breakdown, monthly trend, and the user's own
   monthly PTS hours. Developers get an onboarding-journey timeline. **KARAT Failed shows as
   a red KPI.**
2. **PTS (Timesheet)** — Week 1–5 hour entry with live total. Split for managers into
   **My Timesheet** and **Approvals** (Approve/Reject only their direct reports' sheets).
   A developer's save submits to their reporting manager.
3. **Onboarding** — horizontal-swimlane Kanban (drag a card to change stage). **Managers/
   senior managers only**; shows everyone reporting to them. Stages:
   `Nominated → KARAT Scheduled → KARAT Failed → Client Interview → Final Selection →
   Onboarding Initiated → Citi Clearance Received → VDI Setup In Progress → Onboarded`.
   **KARAT Failed is terminal** (no re-attempt). Every transition is audited.
4. **My Team** (`/profiles`) — open to everyone (peers via shared reporting manager).
   Profile detail has the skill radar, details, and trainings. Managers/owners can edit.
5. **CITI Org Directory** (`/people`) — **senior managers only**. Everyone registered with
   onboarding status, filter chips, search, and CSV export.
6. **Training** — certification catalog (**only senior managers add**), self-enrollment,
   per-cert progress. Includes the CCAF (Claude Certified Architect Foundations) cert.
7. **KARAT Assessment** (`/karat`) — 4 tracks (DevOps, Java Backend, Frontend, AI/Python),
   each with a study guide + a downloadable question bank.

### Key rules

- **SOEID** is hidden before onboarding starts. It can be **assigned/edited only by the
  candidate's manager**, and only once stage ≥ Onboarding Initiated (profile "Edit profile"
  form). A candidate **cannot be moved to Onboarded without a SOEID**.
- **Onboarded** sets the join date to that day. Only onboarded managers can be picked as a
  reporting manager.
- **Notifications**: app-wide toast (`frontend/src/toast.jsx`, `useToast()`), a dark pill
  top-right. Backend `ResponseStatusException` messages surface in the toast
  (`server.error.include-message=always`).

## API Overview (backend :8080)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/auth/login` · `/logout` · `GET /me` | Token auth |
| `POST /api/auth/register` · `GET /api/auth/managers` | Self-service signup; onboarded managers (with band) |
| `GET /api/users/managers` | Onboarded managers (with band) for re-mapping |
| `GET /api/dashboard/summary` | KPIs, stage breakdown, trends, own PTS hours, pending approvals (scoped to user) |
| `GET/POST /api/candidates` · `PUT /{id}` | List/search (`?q=`), nominate, update |
| `POST /api/candidates/{id}/stage` · `/advance-stage` | Set any stage / complete current step (managers) |
| `GET /api/candidates/{id}/stage-history` | Audit trail |
| `POST /api/candidates/{id}/soeid` | Manager assigns/edits SOEID (stage-gated) |
| `PUT /api/candidates/{id}/skills` | Update skill radar values |
| `GET/POST /api/timesheets` · `POST /{id}/decision` | List (`?month=`/`?candidateId=`), upsert, approve/reject |
| `GET/POST /api/trainings` · `GET /{id}` · `POST /{id}/enroll` · `PUT /api/enrollments/{id}` | Catalog, detail, enrol, progress |

Interactive docs: **http://localhost:8080/swagger-ui.html**.

## Conventions & gotchas

- `DataSeeder` runs idempotent migrations every boot. Hibernate `ddl-auto=update` never
  rewrites enum CHECK constraints, so the seeder **drops `*_check` constraints** before
  writing new enum values (role, current_stage, stage_history.stage).
- JPA repos use underscore notation for nested fields (`findByTraining_Id`) — a plain getter
  like `getTrainingId()` breaks Spring Data derived queries.
- The onboarding enum constant is still `CARAT_INTERVIEW`; its **label** is "KARAT Scheduled"
  (display-only rename).
- UI screenshots: `node frontend/screenshot.mjs` (playwright-core + system Chrome; both
  servers must be running).

## Roadmap

- [x] Governance module: dashboard, PTS, onboarding pipeline, profiles, training
- [x] Token auth + roles (manager / developer / senior-manager), enforced server-side
- [x] PTS approval workflow + reporting-manager re-mapping
- [x] Band-driven roles + seniority-based reporting hierarchy
- [x] KARAT assessment prep + KARAT-failed tracking
- [x] Single-container Docker build + Swagger docs
- [ ] SSO integration (replace local accounts)
- [ ] Story points / delivery metrics module
- [ ] AWS deployment (RDS + ECS)
