# Citi Governance Application

A single integrated web application replacing the scattered Excel sheets used to run the
Citi engagement's governance — onboarding tracking, PTS timesheets, delivery metrics,
skill profiles, and training/certifications.

## Tech Stack

| Layer    | Choice                                   |
|----------|------------------------------------------|
| Frontend | React 19 + Vite, React Router, Recharts  |
| Backend  | Java 21 / Spring Boot 3.5 (REST + JPA)   |
| Database | PostgreSQL 16 (Docker)                   |
| Cloud    | AWS (target for deployment phase)        |

## Project Layout

```
docker-compose.yml   → PostgreSQL 16 container (citi_governance DB)
backend/             → Spring Boot API on :8080
frontend/            → React app on :5173 (dev server proxies /api → :8080)
```

## Running Locally

Prereqs: Java 21+, Docker, Node 22 (installed at `~/.local/node22`).

```bash
# 1. Database
docker compose up -d

# 2. Backend (port 8080) — seeds 10 sample candidates, timesheets & trainings on first run
cd backend && ./mvnw spring-boot:run

# 3. Frontend (port 5173)
export PATH="$HOME/.local/node22/bin:$PATH"
cd frontend && npm run dev
```

Open **http://localhost:5173** and sign in.

### Demo accounts (password `Citi@123`)

| Role | Email | Can do |
|------|-------|--------|
| Lead | suresh.iyer@deloitte.com | Everything: nominate, advance stages, approve PTS, add trainings, re-map managers |
| Lead | anita.desai@deloitte.com | Same as above |
| Developer | arjun.mehta@deloitte.com (any seeded candidate email) | Own timesheet, own profile/skills, self-enroll in trainings |

Authentication is token-based (BCrypt password hashes, 7-day bearer tokens stored in
Postgres). Every `/api/**` call requires `Authorization: Bearer <token>`; role checks are
enforced server-side (401/403), not just hidden in the UI.

## Modules

1. **Dashboard** — KPI cards (total / nominated / CARAT cleared / selected / onboarded /
   in pipeline), monthly nomination-vs-onboarding trend, PTS hours by month, pipeline
   stage breakdown, and a clickable candidate status table.
2. **PTS — Timesheet** — per candidate per month: static Name / Email / SOEID,
   Week 1–5 hour entry with live auto-total. SOEID can be added once if missing at
   registration, then locks (server enforces with 409). **Approval workflow:** a
   developer's save submits the sheet to their reporting manager; leads see
   "awaiting approval" rows on the same page and Approve/Reject inline. Any edit
   resubmits. The dashboard shows a "PTS Awaiting Approval" KPI.
3. **Onboarding** — pipeline stepper per candidate:
   `Nominated → CARAT Interview → Client Interview → Final Selection → Onboarding Initiated → Citi Clearance Received → VDI Setup In Progress → Onboarded`.
   Leads nominate new candidates and complete the current step; every transition is
   recorded in an audit trail (who + when).
4. **Profiles** — details (band, wave, pod, location, join date, manager), skill gaps,
   allocations, activities, assigned trainings with progress, and an editable
   five-axis skill radar (Technical / Functional / Leadership / Domain / Certifications).
   Leads can re-map a developer's **reporting manager** from here (picks from the
   lead list); the new manager then handles their PTS approvals.
5. **Training** — certification catalog (leads add), enrollment per candidate, and a
   per-certification view with enrolled candidates, status and progress notes.

## API Overview (backend :8080)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/auth/login` · `/logout` · `GET /me` | Token auth |
| `GET /api/users/leads` | Lead list (manager re-mapping) |
| `GET /api/dashboard/summary` | KPIs, stage breakdown, monthly trends, PTS hours, pending approvals |
| `GET/POST /api/candidates` · `PUT /{id}` | List/search (`?q=`), nominate, update |
| `POST /api/candidates/{id}/advance-stage` | Complete current onboarding step |
| `GET /api/candidates/{id}/stage-history` | Audit trail |
| `POST /api/candidates/{id}/soeid` | One-time SOEID set (409 afterwards) |
| `PUT /api/candidates/{id}/skills` | Update skill radar values |
| `GET/POST /api/timesheets` | List by `?month=`/`?candidateId=`; upsert with auto-total (resubmits) |
| `POST /api/timesheets/{id}/decision` | Manager approve/reject (leads only) |
| `GET/POST /api/trainings` · `GET /{id}` | Catalog, create, detail with enrollments |
| `POST /api/trainings/{id}/enroll` | Enroll a candidate |
| `PUT /api/enrollments/{id}` | Update status / progress / notes |

## Roadmap

- [x] Phase 1 — Governance module: dashboard, PTS, onboarding pipeline, profiles, training
- [x] Authentication & roles (lead vs developer, enforced server-side)
- [x] PTS approval workflow + manager re-mapping
- [ ] SSO integration (replace local accounts)
- [ ] Story points / GT delivery metrics module
- [ ] Excel/CSV export of timesheets & metrics
- [ ] AWS deployment (RDS + ECS/Amplify)
