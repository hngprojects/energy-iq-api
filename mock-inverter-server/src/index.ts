/**
 * Mock Inverter Server
 *
 * A standalone Express server that impersonates the Victron VRM API.
 * Point VICTRON_API_BASE_URL at this server in your .env for local/staging dev.
 *
 * Usage:
 *   cd mock-inverter-server
 *   pnpm install
 *   pnpm start
 *
 * Default port: 3001
 * Override with PORT env var.
 */

import express from 'express';
import { victronRouter } from './routes/victron';
import { tick } from './state';

const app = express();
const PORT = parseInt(process.env['PORT'] ?? '3002', 10);

app.use(express.json());

// ─── Request logging ──────────────────────────────────────────────────────────

app.use((req, _res, next) => {
  console.log(`[mock] ${new Date().toISOString()}  ${req.method} ${req.path}`);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// Victron VRM API — all routes are mounted at root to match the real API shape
app.use('/', victronRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', server: 'mock-inverter-server' });
});

// ─── State progression ────────────────────────────────────────────────────────

// Advance device state every 2 minutes (matches Victron poll interval)
const TICK_INTERVAL_MS = 2 * 60 * 1000;
setInterval(tick, TICK_INTERVAL_MS);

// Run one tick immediately so state is non-stale on first request
tick();

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n[mock-inverter-server] Running on http://localhost:${PORT}`);
  console.log('[mock-inverter-server] Simulating 3 Victron devices:');
  console.log('  Site 100001 — EnergyIQ Test Site A  (healthy, 5kW panels)');
  console.log('  Site 100002 — EnergyIQ Test Site B  (moderate, 3kW panels)');
  console.log('  Site 100003 — EnergyIQ Test Site C  (low battery, RED health)');
  console.log('\nSet in your .env:');
  console.log(`  VICTRON_API_BASE_URL=http://localhost:${PORT}\n`);
});
