# AdPilot Development Progress

**Current phase:** Phase 2 — Agency Client Onboarding and Invitations (complete)
**Last updated:** 2026-11-12
**Blueprint:** [docs/ADPILOT_TECHNICAL_ARCHITECTURE_v2.0.md](docs/ADPILOT_TECHNICAL_ARCHITECTURE_v2.0.md)

---

## Phase 2 — Agency Client Onboarding and Invitations

### Scope delivered

- [x] `invitations` table and nullable business profile columns via migration
- [x] Agencies create, list and revoke client owner invitations
- [x] Secure single-use invitation tokens (32 random bytes, SHA-256 hash at rest)
- [x] Invitation expiry with a 7-day default, configurable from 1 to 30 days
- [x] New invitations supersede earlier pending links for the same client and email
- [x] Public invitation preview showing agency, business, recipient and expiry
- [x] Acceptance creates an account (name + password) or uses an existing account
      (password confirmation required, never duplicated)
- [x] Acceptance assigns `business_owner` only when the user has no role in the business
- [x] First membership onboarding sets timezone, currency and business profile fields
- [x] Expired, revoked, superseded and already-accepted links return `410 Gone`
- [x] Audit entries for invitation creation, acceptance and revocation
- [x] Frontend invite and invitation-list dialogs with secure link copy
- [x] Public invitation acceptance screen with existing/new account states
- [x] Business detail profile editing (industry, website, contact email/phone, description)

### Database migrations

| Migration | Status |
|---|---|
| `1763000000000-Phase2InvitationsAndBusinessProfiles` | Applied locally |

Adds the `invitations` table (status enum, hashed unique token, expiry, acceptance fields)
and `industry`, `description`, `website`, `contact_email`, `contact_phone` to `businesses`.

### API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/agencies/:id/clients/:clientBusinessId/invitations` | List invitations for a client |
| POST | `/api/v1/agencies/:id/clients/:clientBusinessId/invitations` | Create a client owner invitation |
| DELETE | `/api/v1/agencies/:id/clients/:clientBusinessId/invitations/:invitationId` | Revoke a pending invitation |
| GET | `/api/v1/invitations/:token` | Public preview (agency, business, email, expiry) |
| POST | `/api/v1/invitations/:token/accept` | Accept and start a session (sets refresh cookie) |

`GET/PATCH /api/v1/businesses/:id` now also accepts the profile fields.

### Frontend screens

| Screen | Route | Status |
|---|---|---|
| Agency detail — invite and invitation dialogs | `/agencies/:agencyId` | Complete |
| Invitation acceptance (public, existing/new account) | `/invitations/:token` | Complete |
| Business detail — profile editing | `/businesses/:businessId` | Complete |

### Security properties

- Raw invitation tokens are returned only on creation outside production; only SHA-256
  hashes are stored, so listing never redisplays a link.
- Tokens are single use: acceptance, revocation, expiry or superseding moves the status to
  a terminal state and every later preview or attempt returns `410`.
- Acceptance runs in a transaction that locks the invitation row before changing state.
- Existing accounts must confirm their password; mismatches return `401` without revealing
  whether the password or invitation was wrong. Invitations never create duplicate accounts.
- Invitation management requires `agency.manage`; other agencies receive `404`.
- Client ownership is preserved: ending the agency relationship removes agency access while
  the client owner keeps direct `business_owner` access.

### Verification

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | Pass (API + web) |
| Typecheck | `npm run typecheck` | Pass (API + web) |
| API unit tests | `npm run test -w @adpilot/api` | Pass (2 suites, 7 tests) |
| Web unit tests | `npm run test -w @adpilot/web` | Pass (3 files, 14 tests) |
| API e2e (MySQL + Redis) | `npm run test:e2e -w @adpilot/api` | Pass (3 suites, 27 tests) |
| Build | `npm run build` | Pass (API dist + web dist) |
| Browser flow | create agency → client → invite → sign out → accept → owner role → profile edit | Pass |
| One-time link | reopening an accepted invitation shows “already been used” | Pass |

### Known issues / limitations

- Email delivery is not configured: outside production the API returns the acceptance link;
  in production the link must be delivered manually until notifications arrive in Phase 8.
- Invitations target client owners. Adding staff to an existing business still uses the
  add-member endpoint against registered accounts.
- The invitation list intentionally does not show the raw link because only hashes exist.

### Decisions requiring approval

- None at this time.

---

## Phase 1 — Authentication and Multi-Tenancy

### Scope delivered

- [x] Identity schema: users, refresh tokens, password reset tokens, audit logs
- [x] Tenancy schema: tenants, agencies, businesses, tenant users, business users,
      user business roles, agency clients
- [x] Roles and permissions seeded by migration (7 system roles, 19 permissions)
- [x] Registration, login, logout and transparent refresh with rotation and replay detection
- [x] Hashed refresh tokens and hashed, expiring password reset tokens
- [x] Password recovery flow (API returns the reset token only outside production)
- [x] Global JWT authentication guard and permission guard
- [x] Business-level access resolution: direct membership, active agency–client link or
      platform administration
- [x] Business workspace creation for independent customers
- [x] Agency workspace creation with agency membership management
- [x] Client onboarding from an agency and ending agency–client relationships
- [x] Business membership management with role assignment and last-owner protection
- [x] Audit logging for authentication and tenancy events
- [x] Frontend auth layout, login, registration, forgot/reset password screens
- [x] Frontend workspace switcher, business detail (members, audit) and agency detail
      (clients, members) screens, with permission-aware controls

### Database migrations

| Migration | Status |
|---|---|
| `1762900000000-Phase1IdentityAndTenancy` | Applied locally |

Migration creates 14 tables, foreign keys, unique constraints and seeds roles,
permissions and role-permission mappings.

### API endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/auth/register` | Create account and session |
| POST | `/api/v1/auth/login` | Authenticate |
| POST | `/api/v1/auth/refresh` | Rotate refresh token (httpOnly cookie) |
| POST | `/api/v1/auth/logout` | Revoke current refresh token |
| POST | `/api/v1/auth/forgot-password` | Issue password reset token |
| POST | `/api/v1/auth/reset-password` | Consume reset token and set password |
| GET | `/api/v1/users/me` | Current user and accessible workspaces |
| PATCH | `/api/v1/users/me` | Update profile |
| POST | `/api/v1/businesses` | Create independent business |
| GET | `/api/v1/businesses/mine` | List accessible businesses |
| GET/PATCH | `/api/v1/businesses/:id` | Read or update business |
| GET/POST/PATCH/DELETE | `/api/v1/businesses/:id/members[/:userId]` | Membership management |
| POST | `/api/v1/agencies` | Create agency |
| GET | `/api/v1/agencies/mine` | List agencies |
| GET/PATCH | `/api/v1/agencies/:id` | Read or update agency |
| GET/POST/PATCH/DELETE | `/api/v1/agencies/:id/members[/:userId]` | Agency membership |
| GET/POST | `/api/v1/agencies/:id/clients` | List or onboard clients |
| DELETE | `/api/v1/agencies/:id/clients/:clientBusinessId` | End client relationship |
| GET | `/api/v1/audit-logs?businessId=` | Business audit trail |

### Frontend screens

| Screen | Route | Status |
|---|---|---|
| Login | `/login` | Complete |
| Register | `/register` | Complete |
| Forgot password | `/forgot-password` | Complete |
| Reset password | `/reset-password` | Complete |
| Workspaces | `/` | Complete |
| Business detail (members, audit) | `/businesses/:businessId` | Complete |
| Agency detail (clients, members) | `/agencies/:agencyId` | Complete |
| System status | `/system-status` | Complete |

### Security properties

- Access tokens: JWT, 15-minute default TTL, bearer header only.
- Refresh tokens: 48-byte opaque values, SHA-256 hashed at rest, rotated on every use;
  replay of a consumed token revokes every refresh token for that user.
- Refresh cookie: `httpOnly`, `sameSite=lax`, path `/api/v1/auth`, `secure` in production.
- Password reset tokens: hashed at rest, single use, 30-minute expiry; resetting revokes
  all refresh tokens.
- Passwords hashed with bcrypt (cost 12); login failures are generic and constant-shaped.
- Cross-tenant requests return `404` rather than `403` to avoid tenant enumeration.
- Audit logs record actor, tenant, business, entity and IP/user agent for sensitive events.

### Verification

| Check | Command | Result |
|---|---|---|
| API lint | `npm run lint` | Pass |
| Typecheck | `npm run typecheck` | Pass (API + web) |
| API unit tests | `npm run test -w @adpilot/api` | Pass (2 suites, 7 tests) |
| Web unit tests | `npm run test -w @adpilot/web` | Pass (3 files, 14 tests) |
| API e2e (MySQL + Redis) | `npm run test:e2e -w @adpilot/api` | Pass (2 suites, 16 tests) |
| Build | `npm run build` | Pass (API dist + web dist) |
| Runtime smoke (31 checks) | register/login/RBAC/refresh/reset/agency flows | Pass |
| Browser flows | register, create business, audit, agency + client, member add, reload | Pass |

### Known issues / limitations

- Email delivery is not wired yet: outside production the API returns the reset token in
  the forgot-password response, and no email is sent.
- Audit retention/archival and log export are not implemented.

### Decisions requiring approval

- None at this time.

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

- No domain entities or migrations existed in Phase 0; the schema began with Phase 1.
- API e2e tests require reachable MySQL and Redis. Resolved in Phase 1: CI now provisions
  MySQL 8 and Redis service containers and runs migrations plus the e2e suite.
- BullMQ registers only the `notifications` queue; the remaining queues arrive in Phase 7.

### Decisions requiring approval

- None at this time.

---

## Phase roadmap status

| Phase | Status |
|---|---|
| 0 — Project foundation and discovery | Complete |
| 1 — Authentication and multi-tenancy | Complete |
| 2 — Agency client onboarding and invitations | Complete |
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
