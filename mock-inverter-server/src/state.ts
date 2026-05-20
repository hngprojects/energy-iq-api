/**
 * State engine for the mock inverter simulator.
 *
 * Each device has a continuously evolving state that mimics real inverter
 * behaviour: solar generation follows a daylight bell curve, battery charges
 * during the day and drains at night, load fluctuates with noise.
 *
 * Devices are identified by their installationId (Victron site ID).
 */

export interface DeviceState {
  installationId: string;
  name: string;
  identifier: string; // serial number equivalent
  victronUserId: number; // Victron VRM internal user ID (not your app's UUID)
  batterySoc: number; // 0–100 %
  batteryVoltageV: number; // 44–58 V for a 48V system
  batteryCurrentA: number; // positive = charging, negative = discharging
  batteryTemperatureC: number;
  batteryTimeToGoMin: number;
  solarPowerKw: number;
  acOutputPowerKw: number;
  gridVoltageV: number;
  gridFrequencyHz: number;
  inverterTemperatureC: number;
  inverterStatus: string;
  panelCapacityKw: number; // rated panel capacity
  batteryCapacityKwh: number; // rated battery capacity
}

// Seeded devices 
//
// Each device belongs to a distinct Victron VRM user (victronUserId).
// This mirrors the one-to-one user→inverter model in the main application.
// When registering test inverters in your DB, create one app user per device
// and use the corresponding access token below.
//
// Test credentials (access token → victronUserId → installationId):
//   mock-token-a  →  9001  →  100001  (Site A — healthy)
//   mock-token-b  →  9002  →  100002  (Site B — moderate)
//   mock-token-c  →  9003  →  100003  (Site C — low battery / RED health)

const DEVICES: DeviceState[] = [
  {
    installationId: '100001',
    name: 'EnergyIQ Test Site A',
    identifier: 'MOCK-VIC-001',
    victronUserId: 9001,
    batterySoc: 75,
    batteryVoltageV: 52.4,
    batteryCurrentA: 8.0,
    batteryTemperatureC: 28,
    batteryTimeToGoMin: 240,
    solarPowerKw: 2.5,
    acOutputPowerKw: 1.8,
    gridVoltageV: 230,
    gridFrequencyHz: 50,
    inverterTemperatureC: 34,
    inverterStatus: 'normal',
    panelCapacityKw: 5.0,
    batteryCapacityKwh: 10.0,
  },
  {
    installationId: '100002',
    name: 'EnergyIQ Test Site B',
    identifier: 'MOCK-VIC-002',
    victronUserId: 9002,
    batterySoc: 45,
    batteryVoltageV: 49.8,
    batteryCurrentA: -3.5,
    batteryTemperatureC: 31,
    batteryTimeToGoMin: 90,
    solarPowerKw: 0.8,
    acOutputPowerKw: 2.2,
    gridVoltageV: 228,
    gridFrequencyHz: 50,
    inverterTemperatureC: 38,
    inverterStatus: 'normal',
    panelCapacityKw: 3.0,
    batteryCapacityKwh: 7.5,
  },
  {
    // Low SOC device — useful for testing RED health status
    installationId: '100003',
    name: 'EnergyIQ Test Site C (Low Battery)',
    identifier: 'MOCK-VIC-003',
    victronUserId: 9003,
    batterySoc: 15,
    batteryVoltageV: 45.2,
    batteryCurrentA: -5.0,
    batteryTemperatureC: 35,
    batteryTimeToGoMin: 20,
    solarPowerKw: 0.0,
    acOutputPowerKw: 1.5,
    gridVoltageV: 231,
    gridFrequencyHz: 50,
    inverterTemperatureC: 40,
    inverterStatus: 'normal',
    panelCapacityKw: 4.0,
    batteryCapacityKwh: 5.0,
  },
];

// Helpers 

/** Small random noise in range [-range, +range] */
function noise(range: number): number {
  return (Math.random() * 2 - 1) * range;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Solar generation curve: peaks at solar noon (13:00 Lagos time),
 * zero before 6:00 and after 19:00.
 * Returns a multiplier 0–1.
 */
function solarMultiplier(hourOfDay: number): number {
  if (hourOfDay < 6 || hourOfDay >= 19) return 0;
  // Bell curve centred at 13:00, width ~6 hours
  const x = (hourOfDay - 13) / 4;
  return Math.exp(-(x * x));
}

/** Convert SOC % to approximate 48V battery voltage */
function socToVoltage(soc: number): number {
  // Linear approximation: 44V at 0%, 58V at 100%
  return 44 + (soc / 100) * 14;
}

/** Estimate time-to-go in minutes given current net power draw and capacity */
function timeToGo(soc: number, capacityKwh: number, netDrawKw: number): number {
  if (netDrawKw <= 0) return 9999; // charging — no time-to-go
  const remainingKwh = (soc / 100) * capacityKwh;
  return Math.round((remainingKwh / netDrawKw) * 60);
}

// Tick 

/**
 * Advance all device states by one tick (called every 2 minutes).
 * Uses Lagos time (UTC+1) for the solar curve.
 */
export function tick(): void {
  const now = new Date();
  const lagosHour = (now.getUTCHours() + 1) % 24; // UTC+1
  const lagosMinute = now.getUTCMinutes();
  const hourOfDay = lagosHour + lagosMinute / 60;

  for (const device of DEVICES) {
    const solarMult = solarMultiplier(hourOfDay);

    // Solar output: rated capacity × curve × noise
    device.solarPowerKw = clamp(
      device.panelCapacityKw * solarMult + noise(0.15),
      0,
      device.panelCapacityKw,
    );

    // Load: base 1.5 kW with noise
    device.acOutputPowerKw = clamp(1.5 + noise(0.4), 0.3, 4.0);

    // Net power: positive = charging battery, negative = draining
    const netKw = device.solarPowerKw - device.acOutputPowerKw;

    // SOC change over 2 minutes: (netKw × 2/60) / capacityKwh × 100
    const socDelta = (netKw * (2 / 60)) / device.batteryCapacityKwh * 100;
    device.batterySoc = clamp(device.batterySoc + socDelta, 0, 100);

    // Derived values
    device.batteryVoltageV = clamp(socToVoltage(device.batterySoc) + noise(0.2), 44, 58);
    device.batteryCurrentA = clamp((netKw * 1000) / device.batteryVoltageV + noise(0.5), -60, 60);
    device.batteryTemperatureC = clamp(device.batteryTemperatureC + noise(0.3), 20, 50);
    device.inverterTemperatureC = clamp(device.inverterTemperatureC + noise(0.5), 25, 65);
    device.gridVoltageV = clamp(230 + noise(3), 220, 240);
    device.gridFrequencyHz = clamp(50 + noise(0.1), 49.5, 50.5);
    device.batteryTimeToGoMin = timeToGo(
      device.batterySoc,
      device.batteryCapacityKwh,
      device.acOutputPowerKw - device.solarPowerKw,
    );

    // Status: fault if SOC < 5%, standby if solar is zero and load is very low
    if (device.batterySoc < 5) {
      device.inverterStatus = 'fault';
    } else if (device.solarPowerKw < 0.05 && device.acOutputPowerKw < 0.2) {
      device.inverterStatus = 'standby';
    } else {
      device.inverterStatus = 'normal';
    }
  }
}

// Accessors

export function getAllDevices(): DeviceState[] {
  return DEVICES;
}

export function getDeviceByInstallationId(id: string): DeviceState | undefined {
  return DEVICES.find((d) => d.installationId === id);
}

export function getDeviceByVictronUserId(userId: number): DeviceState | undefined {
  return DEVICES.find((d) => d.victronUserId === userId);
}
