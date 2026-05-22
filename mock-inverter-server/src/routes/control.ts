/**
 * Manual override control routes.
 *
 * These endpoints let the team force a mock device into a specific
 * behaviour mode at any time of day, making it possible to demo and
 * test alert features outside of their natural day/night window.
 *
 * All routes are public — no auth token required.
 * The :id param is the installationId (100001, 100002, 100003).
 *
 * POST /charge/:id
 *   Body (optional): { "durationMinutes": number }
 *   Forces the device to charge (full solar, low load).
 *   Reverts to normal after durationMinutes (default: 60).
 *
 * POST /discharge/:id
 *   Body (optional): { "durationMinutes": number }
 *   Forces the device to discharge (zero solar, high load).
 *   Reverts to normal after durationMinutes (default: 60).
 *
 * POST /normal/:id
 *   Clears any active override immediately.
 *   Device resumes time-of-day behaviour on the next tick.
 */

import { Router, Request, Response } from 'express';
import { setDeviceMode, DeviceMode } from '../state';

export const controlRouter = Router();

const DEFAULT_DURATION = 60; // minutes
const MAX_DURATION = 480;    // 8 hours — sanity cap

function parseDuration(body: unknown): number | null {
  if (body === null || typeof body !== 'object') return DEFAULT_DURATION;
  const raw = (body as Record<string, unknown>)['durationMinutes'];
  if (raw === undefined || raw === null) return DEFAULT_DURATION;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null; // invalid
  return Math.min(parsed, MAX_DURATION);
}

function handleOverride(mode: DeviceMode) {
  return (req: Request, res: Response): void => {
    const { id } = req.params as { id: string };

    let duration = DEFAULT_DURATION;
    if (mode !== 'normal') {
      const parsed = parseDuration(req.body);
      if (parsed === null) {
        res.status(400).json({
          success: false,
          error: '`durationMinutes must be a positive number (max 480)',
        });
        return;
      }
      duration = parsed;
    }

    const device = setDeviceMode(id, mode, duration);

    if (!device) {
      res.status(404).json({
        success: false,
        error: `Installation ${id} not found. Valid IDs: 100001, 100002, 100003`,
      });
      return;
    }

    const expiresAt = device.modeExpiresAt
      ? new Date(device.modeExpiresAt).toISOString()
      : null;

    console.log(
      `[mock] Installation ${id} → mode="${mode}"` +
      (expiresAt ? ` until ${expiresAt}` : ' (cleared)'),
    );

    res.json({
      success: true,
      installationId: device.installationId,
      name: device.name,
      mode: device.mode,
      expiresAt,
      ...(mode !== 'normal' && { durationMinutes: duration }),
      snapshot: {
        batterySoc: device.batterySoc,
        solarPowerKw: device.solarPowerKw,
        acOutputPowerKw: device.acOutputPowerKw,
        batteryCurrentA: device.batteryCurrentA,
        inverterStatus: device.inverterStatus,
      },
    });
  };
}

// POST /charge/:id
controlRouter.post('/charge/:id', handleOverride('charging'));

// POST /discharge/:id
controlRouter.post('/discharge/:id', handleOverride('discharging'));

// POST /normal/:id
controlRouter.post('/normal/:id', handleOverride('normal'));
