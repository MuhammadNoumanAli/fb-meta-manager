# AdPilot Development Progress

**Current phase:** Phase 0 — Project Foundation and Discovery (complete)
**Last updated:** 2026-11-12
**Blueprint:** [docs/ADPILOT_TECHNICAL_ARCHITECTURE_v2.0.md](docs/ADPILOT_TECHNICAL_ARCHITECTURE_v2.0.md)

---

## Phase 0 — Project Foundation and Discovery

### Scope delivered

- [x] Repository structure (`apps/api`, `apps/web`, `docs`, CI)
- [x] NestJS 11 backend with TypeScript, versioned `/api/v1` prefix
- [x] Vue 3 + Vite + Vuetify 3 + Pinia + Vue Router frontend
- [x] MySQL 8 connection through TypeORM (`synchronize: false`)
- [x] TypeORM CLI datasource and migration scripts
- [x] Redis connection and BullMQ root configuration
- [x] Environment validation at startup (Joi) with production JWT enforcement
- [x] Structured JSON logging with request IDs (pino)
- [x] Liveness and readiness endpoints (MySQL + Redis)
- [x] Swagger / OpenAPI at `/api/docs`
- [x] Consistent error response contract
- [x] ESLint, Prettier, Jest (API) and Vitest (web)
- [x] GitHub Actions CI (lint, typecheck, test, build)
- [x] Local setup documentation and architecture baseline

### Database migrations

| Migration | Status |
|---|---|
| (none yet — schema starts in Phase 1) | — |

Migration infrastructure is configured: `apps/api/src/database/data-source.ts` plus
`npm run migration:run|revert|show|generate`.

### API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1` | Service metadata |
| GET | `/api/v1/health` | Liveness |
| GET | `/api/v1/health/live` | Liveness alias |
| GET | `/api/v1/health/ready` | MySQL + Redis readiness |
| GET | `/api/docs` | Swagger UI |

### Frontend screens

| Screen | Route | Status |
|---|---|---|
| Phase 0 system status dashboard | `/` | Complete |

### Verification

| Check | Command | Result |
|---|---|---|
| API lint | `npm run lint -w @adpilot/api` | Pass |
| Web lint | `npm run lint -w @adpilot/web` | Pass |
| Typecheck | `npm run typecheck` | Pass (API + web) |
| API unit tests | `npm run test -w @adpilot/api` | Pass (2 suites, 7 tests) |
| Web unit tests | `npm run test -w @adpilot/web` | Pass (1 file, 7 tests) |
| API e2e (local MySQL + Redis) | `npm run test:e2e -w @adpilot/api` | Pass (2 tests) |
| Build | `npm run build` | Pass (API dist + web dist) |
| Runtime probes | `GET /api/v1/health`, `/health/ready`, `/api/docs` | 200 OK, database and redis `up` |
| Frontend | `http://localhost:5173` | Dashboard renders all services as Operational |

### Environment notes

- Local development used WAMP's MySQL 8.0.40 and a portable Redis 8.10.3 build because
  Docker, WSL and the WAMP services (no admin rights) were unavailable.
- `apps/api/.env` is local-only and excluded from version control.
- Meta, WhatsApp, S3 and AI credentials are intentionally empty in Phase 0.

### Known issues / limitations

- No domain entities or migrations exist yet; the schema begins with Phase 1.
- API e2e tests require reachable MySQL and Redis; CI currently runs unit tests only.
- CI does not yet provision MySQL/Redis containers for integration tests.
- BullMQ registers only the `notifications` queue; the remaining queues arrive in Phase 7.

### Decisions requiring approval

- None at this time.

---

## Phase roadmap status

| Phase | Status |
|---|---|
| 0 — Project foundation and discovery | Complete |
| 1 — Authentication and multi-tenancy | Not started |
| 2 — Agency client onboarding and invitations | Not started |
| 3 — Meta authentication and asset integration | Not started |
| 4 — Meta webhooks and lead integration | Not started |
| 5 — Campaign and advertisement management | Not started |
| 6 — Approval and budget management | Not started |
| 7 — Automation and reliability | Not started |
| 8 — WhatsApp Business integration | Not started |
| 9 — CRM, analytics and multi-currency | Not started |
| 10 — Self-service and hybrid experience | Not started |
| 11 — AI and fraud detection | Not started |
| 12 — Billing and commercial features | Not started |
| 13 — Google Ads and TikTok Ads | Not started |
| 14 — Production readiness and launch | Not started |
