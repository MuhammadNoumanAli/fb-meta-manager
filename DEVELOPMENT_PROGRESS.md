# AdPilot Development Progress

**Current phase:** Phase 6 — Approval and Budget Management (complete)
**Last updated:** 2026-11-17
**API version:** 0.7.0
**Blueprint:** [docs/ADPILOT_TECHNICAL_ARCHITECTURE_v2.0.md](docs/ADPILOT_TECHNICAL_ARCHITECTURE_v2.0.md)

---

## Phase 6 — Approval and Budget Management

### Scope delivered

- [x] Per-business approval policies for campaign publishing, campaign status and budget changes
- [x] Approval requests with requester, optional assigned approver, target, reason and expiry
- [x] Immutable payload versions with canonical SHA-256 hashes
- [x] Approve and reject decisions pinned to a payload version; stale versions return `409`
- [x] Self-decisions blocked; assigned approvers must hold `approval.decide`
- [x] Execution of approved actions with captured failures and a retry endpoint
- [x] Cancellation and lazy expiry of stale requests
- [x] Publishing, status changes and budget mutations gated by enabled policies
- [x] Business-level (client) and campaign-level budgets with monthly or total periods
- [x] Budget transaction ledger with approval links for every mutation
- [x] Spend snapshots from Meta insights sync and manual reconciliation
- [x] Threshold alerts with open/acknowledged states and per-period dedupe
- [x] Approvals and Budgets tabs on the business detail screen

### Database migrations

| Migration | Status |
|---|---|
| `1767000000000-Phase6ApprovalsAndBudgets` | Applied locally |

Adds `approval_policies`, `approval_requests`, `approval_versions`, `approval_decisions`,
`budgets`, `budget_transactions`, `spend_snapshots` and `budget_alerts`. Clearance is governed
by `approval_policies` and `approval_requests`; a unique index allows one policy per business
and target type, one campaign budget per campaign and one business-scope budget per business.
Business deletion cascades approvals, versions, decisions, budgets, transactions, snapshots and
alerts, while actor references are `SET NULL` where the history must survive.

### API endpoints

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/api/v1/businesses/:businessId/approvals` | `campaign.read` | List approvals with status, mine and target filters |
| GET | `/api/v1/businesses/:businessId/approvals/policies` | `campaign.read` | Read the three policy switches |
| PATCH | `/api/v1/businesses/:businessId/approvals/policies/:targetType` | `approval.decide` | Enable or disable an approval policy |
| POST | `/api/v1/businesses/:businessId/approvals` | `approval.request` | Create an approval request |
| GET | `/api/v1/businesses/:businessId/approvals/:approvalId` | `campaign.read` | Detail with payload versions and decisions |
| POST | `/api/v1/businesses/:businessId/approvals/:approvalId/versions` | `approval.request` | Append a new payload version |
| POST | `/api/v1/businesses/:businessId/approvals/:approvalId/decision` | `approval.decide` | Approve or reject a version |
| POST | `/api/v1/businesses/:businessId/approvals/:approvalId/execute` | `approval.decide` | Retry a failed approved execution |
| POST | `/api/v1/businesses/:businessId/approvals/:approvalId/cancel` | `approval.request` | Cancel a pending request |
| GET | `/api/v1/businesses/:businessId/budgets` | `campaign.read` | List budgets with usage and alert counts |
| POST | `/api/v1/businesses/:businessId/budgets` | `budget.manage` | Create a budget (direct or gated) |
| GET | `/api/v1/businesses/:businessId/budgets/:budgetId` | `campaign.read` | Detail with transactions, snapshots and alerts |
| PATCH | `/api/v1/businesses/:businessId/budgets/:budgetId` | `budget.manage` | Update a budget (gated on amount and state changes) |
| DELETE | `/api/v1/businesses/:businessId/budgets/:budgetId` | `budget.manage` | Delete a budget (gated) |
| POST | `/api/v1/businesses/:businessId/budgets/:budgetId/snapshots` | `budget.manage` | Record a manual spend snapshot |
| GET | `/api/v1/businesses/:businessId/budgets/alerts` | `campaign.read` | List spend alerts by status |
| PATCH | `/api/v1/businesses/:businessId/budgets/alerts/:alertId/acknowledge` | `budget.manage` | Acknowledge a spend alert |

Approval target types are `campaign.publish`, `campaign.status` and `budget.change`. When a
policy is enabled and the caller lacks `approval.decide`, the action returns `202` with
`approvalRequired: true` and an approval record; nothing is mutated. Approvers continue to act
directly. Requests expire after 7 days by default (configurable from 1 to 30), and decisions use
a conditional update on `status = pending` so concurrent decisions cannot both succeed.

Payload versions are immutable and content-addressed. Submitting the same action again for the
same pending target and requester appends a version and resets approval and execution state, so
an approved but altered payload always needs a fresh decision. Execution compares the approved
version, its hash and the current version before the handler runs. A failed execution is stored
with `executionStatus = failed` and can be retried through `POST .../execute`.

Budgets are AdPilot-side governance controls, not Meta budget edits. A budget targets a business
(client level) or a campaign, with a monthly or total period, amount, currency, threshold percent
and optional notes. Spend is derived from the latest snapshot; creation, updates and deletion
write ledger entries linked to the enabling approval. Meta spend is read from campaign insights
(`date_preset=this_month`) during campaign sync and recorded as a `meta_sync` snapshot; manual
snapshots support finance reconciliation. Crossing the threshold opens one alert per budget,
period and threshold, and the alert is updated without reopening once spend is corrected.

### Frontend screens

| Screen | Route | Status |
|---|---|---|
| Business detail — Approvals tab (policies, filters, decisions) | `/businesses/:businessId?tab=approvals` | Complete |
| Business detail — Budgets tab (usage, alerts, budget dialog) | `/businesses/:businessId?tab=budgets` | Complete |
| Campaign publish and status flows show pending approval state | `/businesses/:businessId?tab=campaigns` | Complete |

### Security properties

- Approval, budget, snapshot and alert routes resolve permissions through the business guard;
  cross-tenant identifiers return `404`.
- Payload versions are immutable and hash-verified before execution, so an approved action cannot
  be altered silently between decision and execution.
- Only callers with `approval.decide` can decide, execute or change policies; self-decisions are
  rejected and assigned approvers are validated against the permission.
- Decisions are written with actor, reason and timestamp; ledger and snapshot records are
  append-only for audit.
- Spend sync decrypts the business Meta token inside the API process only; no token or ciphertext
  is returned by any approval or budget endpoint.
- Approval state and Meta state remain separate: a campaign is published only when execution
  succeeds, and local status is never inferred from an approval.

### Verification

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | Pass (API + web) |
| Typecheck | `npm run typecheck` | Pass (API + web) |
| API unit tests | `npm run test -w @adpilot/api` | Pass (5 suites, 24 tests) |
| Web unit tests | `npm run test -w @adpilot/web` | Pass (3 files, 18 tests) |
| API e2e (MySQL + Redis) | `npm run test:e2e -w @adpilot/api` | Pass (7 suites, 72 tests) |
| Build | `npm run build` | Pass (API dist + web dist) |
| Browser flow | enable policy → publish through approval → create budget → sync spend → alert | Pass |
| Acceptance criteria | restricted changes require approval; changed payloads renew approval; spend alerts generated; internal and Meta statuses separate | Pass |

Meta calls in tests use a mocked advertising provider and queue; no live Graph publishing is
performed.

### Known issues / limitations

- Approval notifications are in-app only. Email and WhatsApp delivery arrives with Phase 8.
- Spend synchronisation runs during campaign sync; a scheduled spend poller is part of the
  reliability work in Phase 7.
- Budgets are governance records. They do not change the budget on Meta; budget write-back
  depends on Meta change APIs.
- A budget has one currency. Multi-currency reporting is deferred to Phase 9.
- Threshold alerts are per budget, period and threshold; escalation chains are not implemented.

### Decisions requiring approval

- Payloads are versioned and hash-pinned instead of mutable requests, so any edit invalidates a
  prior approval by construction.
- Execution runs synchronously when a request is approved, with an explicit retry endpoint for
  failures, so approvals never hide a failed Meta call.
- Budget mutations bypass approval for callers who already hold `approval.decide`; this keeps
  owners and admins unblocked while still gating restricted roles.
- Spend snapshots are append-only; corrections are new snapshots rather than edits so alert
  history stays explainable.

---

## Phase 5 — Campaign and Advertisement Management

### Scope delivered

- [x] Campaign CRUD with objective, Meta ad account, budgets, schedule and special ad categories
- [x] Ad set CRUD with optimisation goal, billing event, budgets, bid, schedule and JSON targeting
- [x] Advertisement CRUD linked to an ad set and a creative
- [x] Creative management with headline, body, description, call to action, destination and Meta page
- [x] Media uploads (PNG/JPEG/WebP, 8 MB limit) with checksum, disk storage and authenticated previews
- [x] Meta campaign publishing through the advertising provider abstraction and a BullMQ queue
- [x] Campaign status push (activate, pause, archive) with Meta-first ordering
- [x] Campaign and campaign-list synchronisation of Meta state
- [x] Separate local status, raw external status, delivery status and Meta review status
- [x] Review and status history timelines per campaign
- [x] Failure handling that never marks a campaign published when any Meta call fails
- [x] Campaigns UI with builder, creative manager, media library, publish checklist and live state

### Database migrations

| Migration | Status |
|---|---|
| `1766000000000-Phase5Campaigns` | Applied locally |

Adds `assets`, `creatives`, `campaigns`, `ad_sets`, `advertisements`, `campaign_status_history`,
`meta_review_status_history` and `platform_sync_logs`. Campaign structure is scoped by
`business_id`; deleting a business cascades its campaigns, creatives and assets, while
author/deleter references are `SET NULL`. Unique indices prevent duplicate storage keys and
duplicate history entries; hot list paths are indexed by business, status and creation time.

### API endpoints

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/api/v1/businesses/:businessId/campaigns` | `campaign.read` | List, search, filter and paginate campaigns |
| POST | `/api/v1/businesses/:businessId/campaigns` | `campaign.create` | Create a draft campaign |
| POST | `/api/v1/businesses/:businessId/campaigns/sync` | `campaign.read` | Synchronise every published campaign |
| GET | `/api/v1/businesses/:businessId/campaigns/:campaignId` | `campaign.read` | Campaign detail with ad sets, ads and histories |
| PATCH | `/api/v1/businesses/:businessId/campaigns/:campaignId` | `campaign.update` | Edit a draft campaign |
| DELETE | `/api/v1/businesses/:businessId/campaigns/:campaignId` | `campaign.update` | Delete a draft campaign |
| PATCH | `/api/v1/businesses/:businessId/campaigns/:campaignId/status` | `campaign.update` | Activate, pause or archive |
| POST | `/api/v1/businesses/:businessId/campaigns/:campaignId/publish` | `campaign.publish` | Queue a Meta publish (`202`) |
| POST | `/api/v1/businesses/:businessId/campaigns/:campaignId/sync` | `campaign.read` | Refresh one campaign from Meta |
| GET/POST | `/api/v1/businesses/:businessId/campaigns/:campaignId/ad-sets` | `campaign.read` / `campaign.create` | List or add ad sets |
| GET | `/api/v1/businesses/:businessId/ad-sets` | `campaign.read` | List ad sets across campaigns |
| PATCH/DELETE | `/api/v1/businesses/:businessId/ad-sets/:adSetId` | `campaign.update` | Edit or delete an ad set |
| PATCH | `/api/v1/businesses/:businessId/ad-sets/:adSetId/status` | `campaign.update` | Update ad set status |
| GET/POST | `/api/v1/businesses/:businessId/ad-sets/:adSetId/advertisements` | `campaign.read` / `campaign.create` | List or add advertisements |
| GET/PATCH/DELETE | `/api/v1/businesses/:businessId/advertisements/:advertisementId` | `campaign.read` / `campaign.update` | Advertisement detail and edits |
| PATCH | `/api/v1/businesses/:businessId/advertisements/:advertisementId/status` | `campaign.update` | Update advertisement status |
| GET/POST | `/api/v1/businesses/:businessId/creatives` | `campaign.read` / `campaign.create` | List or create creatives |
| PATCH/DELETE | `/api/v1/businesses/:businessId/creatives/:creativeId` | `campaign.update` | Edit or delete a creative |
| GET/POST | `/api/v1/businesses/:businessId/assets` | `campaign.read` / `campaign.create` | List or upload media |
| GET | `/api/v1/businesses/:businessId/assets/:assetId/content` | `campaign.read` | Stream the authenticated media file |
| DELETE | `/api/v1/businesses/:businessId/assets/:assetId` | `campaign.create` | Delete unused media |

Local status is `draft`, `publishing`, `active`, `paused`, `archived` or `error`. The raw Meta
status is stored separately as `externalStatus`, while `deliveryStatus` (`active`, `paused`,
`archived`, `deleted`, `pending_billing_info`, `in_process`, `with_issues`, `unknown`) and
`metaReviewStatus` (`unknown`, `in_review`, `approved`, `rejected`, `disabled`) are normalised
by the status mapper.

### Frontend screens

| Screen | Route | Status |
|---|---|---|
| Business detail — Campaigns tab (list, filters, create dialog) | `/businesses/:businessId?tab=campaigns` | Complete |
| Campaign detail panel (structure, publish checklist, histories) | `/businesses/:businessId?tab=campaigns` | Complete |
| Creatives and media sub-tab (creative editor, media library) | `/businesses/:businessId?tab=campaigns` | Complete |

### Security properties

- Publishing decrypts the business Meta token inside the API process only. No token, ciphertext
  or Graph credential is returned by any advertising endpoint.
- Every campaign, ad set, advertisement, creative, asset and history query is scoped through
  the business permission guard; cross-tenant identifiers return `404`.
- Uploaded media is validated by MIME type and size, stored under a generated storage key and
  served only through an authenticated endpoint. Original file names are metadata only.
- Publishing is idempotent: a campaign already `publishing` or published cannot be queued or
  recreated, and the job runs with a single attempt.
- Local `publishedAt`, external IDs and Meta state are written only after every required Graph
  call succeeds. A failure sets `error`, stores `lastError` and leaves the campaign unpublished.
- Edits and deletes on pushed or published records are blocked so AdPilot cannot silently
  diverge from Meta.
- Status changes, publish requests, publish outcomes and review transitions are written to
  audit and history tables.

### Verification

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | Pass (API + web) |
| Typecheck | `npm run typecheck` | Pass (API + web) |
| API unit tests | `npm run test -w @adpilot/api` | Pass (5 suites, 24 tests) |
| Web unit tests | `npm run test -w @adpilot/web` | Pass (3 files, 18 tests) |
| API e2e (MySQL + Redis) | `npm run test:e2e -w @adpilot/api` | Pass (6 suites, 63 tests) |
| Build | `npm run build` | Pass (API dist + web dist) |
| Browser flow | create campaign → add ad set → upload media → create creative → publish checklist | Pass |
| Acceptance criteria | campaigns created through AdPilot, external IDs stored, review state visible, rejected publishes stay unpublished | Pass |

Meta calls in tests use a mocked advertising provider; no live Graph publishing is performed.

### Known issues / limitations

- Publishing is asynchronous. The UI polls the campaign for up to 30 seconds after a queued
  publish; longer Meta outages require the user to refresh.
- Sync updates state and review status but does not import Meta campaigns created outside
  AdPilot; that import flow arrives with reliability work in Phase 7.
- Media lives on the API host's local disk. Object storage and signed CDN URLs are a deployment
  concern; the storage key boundary already isolates the location.
- Creatives support a single image asset. Video, carousel and dynamic creative formats are not
  implemented yet.
- Only the Meta advertising provider exists. The provider interface is ready for Google and
  TikTok in Phase 13.

### Decisions requiring approval

- AdPilot keeps its own lifecycle status instead of mirroring Meta's status values, so a Meta
  API failure can never be mistaken for a successful publish.
- Campaign structure is locked once published. Further changes must be made in Meta Ads Manager
  until Meta change APIs are integrated in Phase 7.
- Publishing continues through ad sets and advertisements after the campaign is created; a
  child failure aborts the job and marks the campaign `error` without inventing external IDs.
- Ad set targeting is entered as JSON and validated for structure only; richer targeting
  builders are deferred.

---

## Phase 4 — Meta Webhooks and Lead Integration

### Scope delivered

- [x] Public Meta webhook subscription challenge (`hub.mode`, `hub.verify_token`, `hub.challenge`)
- [x] Raw-body HMAC-SHA256 verification of `X-Hub-Signature-256` on every delivery
- [x] Immutable webhook event storage with provider-scoped idempotency keys
- [x] Fast `200` acknowledgement after storage; Graph work runs on the `lead-processing` queue
- [x] Leadgen processing: page→business resolution, encrypted token decryption, lead detail retrieval and field normalisation
- [x] Lead-level dedupe with a SHA-256 of the Meta leadgen ID and a unique index
- [x] Lead sync logs and webhook processing logs for every intake attempt
- [x] Lead list, search, filter, detail and status update APIs with an audit trail
- [x] Website lead intake API with one-time, hash-only keys that can be issued, rotated and revoked
- [x] Business-scoped webhook delivery history, event detail and retry for failed events
- [x] Frontend Leads tab with filters, inline status updates, detail dialog, key management and intake activity
- [x] Integrations tab webhook deliveries table with status, attempts, error and retry controls

### Database migrations

| Migration | Status |
|---|---|
| `1765000000000-Phase4LeadWebhooks` | Applied locally |

Adds `webhook_events`, `webhook_processing_logs`, `lead_sources`, `leads` and `lead_sync_logs`
with unique dedupe/idempotency indices. Deleting a business cascades leads, sources, sync logs
and webhook events; authorization references are `SET NULL` when a connection is removed.

### API endpoints

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/api/v1/webhooks/meta` | Public (verify token) | Answer the Meta subscription challenge |
| POST | `/api/v1/webhooks/meta` | Public (signature) | Receive signed webhook deliveries |
| GET | `/api/v1/businesses/:businessId/leads` | `lead.read` | List, search, filter and paginate leads |
| GET | `/api/v1/businesses/:businessId/leads/sync-logs` | `lead.read` | Recent intake history |
| GET | `/api/v1/businesses/:businessId/leads/:leadId` | `lead.read` | Lead detail |
| PATCH | `/api/v1/businesses/:businessId/leads/:leadId` | `lead.manage` | Update lead status |
| GET | `/api/v1/businesses/:businessId/lead-sources` | `lead.read` | Configured lead sources and key hints |
| POST | `/api/v1/businesses/:businessId/lead-sources/website` | `lead.manage` | Issue or rotate the website key |
| DELETE | `/api/v1/businesses/:businessId/lead-sources/website` | `lead.manage` | Revoke the website key |
| POST | `/api/v1/leads/intake` | Public (`x-adpilot-lead-key`) | Ingest a website lead |
| GET | `/api/v1/businesses/:businessId/integrations/meta/webhook-events` | `integration.read` | Webhook delivery history |
| GET | `/api/v1/businesses/:businessId/integrations/meta/webhook-events/:eventId` | `integration.read` | Delivery detail with processing logs |
| POST | `/api/v1/businesses/:businessId/integrations/meta/webhook-events/:eventId/retry` | `integration.manage` | Retry a failed or received delivery |

Webhook event statuses are `received`, `processing`, `processed`, `failed` and `ignored`.
Lead statuses are `new`, `contacted`, `qualified`, `converted` and `disqualified`; consent is
`unknown`, `granted` or `denied`.

### Frontend screens

| Screen | Route | Status |
|---|---|---|
| Business detail — Leads tab (filters, status, detail, website API) | `/businesses/:businessId?tab=leads` | Complete |
| Business detail — Integrations tab webhook deliveries | `/businesses/:businessId?tab=integrations` | Complete |

### Security properties

- Signatures are verified against the exact raw request bytes with a timing-safe comparison.
  Missing, malformed or invalid signatures return `403` and nothing is stored; malformed
  payloads with a valid signature return `400`.
- The challenge token is compared in constant time and the endpoint echoes only the provided
  challenge.
- Webhook events never contain provider credentials. Lead processing decrypts the business
  token in memory only, and API responses expose neither the token nor its ciphertext.
- Idempotency is deterministic: `sha256("meta:leadgen:<leadgen_id>")` for lead ads and a hash
  of the entry/change for other fields. A duplicate delivery cannot create a second event or
  lead.
- Website API keys are `adp_` plus 48 random hex characters. Only the SHA-256 hash and the
  last four characters are persisted; the raw key is returned once and key rotation
  invalidates the previous key immediately.
- Leads are deduplicated by source identifier only, never by phone or email, so two distinct
  Meta leads sharing contact details stay distinct.
- Every lead, source and webhook-event route resolves the business through the permission
  guard; cross-tenant access returns `404`.
- Status changes and retries write audit records (`lead.status_changed`, `webhook_event.retried`).

### Verification

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | Pass (API + web) |
| Typecheck | `npm run typecheck` | Pass (API + web) |
| API unit tests | `npm run test -w @adpilot/api` | Pass (4 suites, 19 tests) |
| Web unit tests | `npm run test -w @adpilot/web` | Pass (3 files, 18 tests) |
| API e2e (MySQL + Redis) | `npm run test:e2e -w @adpilot/api` | Pass (5 suites, 52 tests) |
| Build | `npm run build` | Pass (API dist + web dist) |
| Browser flow | key issue → intake → lead list/detail → intake activity → webhook deliveries | Pass |
| Acceptance criteria | signed leads processed, duplicates rejected, bad requests rejected, failed event retried | Pass |

### Known issues / limitations

- Live delivery requires a public HTTPS callback URL registered in the Meta app with the
  `leadgen` subscription and the same verify token. Local verification uses signed fixtures
  and a mocked Graph client.
- Lead details require the `leads_retrieval` permission. If it is missing after reauthorization,
  events fail and remain retryable until the connection is repaired.
- The queue consumer runs inside the API process. A dedicated worker deployment can be split
  out when traffic grows; the producer/consumer contract is already isolated.
- WhatsApp is a reserved lead source and arrives with the messaging phase.
- Website keys are rotated manually; automatic expiry per key is not implemented.

### Decisions requiring approval

- Webhook processing is at-least-once with dedupe on both the event and the lead, rather than
  exactly-once delivery. This is the standard Meta webhook contract.
- Website intake deduplicates only when the client supplies `externalId`; otherwise every
  submission is accepted.
- Failed events are retried manually from the UI or API. Duplicate deliveries of a failed
  event also requeue it automatically.

---

## Phase 3 — Meta Authentication and Asset Integration

### Scope delivered

- [x] Meta OAuth start endpoint that issues a single-use, hashed, business-scoped state
- [x] Public OAuth callback protected by state validation, expiry and one-time consumption
- [x] Code-for-token exchange plus long-lived (`fb_exchange_token`) upgrade
- [x] `debug_token` verification for app, user, scopes and expiry
- [x] Access tokens encrypted at rest with AES-256-GCM and a versioned key envelope
- [x] System User token intake for server-to-server connections
- [x] Permission tracking: requested scopes, granted permissions, missing permissions and drift
- [x] Business Portfolio, Facebook Page, Instagram business account and ad account discovery
- [x] Paginated Graph API discovery with transactional asset replacement
- [x] Integration health overview with reauthorization detection
- [x] Token monitoring foundation (validate now plus a platform-only sweep endpoint)
- [x] Best-effort permission revocation on disconnect, with token and asset cleanup
- [x] Token event ledger and audit entries for every integration state change
- [x] Frontend integrations tab with health, connect, reconnect, system user, assets and activity
- [x] OAuth return handling on the business detail screen (`?meta=connected|reconnected|error`)

### Database migrations

| Migration | Status |
|---|---|
| `1764000000000-Phase3MetaIntegrations` | Applied locally |

Adds `integration_authorizations`, `meta_oauth_states`, `meta_business_portfolios`,
`meta_pages`, `meta_instagram_accounts`, `meta_ad_accounts` and `integration_token_events`.
The migration also inserts the `integration.read` permission and grants it to agency owners,
agency admins, agency staff, business owners and business admins.

### API endpoints

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/api/v1/businesses/:businessId/integrations/meta` | `integration.read` | Health, token metadata, permissions and assets |
| GET | `/api/v1/businesses/:businessId/integrations/meta/events` | `integration.read` | Recent token and connection activity |
| POST | `/api/v1/businesses/:businessId/integrations/meta/oauth/start` | `integration.manage` | Create state and return the Meta authorization URL |
| POST | `/api/v1/businesses/:businessId/integrations/meta/system-user` | `integration.manage` | Connect with a System User token |
| POST | `/api/v1/businesses/:businessId/integrations/meta/validate` | `integration.manage` | Re-check the token and permissions now |
| POST | `/api/v1/businesses/:businessId/integrations/meta/discover` | `integration.manage` | Refresh discovered assets |
| DELETE | `/api/v1/businesses/:businessId/integrations/meta` | `integration.manage` | Disconnect and revoke permissions |
| GET | `/api/v1/integrations/meta/oauth/callback` | Public (state-bound) | Complete OAuth and redirect to the frontend |
| POST | `/api/v1/integrations/meta/monitor/sweep` | `platform.manage` | Validation sweep for the monitoring foundation |

`status` is one of `not_connected`, `healthy`, `attention`, `expired` or `revoked`.
`requiresReauthorization` is true when the credential is missing, expired or revoked.

### Frontend screens

| Screen | Route | Status |
|---|---|---|
| Business detail — integrations tab (health, connect, assets, activity) | `/businesses/:businessId?tab=integrations` | Complete |
| Meta OAuth return with snackbar feedback | `/businesses/:businessId?meta=...` | Complete |

### Security properties

- Raw access tokens are never stored: AES-256-GCM ciphertext with a 12-byte IV, auth tag and
  key version (`v1`) is the only persisted form. Tokens never appear in API responses or the
  frontend bundle.
- The encryption key comes from `INTEGRATION_ENCRYPTION_KEY` (32 bytes as hex or base64) and
  is mandatory in production. Development and test derive a deterministic key from the JWT
  access secret so local flows work without weakening production.
- OAuth state is 32 random bytes stored as a SHA-256 hash with a 10-minute expiry, bound to
  the business and initiating user, and consumed exactly once. Replays redirect with
  `reason=state_expired`.
- The callback is public only because Meta redirects the browser there; it cannot create or
  read a connection without a valid state row.
- Every integration route resolves the business through the permission guard, so another
  tenant's business returns `404` even with a valid session.
- Disconnect and revoked/expired detection clear the encrypted credential, remove discovered
  assets and write token events plus audit records.
- Tests use a mocked Graph client; no live Meta credentials or live API calls are required.

### Verification

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | Pass (API + web) |
| Typecheck | `npm run typecheck` | Pass (API + web) |
| API unit tests | `npm run test -w @adpilot/api` | Pass (3 suites, 14 tests) |
| Web unit tests | `npm run test -w @adpilot/web` | Pass (3 files, 16 tests) |
| API e2e (MySQL + Redis) | `npm run test:e2e -w @adpilot/api` | Pass (4 suites, 39 tests) |
| Build | `npm run build` | Pass (API dist + web dist) |
| Browser flow | connect → assets → permission warning → reconnect → health | Pass |
| Token protection | API responses and database contain no plaintext token | Pass |

### Known issues / limitations

- Live Meta OAuth requires an approved Meta app plus `META_APP_ID`, `META_APP_SECRET` and a
  registered `META_REDIRECT_URI`. Without them the API reports a configuration error and the
  UI surfaces it; CI and local verification use mocks.
- Token monitoring is a foundation only: `POST /integrations/meta/monitor/sweep` and the
  “Check access” action run validation on demand. A scheduled BullMQ job arrives with the
  monitoring worker phase.
- Discovery is best effort after OAuth. If Graph rejects an asset endpoint, the connection is
  still saved and assets can be refreshed later.
- The app requests the scopes configured in `META_OAUTH_SCOPES`; Meta may not grant all of
  them for every app review state. Missing scopes produce `attention` and are listed in the UI.
- WhatsApp Business assets are out of scope for this phase and arrive with the messaging phase.

### Decisions requiring approval

- One authorization row per business and provider, with `client_oauth` and `system_user`
  connection modes sharing the same encrypted token pipeline.
- Health thresholds for the monitoring foundation: expiring within 3 days or not validated
  in 7 days. These can be tuned when the scheduled monitor is introduced.

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
| 3 — Meta authentication and asset integration | Complete |
| 4 — Meta webhooks and lead integration | Complete |
| 5 — Campaign and advertisement management | Complete |
| 6 — Approval and budget management | Complete |
| 7 — Automation and reliability | Not started |
| 8 — WhatsApp Business integration | Not started |
| 9 — CRM, analytics and multi-currency | Not started |
| 10 — Self-service and hybrid experience | Not started |
| 11 — AI and fraud detection | Not started |
| 12 — Billing and commercial features | Not started |
| 13 — Google Ads and TikTok Ads | Not started |
| 14 — Production readiness and launch | Not started |
