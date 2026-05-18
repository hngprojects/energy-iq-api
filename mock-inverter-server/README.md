# Mock Inverter Server

A standalone Express server that impersonates the Victron VRM API. Intended for local development and staging environments where real inverter hardware is unavailable.

## What it does

- Exposes the same HTTP endpoints the `VictronAdapter` calls
- Maintains stateful, physically plausible device data that evolves over time
- Solar generation follows a daylight bell curve (peaks at 13:00 Lagos time)
- Battery charges during the day, drains at night
- Load fluctuates with realistic noise

## Simulated devices

| Installation ID | Name | Panel Capacity | Notes |
|---|---|---|---|
| `100001` | EnergyIQ Test Site A | 5 kW | Healthy device |
| `100002` | EnergyIQ Test Site B | 3 kW | Moderate load |
| `100003` | EnergyIQ Test Site C | 4 kW | Starts with low SOC — triggers RED health |

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

Then register a test inverter in the database using one of the installation IDs above and any non-empty string as the access token (e.g. `mock-token`).

## Endpoints

All endpoints require the header:
```
X-Authorization: Token <any-value>
```

| Method | Path | Description |
|---|---|---|
| `GET` | `/users/me` | Returns mock user with `idUser: 9001` |
| `GET` | `/users/9001/installations` | Returns all 3 simulated devices |
| `GET` | `/installations/:id/diagnostics` | Returns live metrics for a device |
| `GET` | `/health` | Health check |

## State progression

Device state updates every 2 minutes (matching the Victron poll interval). The state engine runs inside the server process — no external dependencies, no database.

## Deploying to staging

Run as a separate process alongside the NestJS app:

```bash
cd mock-inverter-server && node dist/index.js
```

Or add to your `docker-compose.yml` as a separate service pointing at the built output.
