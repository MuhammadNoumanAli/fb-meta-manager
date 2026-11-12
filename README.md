# AdPilot

AdPilot is a multi-tenant advertising management platform for agencies, their clients and
independent businesses. It combines campaign management, approvals, lead CRM, WhatsApp
messaging, analytics, multi-currency reporting and automation behind one shared advertising
engine.

This repository implements the phased plan in
[docs/ADPILOT_TECHNICAL_ARCHITECTURE_v2.0.md](docs/ADPILOT_TECHNICAL_ARCHITECTURE_v2.0.md).

## Stack

| Layer | Technology |
|---|---|
| Backend | NestJS 11 + TypeScript |
| Frontend | Vue 3 + Vite + Vuetify 3 + Pinia |
| Database | MySQL 8 + TypeORM migrations |
| Queue | Redis + BullMQ |
| API docs | Swagger / OpenAPI |

## Repository layout

```
apps/
  api/                  NestJS API (modules, providers, workers)
  web/                  Vue 3 frontend
docs/                   Architecture and delivery documentation
.github/workflows/      Continuous integration
DEVELOPMENT_PROGRESS.md Phase-by-phase delivery tracker
```

## Prerequisites

- Node.js 20 or newer (developed on Node 22)
- MySQL 8
- Redis 6.2 or newer (BullMQ requires `maxmemory-policy noeviction`)
- Optional: Docker for `docker-compose.dev.yml`

## Local setup

1. Install dependencies from the repository root:

   ```bash
   npm install
   ```

2. Create the MySQL database and application user:

   ```sql
   CREATE DATABASE adpilot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'adpilot'@'localhost' IDENTIFIED BY 'your_password';
   GRANT ALL PRIVILEGES ON adpilot.* TO 'adpilot'@'localhost';
   FLUSH PRIVILEGES;
   ```

   Or start the bundled development containers:

   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```

3. Configure environment variables:

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```

   Fill in the database password. Never commit `.env` files.

4. Start Redis with `maxmemory-policy noeviction` (required by BullMQ). With Docker the
   compose file already applies this setting.

5. Apply database migrations (creates the identity, tenancy, invitation and business
   profile schema, and seeds roles/permissions):

   ```bash
   npm run migration:run
   ```

6. Run both applications in separate terminals:

   ```bash
   npm run dev:api    # http://localhost:3000
   npm run dev:web    # http://localhost:5173
   ```

## Useful endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/v1` | API metadata |
| `GET /api/v1/health` | Liveness probe |
| `GET /api/v1/health/ready` | MySQL + Redis readiness |
| `POST /api/v1/auth/register` | Create an account and session |
| `POST /api/v1/auth/login` | Authenticate with email and password |
| `POST /api/v1/auth/refresh` | Rotate the refresh token (cookie based) |
| `POST /api/v1/auth/logout` | Revoke the current session |
| `POST /api/v1/auth/forgot-password` | Request a password reset token |
| `POST /api/v1/auth/reset-password` | Set a new password |
| `GET /api/v1/users/me` | Current user plus accessible workspaces |
| `GET /api/v1/businesses/mine` | Businesses the caller can access |
| `POST /api/v1/businesses` | Create an independent business workspace |
| `GET/PATCH /api/v1/businesses/:id` | Business detail and settings |
| `GET/POST/PATCH/DELETE /api/v1/businesses/:id/members[/:userId]` | Business membership and roles |
| `GET /api/v1/agencies/mine` | Agencies the caller belongs to |
| `POST /api/v1/agencies` | Create an agency workspace |
| `GET/POST/PATCH/DELETE /api/v1/agencies/:id/members[/:userId]` | Agency membership and roles |
| `GET/POST /api/v1/agencies/:id/clients` | List or onboard client businesses |
| `DELETE /api/v1/agencies/:id/clients/:clientBusinessId` | End an agency–client relationship |
| `GET/POST /api/v1/agencies/:id/clients/:clientBusinessId/invitations` | List or create client owner invitations |
| `DELETE /api/v1/agencies/:id/clients/:clientBusinessId/invitations/:invitationId` | Revoke a pending invitation |
| `GET /api/v1/invitations/:token` | Public invitation preview |
| `POST /api/v1/invitations/:token/accept` | Accept an invitation and start a session |
| `GET /api/v1/audit-logs?businessId=` | Audit trail for a business |
| `GET /api/docs` | Swagger UI |

## Authentication and authorization

- Access tokens are short-lived JWTs (15 minutes by default) returned in the response body.
- Refresh tokens are opaque, hashed at rest, rotated on every refresh and delivered as an
  httpOnly cookie scoped to `/api/v1/auth`. Replaying a rotated token revokes the whole
  token family for that user.
- Endpoints require a `Bearer` access token unless they are explicitly `@Public()`.
- Every request is authorized against permissions resolved from business memberships,
  agency–client links or platform administration. Cross-tenant access returns `404` so the
  existence of other tenants is not disclosed.
- Roles and permissions are seeded by the Phase 1 migration. The API enforces them; the
  frontend only uses them to hide controls.

## Client onboarding and invitations

Agencies onboard a client business, then invite its owner by email. The recipient opens a
secure acceptance link, reviews the agency and business names, and either signs in with an
existing account or creates one; they become the business owner either way.

- Invitation tokens are 32 random bytes, returned once and stored only as a SHA-256 hash.
- Invitations expire after 7 days by default (configurable from 1 to 30 days when created).
  Accepting, revoking, superseding or expiring a link makes it permanently unusable (`410`).
- Creating a new invitation for the same client and email revokes earlier pending links.
- New accounts choose first/last name and password during acceptance. Existing accounts must
  confirm their password, so an invitation never grants access without it.
- Acceptance assigns the `business_owner` role when the user has no role in that business and
  can set the workspace timezone, currency and business profile on first membership.
- Agency staff manage invitations with `agency.manage`; cross-agency attempts return `404`.
- Email delivery is not configured yet, so outside production the API returns the acceptance
  link; in production the link must be delivered through a channel that arrives in Phase 8.

## Scripts

| Command | Description |
|---|---|
| `npm run dev:api` | NestJS in watch mode |
| `npm run dev:web` | Vite dev server |
| `npm run build` | Build API and frontend |
| `npm run lint` | ESLint for API and frontend |
| `npm run typecheck` | TypeScript checks for both apps |
| `npm run test` | Jest (API) and Vitest (web) |
| `npm run format` | Prettier formatting |
| `npm run migration:run` | Apply pending TypeORM migrations |
| `npm run migration:revert` | Revert the last migration |

## Database migrations

TypeORM runs with `synchronize: false`. Every schema change must ship as a migration:

```bash
npm run migration:run -w @adpilot/api
npm run migration:generate -w @adpilot/api -- src/database/migrations/DescribeChange
```

## Testing

- API unit tests run with Jest and do not require external services.
- API e2e tests (`npm run test:e2e -w @adpilot/api`) require a reachable MySQL and Redis
  configured through `apps/api/.env`. They cover registration, login, refresh rotation and
  replay rejection, password reset, RBAC, tenant isolation, the agency/client access model,
  client invitations (creation, preview, acceptance, expiry, revocation, superseding and
  audit) and client ownership after an agency relationship ends.
- Frontend unit tests run with Vitest.
- CI runs the e2e suite in a dedicated job with MySQL 8 and Redis service containers and
  applies migrations first.

## Delivery process

Work proceeds phase by phase per the architecture blueprint. Each phase must satisfy its
acceptance criteria before the next begins. Progress, decisions and known issues are tracked
in [DEVELOPMENT_PROGRESS.md](DEVELOPMENT_PROGRESS.md).

## Security notes

- Never commit credentials or tokens.
- Integration secrets stay server-side; tokens are never exposed to the frontend.
- Tenant isolation is enforced in the backend, never by frontend filtering alone.
