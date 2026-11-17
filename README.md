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

5. Apply database migrations (creates the identity, tenancy, invitation, Meta integration,
   webhook/lead and campaign schema, adds approvals and budgets, and seeds roles/permissions):

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
| `GET /api/v1/businesses/:businessId/integrations/meta` | Meta connection health, permissions and assets |
| `GET /api/v1/businesses/:businessId/integrations/meta/events` | Recent Meta connection activity |
| `POST /api/v1/businesses/:businessId/integrations/meta/oauth/start` | Start Meta OAuth |
| `POST /api/v1/businesses/:businessId/integrations/meta/system-user` | Connect a System User token |
| `POST /api/v1/businesses/:businessId/integrations/meta/validate` | Revalidate token and permissions |
| `POST /api/v1/businesses/:businessId/integrations/meta/discover` | Refresh discovered assets |
| `DELETE /api/v1/businesses/:businessId/integrations/meta` | Disconnect and revoke access |
| `GET /api/v1/integrations/meta/oauth/callback` | Public Meta OAuth callback (state protected) |
| `POST /api/v1/integrations/meta/monitor/sweep` | Platform-only token validation sweep |
| `GET/POST /api/v1/webhooks/meta` | Meta subscription challenge and signed delivery intake |
| `GET /api/v1/businesses/:businessId/leads[/:leadId]` | Lead list and detail |
| `PATCH /api/v1/businesses/:businessId/leads/:leadId` | Update lead status |
| `GET /api/v1/businesses/:businessId/leads/sync-logs` | Lead intake history |
| `GET/POST/DELETE /api/v1/businesses/:businessId/lead-sources[/website]` | Lead sources and website API keys |
| `POST /api/v1/leads/intake` | Public website lead intake (keyed) |
| `GET /api/v1/businesses/:businessId/integrations/meta/webhook-events[/:eventId]` | Webhook delivery history and detail |
| `POST /api/v1/businesses/:businessId/integrations/meta/webhook-events/:eventId/retry` | Retry a failed delivery |
| `GET/POST /api/v1/businesses/:businessId/campaigns` | Campaign list and creation |
| `GET/PATCH/DELETE /api/v1/businesses/:businessId/campaigns/:campaignId` | Campaign detail, edits and deletion |
| `PATCH /api/v1/businesses/:businessId/campaigns/:campaignId/status` | Activate, pause or archive a campaign |
| `POST /api/v1/businesses/:businessId/campaigns/:campaignId/publish` | Queue a Meta publish |
| `POST /api/v1/businesses/:businessId/campaigns/sync` | Synchronise all published campaigns |
| `POST /api/v1/businesses/:businessId/campaigns/:campaignId/sync` | Synchronise one campaign |
| `GET/POST /api/v1/businesses/:businessId/campaigns/:campaignId/ad-sets` | Ad sets for a campaign |
| `GET /api/v1/businesses/:businessId/ad-sets` | Ad sets across campaigns |
| `PATCH/DELETE /api/v1/businesses/:businessId/ad-sets/:adSetId` | Ad set edits and deletion |
| `PATCH /api/v1/businesses/:businessId/ad-sets/:adSetId/status` | Update an ad set status |
| `GET/POST /api/v1/businesses/:businessId/ad-sets/:adSetId/advertisements` | Advertisements for an ad set |
| `GET/PATCH/DELETE /api/v1/businesses/:businessId/advertisements/:advertisementId` | Advertisement detail and edits |
| `PATCH /api/v1/businesses/:businessId/advertisements/:advertisementId/status` | Update an advertisement status |
| `GET/POST /api/v1/businesses/:businessId/creatives` | Creative list and creation |
| `PATCH/DELETE /api/v1/businesses/:businessId/creatives/:creativeId` | Creative edits and deletion |
| `GET/POST /api/v1/businesses/:businessId/assets` | Media library and uploads |
| `GET /api/v1/businesses/:businessId/assets/:assetId/content` | Authenticated media content |
| `DELETE /api/v1/businesses/:businessId/assets/:assetId` | Delete unused media |
| `GET/POST /api/v1/businesses/:businessId/approvals` | Approval list and creation |
| `GET /api/v1/businesses/:businessId/approvals/policies` | Approval policy state |
| `PATCH /api/v1/businesses/:businessId/approvals/policies/:targetType` | Enable or disable a policy |
| `GET /api/v1/businesses/:businessId/approvals/:approvalId` | Approval detail with versions and decisions |
| `POST /api/v1/businesses/:businessId/approvals/:approvalId/versions` | Submit a new payload version |
| `POST /api/v1/businesses/:businessId/approvals/:approvalId/decision` | Approve or reject |
| `POST /api/v1/businesses/:businessId/approvals/:approvalId/execute` | Retry an approved execution |
| `POST /api/v1/businesses/:businessId/approvals/:approvalId/cancel` | Cancel a pending request |
| `GET/POST /api/v1/businesses/:businessId/budgets` | Budget list and creation |
| `GET/PATCH/DELETE /api/v1/businesses/:businessId/budgets/:budgetId` | Budget detail, edits and deletion |
| `POST /api/v1/businesses/:businessId/budgets/:budgetId/snapshots` | Record a manual spend snapshot |
| `GET /api/v1/businesses/:businessId/budgets/alerts` | Spend alert list |
| `PATCH /api/v1/businesses/:businessId/budgets/alerts/:alertId/acknowledge` | Acknowledge a spend alert |
| `GET/POST /api/v1/businesses/:businessId/automation/rules` | Automation rule list and creation |
| `GET/PATCH/DELETE /api/v1/businesses/:businessId/automation/rules/:ruleId` | Rule detail, edits and deletion |
| `POST /api/v1/businesses/:businessId/automation/rules/:ruleId/run` | Queue a manual rule run |
| `GET/POST /api/v1/businesses/:businessId/automation/scheduled-actions` | Scheduled action list and creation |
| `POST /api/v1/businesses/:businessId/automation/scheduled-actions/:actionId/cancel` | Cancel a scheduled action |
| `GET /api/v1/businesses/:businessId/automation/executions[/:executionId]` | Execution history and detail |
| `POST /api/v1/businesses/:businessId/automation/executions/:executionId/retry` | Re-queue a failed execution |
| `POST /api/v1/businesses/:businessId/automation/dispatch` | Dispatch due schedules and event rules |
| `GET/POST /api/v1/businesses/:businessId/bulk-operations` | Bulk operation list and creation |
| `GET /api/v1/businesses/:businessId/bulk-operations/:operationId` | Bulk detail with per-item results |
| `POST /api/v1/businesses/:businessId/bulk-operations/:operationId/retry` | Retry only failed items |
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

## Meta integrations

Each business connects its own Meta assets from the **Integrations** tab on the business
detail screen. The dashboard shows connection health, token expiry, granted permissions and
the discovered Business Portfolios, Facebook Pages, Instagram business accounts and ad
accounts. Owners and admins can connect, reconnect, refresh, validate or disconnect.

- OAuth starts from `POST .../integrations/meta/oauth/start`. The API stores a hashed,
  single-use, business-bound state (10-minute TTL) and returns the Meta dialog URL.
- The public callback exchanges the code, upgrades it to a long-lived token, verifies it with
  `debug_token`, encrypts it, records the permissions and discovers assets. It then redirects
  to the business screen with `?meta=connected|reconnected|error&reason=...`.
- Confidential System User tokens can be supplied by server administrators through
  `POST .../system-user` instead of browser OAuth.
- Every access token is stored only as AES-256-GCM ciphertext with a key version. The API
  never returns tokens, and the frontend never receives them.
- Validation detects expired or revoked credentials, clears the credential, flags
  `requiresReauthorization` and records an audit entry. Missing scopes produce `attention`
  with the exact missing permissions.
- Health values are `not_connected`, `healthy`, `attention`, `expired` and `revoked`. A
  scheduled worker sweeps connected credentials every six hours, and the platform-only
  `monitor/sweep` endpoint remains available for operators.

Configure `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`,
`META_WEBHOOK_VERIFY_TOKEN` and `INTEGRATION_ENCRYPTION_KEY` (32 bytes as hex or base64).
`META_OAUTH_SCOPES` controls the requested permissions; `META_GRAPH_BASE_URL` and
`META_DIALOG_BASE_URL` allow sandbox or proxy deployments. Production startup fails without a
valid encryption key.

## Meta webhooks and lead capture

Lead Ads submissions arrive through `POST /webhooks/meta` and website forms through
`POST /leads/intake`. Both feed the same lead CRM, visible in the **Leads** tab on the
business detail screen.

- Register the callback in the Meta app with the `leadgen` subscription and the same
  `META_WEBHOOK_VERIFY_TOKEN`. The API answers the `hub.challenge` handshake and verifies
  `X-Hub-Signature-256` over the raw body with `META_APP_SECRET`.
- Every delivery is stored in `webhook_events` with a deterministic idempotency key before a
  fast `200` response. The `lead-processing` BullMQ worker resolves the Facebook Page to a
  business, decrypts the stored token, fetches the lead from the Graph API and normalises the
  form fields.
- Duplicate deliveries are ignored at the event level, and leads are deduplicated by Meta
  leadgen ID. Distinct leadgen IDs are never merged just because they share a phone or email.
- Website forms authenticate with an `x-adpilot-lead-key` header. Keys are issued, rotated and
  revoked from the Leads tab; only a SHA-256 hash and the last four characters are stored, and
  the raw key is shown once. Supply an optional `externalId` for idempotent retries.
- Failed events stay `failed` with the error and can be retried from the Integrations tab or
  `POST .../webhook-events/:eventId/retry`. Processing attempts, durations and messages are
  recorded in `webhook_processing_logs`; intake outcomes are recorded in `lead_sync_logs`.
- Lead details need the `leads_retrieval` permission on the Meta connection. The API never
  returns Meta tokens or their ciphertext, and all lead routes enforce business isolation.

## Campaign management

The **Campaigns** tab on the business detail screen builds campaigns, ad sets, advertisements,
creatives and a media library, then publishes them to the connected Meta ad account.

- A campaign is created as a draft with an objective, Meta ad account, budget and schedule;
  ad sets add optimisation goal, billing event, budgets, bid, targeting and dates; each
  advertisement links one creative.
- Publishing is queued and processed asynchronously. AdPilot creates the campaign, its ad sets,
  its advertisements and pushes creatives before stamping external IDs, so a failed Graph call
  sets `error` and leaves the campaign unpublished.
- Local status (`draft`, `publishing`, `active`, `paused`, `archived`, `error`), raw
  `externalStatus`, normalised `deliveryStatus` and `metaReviewStatus` are stored separately.
  Review and status histories are recorded on every transition.
- Published structure is locked against edits and deletes. Status changes are pushed to Meta
  before the local record changes, and `sync` refreshes delivery and review state.
- Media uploads accept PNG, JPEG and WebP up to 8 MB. Files are checksummed, stored under a
  generated key and served only through an authenticated content endpoint.
- Tokens stay server-side throughout; advertising responses never include credentials, and all
  campaign routes enforce business isolation. Live publishing requires a connected Meta ad
  account and the `ads_management` permission.

## Approvals and budgets

The **Approvals** and **Budgets** tabs on the business detail screen let owners constrain
sensitive advertising actions and track spend against client and campaign limits.

- Each business has three approval policies: campaign publishing, campaign status changes and
  budget changes. They default to off. When a policy is enabled, callers without
  `approval.decide` receive `202` with `approvalRequired: true` instead of a direct mutation;
  owners and admins keep acting directly.
- A request records the action payload, requester, optional assigned approver, reason and
  expiry. Payloads are immutable versions with SHA-256 hashes: resubmitting a changed action
  appends a version and invalidates the previous approval, and deciding an older version returns
  `409`.
- Approvers decide with an optional reason. Self-decisions are rejected and assigned approvers
  must hold `approval.decide`. The decision updates state conditionally on `pending`, so two
  approvers cannot both win.
- An approval triggers its action immediately. Failures are stored on the request with
  `executionStatus = failed` and the error, and `POST .../execute` retries without approving
  again. Pending requests expire lazily after 7 days by default.
- Budgets can be client level or campaign level, monthly or total, in one currency with a
  percentage alert threshold. Every create, update and delete writes a ledger transaction linked
  to the enabling approval.
- Campaign sync records spend from Meta insights as a `meta_sync` snapshot. Manual snapshots
  support finance reconciliation. Crossing the threshold opens one alert per budget, period and
  threshold; alerts can be acknowledged and are updated as spend changes.
- Budgets govern AdPilot reporting and alerts; they do not change the budget on Meta. Approval
  and Meta states stay separate, so a campaign is never marked published because an approval
  was approved.

## Automation and reliability

The **Automation** tab on the business detail screen schedules campaign changes, reacts to Meta
events and runs bulk operations, all with durable execution history.

- Rules have three triggers: a schedule (one-off or repeated in minutes), a rejected campaign
  review and an open budget threshold alert. Actions are pause, resume, archive, sync and
  notify. Notifications are recorded in the execution result for Phase 8 delivery.
- Scheduled actions run once at a chosen future time and can be cancelled; cancelling also
  skips their pending executions. The API registers a BullMQ repeatable dispatcher every
  minute, and `POST .../automation/dispatch` runs the same sweep on demand for one business.
- Dispatch and execution are idempotent: dispatcher claims use conditional status updates,
  executions carry a unique idempotency key, and workers hold expiring distributed locks.
  Duplicate dispatches, repeated job deliveries and concurrent workers cannot run an action
  twice.
- Transient failures (Meta rate limits, 5xx, timeouts) retry with exponential backoff and full
  jitter up to three attempts, then move to the dead-letter queue. Validation, permission and
  policy failures fail immediately. Failed, skipped and dead-letter executions can be retried
  from the history table.
- Bulk pause, resume, archive and sync operations process up to 100 campaigns independently.
  Each item keeps its own attempts, error and result, and the operation reports `completed`,
  `partial` or `failed`. Retrying a partial operation resets and re-runs only failed items.
- Automations and bulk operations honour the `automation.execute` and `bulk.execute` approval
  policies. Requesters without decision rights queue a request that executes the stored action
  after approval.
- Token monitoring runs a scheduled sweep every six hours over connected Meta credentials in
  addition to the platform-only manual sweep endpoint. Run data stays server-side and no token
  is ever queued or returned.

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
  audit), client ownership after an agency relationship ends, Meta OAuth, encrypted token
  storage, permission drift, asset discovery, revoked access and reauthorization, the
  webhook/lead pipeline (challenge verification, HMAC rejection, idempotent deliveries, lead
  normalisation, website keys and intake, failed-event retry and tenant isolation), and the
  campaign pipeline (structure CRUD, media validation, creative deletion guards, publish and
  external ID storage, structure locking, status push ordering, rejected child publishes,
  review sync and tenant isolation), and the approvals and budgets pipeline (policy gating,
  payload versioning and stale-version rejection, self-decision and eligibility checks,
  execution failure and retry, budget ledger, Meta spend snapshots, threshold alerts,
  acknowledgement and tenant isolation), and the automation and reliability pipeline (rule and
  schedule dispatch, duplicate-dispatch prevention, rejected-campaign and budget events,
  automation and bulk approval gating, transient retry and dead-letter handling, partial bulk
  failures with failed-item-only retries, and the token monitoring sweep). Meta calls and queue
  producers are mocked, so no live credentials are required.
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
- Meta access tokens are encrypted at rest with AES-256-GCM and a versioned key; only the
  ciphertext is persisted, and `INTEGRATION_ENCRYPTION_KEY` is required in production.
- OAuth states are hashed, single use and expire after 10 minutes.
- Meta webhook signatures are verified against the raw request body with a timing-safe
  comparison; rejected deliveries are never stored.
- Website lead keys are stored only as SHA-256 hashes with a four-character hint and can be
  rotated or revoked at any time.
- Uploaded ad media is type- and size-validated, stored outside the web root under a generated
  key and served only to authorized business members.
- Approval payloads are immutable, hash-verified before execution and decided only by callers
  holding `approval.decide`; self-decisions are rejected. Budget ledger and spend snapshots are
  append-only.
- Automation and bulk executions use database idempotency keys, conditional claims and
  expiring distributed locks so retries, duplicate jobs and concurrent workers cannot repeat a
  Meta mutation. Queue payloads contain identifiers only, and dead letters retain no secrets.
- Tenant isolation is enforced in the backend, never by frontend filtering alone.
