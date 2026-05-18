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
 */

import { Router, Request, Response } from 'express';
import {
  getAllDevices,
  getDeviceByInstallationId,
  MOCK_USER_ID,
} from '../state';

export const victronRouter = Router();

// ─── Auth middleware ──────────────────────────────────────────────────────────

function requireToken(req: Request, res: Response): boolean {
  const auth = req.headers['x-authorization'];
  if (!auth || !String(auth).startsWith('Token ')) {
    res.status(401).json({ success: false, errors: ['Unauthorized'] });
    return false;
  }
  return true;
}

// ─── GET /users/me ────────────────────────────────────────────────────────────

victronRouter.get('/users/me', (req: Request, res: Response) => {
  if (!requireToken(req, res)) return;

  res.json({
    success: true,
    record: {
      idUser: MOCK_USER_ID,
      name: 'Mock EnergyIQ User',
      email: 'mock@energyiq.dev',
    },
  });
});

// ─── GET /users/:idUser/installations ────────────────────────────────────────

victronRouter.get(
  '/users/:idUser/installations',
  (req: Request, res: Response) => {
    if (!requireToken(req, res)) return;

    const devices = getAllDevices();

    res.json({
      success: true,
      records: devices.map((d) => ({
        idSite: parseInt(d.installationId, 10),
        name: d.name,
        identifier: d.identifier,
        pvMax: d.panelCapacityKw * 1000, // watts
        timezone: 'Africa/Lagos',
        is_on_grid: true,
        hasGenerator: false,
        mqtt_host: null,
      })),
    });
  },
);

// ─── GET /installations/:installationId/diagnostics ──────────────────────────

victronRouter.get(
  '/installations/:installationId/diagnostics',
  (req: Request, res: Response) => {
    if (!requireToken(req, res)) return;

    const { installationId } = req.params;
    const device = getDeviceByInstallationId(installationId as string);

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
