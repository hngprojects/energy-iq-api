/**
 * Mock Victron VRM API routes.
 *
 * Mirrors the three endpoints the VictronAdapter calls:
 *   GET /users/me
 *   GET /users/:idUser/installations
 *   GET /installations/:installationId/diagnostics
 *
 * Auth: expects header  X-Authorization: Token <any-value>
 * Any non-empty token is accepted.
 *
 * Each token maps to a distinct Victron user ID and installation:
 *   mock-token-a  →  user 9001  →  installation 100001
 *   mock-token-b  →  user 9002  →  installation 100002
 *   mock-token-c  →  user 9003  →  installation 100003
 */

import { Router, Request, Response } from 'express';
import {
  getDeviceByInstallationId,
  getDeviceByVictronUserId,
} from '../state';

export const victronRouter = Router();

// Token → victronUserId mapping

const TOKEN_TO_USER: Record<string, number> = {
  'mock-token-a': 9001,
  'mock-token-b': 9002,
  'mock-token-c': 9003,
};

function extractToken(req: Request): string | null {
  const auth = req.headers['x-authorization'];
  if (!auth || !String(auth).startsWith('Token ')) return null;
  return String(auth).slice('Token '.length).trim();
}

function requireToken(req: Request, res: Response): string | null {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ success: false, errors: ['Unauthorized'] });
    return null;
  }
  return token;
}

// GET /users/me
//
// Returns the Victron VRM user ID for the provided token.
// The adapter uses this ID to fetch installations in the next call.

victronRouter.get('/users/me', (req: Request, res: Response) => {
  const token = requireToken(req, res);
  if (!token) return;

  // Look up the victronUserId for this token; fall back to a generic ID
  // so that any token (not just the three named ones) still gets a response.
  const idUser = TOKEN_TO_USER[token] ?? 9001;

  res.json({
    success: true,
    record: {
      idUser,
      name: 'Mock EnergyIQ User',
      email: `mock-user-${idUser}@energyiq.dev`,
    },
  });
});

// GET /users/:idUser/installations
//
// Returns the single installation owned by this Victron user.
// One user → one inverter, matching the app's one-to-one model.

victronRouter.get(
  '/users/:idUser/installations',
  (req: Request, res: Response) => {
    const token = requireToken(req, res);
    if (!token) return;

    const idUser = parseInt(req.params['idUser'] as string, 10);
    const device = getDeviceByVictronUserId(idUser);

    if (!device) {
      // Unknown user — return empty installations list (not a 404,
      // matching real Victron API behaviour for users with no sites)
      res.json({ success: true, records: [] });
      return;
    }

    res.json({
      success: true,
      records: [
        {
          idSite: parseInt(device.installationId, 10),
          name: device.name,
          identifier: device.identifier,
          pvMax: device.panelCapacityKw * 1000, // watts
          timezone: 'Africa/Lagos',
          is_on_grid: true,
          hasGenerator: false,
          mqtt_host: null,
        },
      ],
    });
  },
);

// GET /installations/:installationId/diagnostics 
//
// Returns live metrics for a device. Called on every poll cycle.

victronRouter.get(
  '/installations/:installationId/diagnostics',
  (req: Request, res: Response) => {
    const token = requireToken(req, res);
    if (!token) return;

    const { installationId } = req.params as { installationId: string };
    const device = getDeviceByInstallationId(installationId);

    if (!device) {
      res.status(404).json({
        success: false,
        errors: [`Installation ${installationId} not found`],
      });
      return;
    }

    /**
     * Victron diagnostics returns a flat array of attribute objects.
     * The VictronAdapter reads these codes:
     *   bs  — battery SOC %
     *   bv  — battery voltage V
     *   Bc  — battery current A
     *   Tb  — battery temperature °C
     *   Ttg — time to go (minutes)
     *   Pdc — solar power kW
     *   Pac — AC output power kW
     *   Gv  — grid voltage V
     *   Gf  — grid frequency Hz
     *   Ti  — inverter temperature °C
     *   S   — inverter status string
     */
    const records = [
      { code: 'bs', formattedValue: `${device.batterySoc.toFixed(1)}%` },
      { code: 'bv', formattedValue: `${device.batteryVoltageV.toFixed(2)}V` },
      { code: 'Bc', formattedValue: `${device.batteryCurrentA.toFixed(1)}A` },
      { code: 'Tb', formattedValue: `${device.batteryTemperatureC.toFixed(1)}°C` },
      { code: 'Ttg', formattedValue: `${device.batteryTimeToGoMin.toFixed(0)}min` },
      { code: 'Pdc', formattedValue: `${device.solarPowerKw.toFixed(2)}kW` },
      { code: 'Pac', formattedValue: `${device.acOutputPowerKw.toFixed(2)}kW` },
      { code: 'Gv', formattedValue: `${device.gridVoltageV.toFixed(1)}V` },
      { code: 'Gf', formattedValue: `${device.gridFrequencyHz.toFixed(2)}Hz` },
      { code: 'Ti', formattedValue: `${device.inverterTemperatureC.toFixed(1)}°C` },
      { code: 'S', formattedValue: device.inverterStatus },
    ];

    res.json({ success: true, records });
  },
);
