# EnergyIQ Backend

EnergyIQ is an AI-powered energy management platform for Nigerian SMEs and African businesses. This repository contains the NestJS API that powers authentication, user management, health checks, and t

## Live URLs:
- [Staging](https://api.staging.energy-iq.hng14.com/api/docs)
- [Production](https://api.energy-iq.hng14.com/api/docs)

## What this service provides

- JWT authentication with access and refresh token flows.
- User lifecycle APIs for creating, listing, updating, and deleting users.
- A public health endpoint for uptime and deployment checks.
- Strict validation, global error handling, and consistent response envelopes.
- PostgreSQL persistence with TypeORM migrations and seeders.
- Swagger API documentation for local development and integration work.

## Tech Stack

- NestJS 11 and TypeScript
- PostgreSQL and TypeORM
- JWT authentication with Passport guards
- `class-validator`, `class-transformer`, and a global `ValidationPipe`
- Environment validation with `@t3-oss/env-core` and Zod
- Helmet, compression, structured logging, and a global exception filter

## Quick Start

### Prerequisites

- Node.js 20 or newer
- pnpm 9 or newer
- PostgreSQL 14 or newer

### Local setup

```bash
pnpm install
cp .env.example .env

# update .env with your database credentials and JWT secrets

pnpm migration:run
pnpm seed # optional
pnpm start:dev
```

If Swagger is enabled, open `http://localhost:3000/docs`. The public health check is available at `http://localhost:3000/health`.

## Environment

The application validates configuration at startup and fails fast on missing or invalid values. Start from `.env.example` and adjust it for your environment.

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Application mode |
| `PORT` | HTTP port |
| `HOST` | HTTP hostname (default: `localhost`) |
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` | PostgreSQL connection settings |
| `DATABASE_SYNC` | Keep `false` outside local experimentation; use migrations instead |
| `DATABASE_SSL` | Enable for managed PostgreSQL providers |
| `DATABASE_LOGGING` | Toggle TypeORM logging |
| `JWT_ACCESS_SECRET` | Access token signing secret |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifetime |
| `JWT_REFRESH_SECRET` | Refresh token signing secret |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime |
| `CORS_ORIGIN` | Comma-separated allowed origins or `*` |
| `SWAGGER_ENABLED` | Enable or disable Swagger |

## Scripts

### Application
| Script | Purpose |
|---|---|
| `pnpm start:dev` | Run the API in watch mode |
| `pnpm start:debug` | Run the API with the debugger attached |
| `pnpm start:prod` | Run the compiled application from `dist/` |
| `pnpm build` | Compile the project |
| `pnpm lint` | Lint and auto-fix supported issues |
| `pnpm format` | Format source and test files |

### Cleanup
| Script | Purpose |
|---|---|
| `pnpm clean` | Remove `node_modules`, `pnpm-lock.yaml`, `dist`, and build metadata |
| `pnpm rebuild` | Clean install dependencies and rebuild the project |
| `pnpm clean:rebuild` | Full cleanup and rebuild (clean + rebuild) |

### Quality gates
| Script | Purpose |
|---|---|
| `pnpm test` | Run unit tests |
| `pnpm test:watch` | Run unit tests in watch mode |
| `pnpm test:cov` | Generate coverage report |
| `pnpm test:debug` | Run tests with debugger attached |
| `pnpm test:e2e` | Run end-to-end tests |
| `pnpm validate` | Run lint, tests, and build in one command |

## Git Hooks

This repository uses Husky to run checks automatically at the Git stage level:

- `pre-commit` runs `lint-staged` on staged `*.ts` files so formatting and lint fixes happen before the commit is created.
- `commit-msg` runs `commitlint` to enforce conventional commit messages.
- `pre-push` runs `pnpm validate` to block pushes when lint, tests, e2e, or build fail.

After cloning the repository, run `pnpm install` once. The `prepare` script in `package.json` installs the hooks automatically during dependency installation, so you do not need to set Husky up manual

### Database
| Script | Purpose |
|---|---|
| `pnpm migration:run` | Apply pending migrations |
| `pnpm migration:revert` | Revert the latest migration |
| `pnpm migration:show` | Show migration status |
| `pnpm migration:generate <Name>` | Generate a migration in `src/database/migrations` from entity changes |
| `pnpm migration:create` | Create an empty migration |
| `pnpm schema:drop` | Drop the current database schema (use with caution) |
| `pnpm seed` | Run seeders |
| `pnpm db:reset` | Drop, migrate, and seed the database |

Use the short wrapper when creating a migration:

```bash
pnpm migration:generate CreateUserTable
```

The generated file is written to `src/database/migrations` automatically.

## API Surface

All application routes are prefixed with `/api/v1` except the health check. API versioning uses URI-based versioning; future versions will be available at `/api/v2`, `/api/v3`, etc. The health check r

### Health

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/health` | GET | Public | Liveness probe |

### Authentication

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/v1/auth/register` | POST | Public | Create a new account |
| `/api/v1/auth/login` | POST | Public | Authenticate and issue tokens |
| `/api/v1/auth/refresh` | POST | Public | Exchange a refresh token for a new access token |
| `/api/v1/auth/logout` | POST | Bearer token | Revoke the current refresh token |
| `/api/v1/auth/me` | GET | Bearer token | Return the current authenticated user |

### Users

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/v1/users` | POST | Bearer token | Create a user |
| `/api/v1/users` | GET | Bearer token | List users with pagination |
| `/api/v1/users/:id` | GET | Bearer token | Fetch a user by ID |
| `/api/v1/users/:id` | PATCH | Bearer token | Update a user |
| `/api/v1/users/:id` | DELETE | Bearer token | Delete a user |

The global JWT guard protects the API by default. Use the `@Public()` decorator for endpoints that should remain open.

## Response Format

All responses follow a standardized envelope for consistency. Success and error responses are handled by a global interceptor and exception filter.

### Success Response

```json
{
  "success": true,
  "message": "Resource retrieved successfully",
  "data": { },
  "meta": {
    "timestamp": "2026-05-03T12:34:56.000Z",
    "version": "1.0.0",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

Messages are drawn from the `SYS_MSG` constants (`src/common/constants/sys-msg.ts`) and selected automatically based on HTTP method and status code.

### Error Response

```json
{
  "success": false,
  "message": "The request could not be processed because it is invalid",
  "error": "BadRequestException",
  "statusCode": 400,
  "meta": {
    "timestamp": "2026-05-03T12:34:56.000Z",
    "version": "1.0.0",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

Errors are normalized by the global exception filter and include the HTTP status, error name, message, and request metadata.

## Deployment Notes

- Keep `DATABASE_SYNC=false` in production and rely on migrations.
- Use strong, unique JWT secrets for access and refresh tokens.
- Set `SWAGGER_ENABLED=false` if public API documentation is not required in production.
- Configure `CORS_ORIGIN` explicitly for production clients.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the codebase map, testing expectations, review checklist, and required `pnpm validate` workflow before push.

## License

UNLICENSED
