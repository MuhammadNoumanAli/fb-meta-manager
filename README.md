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

5. Run both applications in separate terminals:

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
| `GET /api/docs` | Swagger UI |

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
  configured through `apps/api/.env`.
- Frontend unit tests run with Vitest.

## Delivery process

Work proceeds phase by phase per the architecture blueprint. Each phase must satisfy its
acceptance criteria before the next begins. Progress, decisions and known issues are tracked
in [DEVELOPMENT_PROGRESS.md](DEVELOPMENT_PROGRESS.md).

## Security notes

- Never commit credentials or tokens.
- Integration secrets stay server-side; tokens are never exposed to the frontend.
- Tenant isolation is enforced in the backend, never by frontend filtering alone.
