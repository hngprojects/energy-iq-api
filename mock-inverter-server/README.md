# Mock Inverter Server

A standalone Express server that impersonates the Victron VRM API. Intended for local development and staging environments where real inverter hardware is unavailable.

## What it does

- Exposes the same HTTP endpoints the `VictronAdapter` calls
- Maintains stateful, physically plausible device data that evolves over time
- Solar generation follows a daylight bell curve (peaks at 13:00 Lagos time)
- Battery charges during the day, drains at night
- Load fluctuates with realistic noise
- Each simulated device belongs to a distinct user — one inverter per user, matching the app's data model

## Simulated devices

Each device has its own access token, Victron user ID, and installation ID. Register one app user per device.

| Token | Installation ID | Name | Panel Capacity | Notes |
|---|---|---|---|---|
| `mock-token-a` | `100001` | EnergyIQ Test Site A | 5 kW | Healthy device |
| `mock-token-b` | `100002` | EnergyIQ Test Site B | 3 kW | Moderate load |
| `mock-token-c` | `100003` | EnergyIQ Test Site C | 4 kW | Starts with low SOC — triggers RED health |

## Setup

```bash
cd mock-inverter-server
pnpm install
pnpm start
```

Server starts on port `3001` by default. Override with `PORT=<number> pnpm start`.

## Connecting the main API

In your `.env` (or `.env.local`):

```env
VICTRON_API_BASE_URL=http://localhost:3001
```

Then register three test inverters in the database — one per user — using the tokens and installation IDs from the table above.

Example for Site A:
- `brand`: `VICTRON`
- `accessToken`: `mock-token-a`
- `installationId`: `100001`

The poller picks each inverter up within 2 minutes and starts writing metrics.

## Endpoints

All endpoints require the header:
```
X-Authorization: Token <token>
```

| Method | Path | Description |
|---|---|---|
| `GET` | `/users/me` | Returns the Victron user ID for the provided token |
| `GET` | `/users/:idUser/installations` | Returns the single installation owned by this user |
| `GET` | `/installations/:id/diagnostics` | Returns live metrics for a device |
| `GET` | `/health` | Health check |

### Token → user → installation mapping

The mock server maps each token to a specific Victron user ID, which in turn owns exactly one installation. This mirrors the one-to-one user→inverter relationship in the main application.

| Token | Victron User ID | Installation ID |
|---|---|---|
| `mock-token-a` | `9001` | `100001` |
| `mock-token-b` | `9002` | `100002` |
| `mock-token-c` | `9003` | `100003` |

Any unrecognised token is also accepted and defaults to user `9001` — so teams can use any string as a token without being blocked.

## State progression

Device state updates every 2 minutes (matching the Victron poll interval). The state engine runs inside the server process — no external dependencies, no database.

## Deploying to staging

Build and run as a separate process alongside the NestJS app:

```bash
cd mock-inverter-server
pnpm build
node dist/index.js
```

Or with PM2:
```bash
pm2 start dist/index.js --name mock-inverter-server
pm2 save
```

Or add to your `docker-compose.yml` as a separate service:
```yaml
mock-inverter:
  build:
    context: ./mock-inverter-server
  ports:
    - "3001:3001"
  restart: unless-stopped
```

Simple Dockerfile:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
CMD ["node", "dist/index.js"]
```

After deploying, set on the main NestJS staging instance:
```env
VICTRON_API_BASE_URL=http://<mock-server-host>:3001
```
