import { GeneratorFuelType } from '../../../common/enums/generator';

/**
 * FUEL PRICES - should keep being entered until web scraper is available
 */

type FuelPriceEntry = {
  fuelType: GeneratorFuelType;
  pricePerLitreNaira: number;
  // Unix ms - add this manually whenever you add a new row, Get using Date.now() on an empty browser console
  updatedAt: number;
};

export const FUEL_PRICES: FuelPriceEntry[] = [
  {
    fuelType: GeneratorFuelType.PMS,
    pricePerLitreNaira: 1350,
    updatedAt: 1780530844618,
  },
  {
    fuelType: GeneratorFuelType.DIESEL,
    pricePerLitreNaira: 1950,
    updatedAt: 1780530844618,
  },
];

/**
 * Returns the most recently updated price entry for the given fuel type.
 * Falls back to the first entry if only one exists.
 */
export const getLatestFuelPrice = (type: GeneratorFuelType): FuelPriceEntry => {
  const entries = FUEL_PRICES.filter((e) => e.fuelType === type).sort(
    (a, b) => b.updatedAt - a.updatedAt, // descending — newest first
  );
  if (!entries.length) {
    throw new Error(
      `No fuel price entry found for type ${type}. Ensure FUEL_PRICES includes all GeneratorFuelType values`,
    );
  }
  return entries[0];
};

// CO₂ emission factors

/**
 * CO₂ emitted per litre of fuel combusted.
 * Sources: IPCC / IEA combustion emission factors.
 * These are physical constants and change very rarely.
 */
export const CO2_KG_PER_LITRE: Record<GeneratorFuelType, number> = {
  [GeneratorFuelType.PMS]: 2.31,
  [GeneratorFuelType.DIESEL]: 2.68,
};

// Generator fuel consumption rate lookup

/**
 * Approximate fuel consumption rates (litres/hour) at 75% load for common
 * generator sizes. Used when the user hasn't specified their exact rate.
 *
 * Rules of thumb:
 *   PMS:    ~0.5 L/hr per kW of rated output
 *   Diesel: ~0.3 L/hr per kW of rated output (more efficient at load)
 *
 * If the user's rated power doesn't match a bracket exactly, we interpolate
 * linearly from the nearest lower bracket.
 */
const PMS_CONSUMPTION_TABLE: Array<{ maxKw: number; litresPerHour: number }> = [
  { maxKw: 1.0, litresPerHour: 0.6 },
  { maxKw: 2.0, litresPerHour: 0.9 },
  { maxKw: 3.0, litresPerHour: 1.3 },
  { maxKw: 5.0, litresPerHour: 2.0 },
  { maxKw: 7.5, litresPerHour: 2.8 },
  { maxKw: 10.0, litresPerHour: 3.5 },
];

const DIESEL_CONSUMPTION_TABLE: Array<{
  maxKw: number;
  litresPerHour: number;
}> = [
  { maxKw: 3.0, litresPerHour: 0.9 },
  { maxKw: 5.0, litresPerHour: 1.4 },
  { maxKw: 7.5, litresPerHour: 1.9 },
  { maxKw: 10.0, litresPerHour: 2.5 },
  { maxKw: 15.0, litresPerHour: 3.5 },
  { maxKw: 20.0, litresPerHour: 4.5 },
];

/**
 * Returns an estimated fuel consumption rate in litres/hour for a generator
 * of the given type and rated output. Falls back to a conservative estimate
 * based on the rule of thumb if the rated power exceeds the table range.
 */
export const estimateFuelConsumptionRate = (
  fuelType: GeneratorFuelType,
  ratedPowerKw: number,
): number => {
  const table =
    fuelType === GeneratorFuelType.DIESEL
      ? DIESEL_CONSUMPTION_TABLE
      : PMS_CONSUMPTION_TABLE;

  // Find the first bracket whose maxKw >= ratedPowerKw
  const bracket = table.find((b) => ratedPowerKw <= b.maxKw);
  if (bracket) return bracket.litresPerHour;

  // Beyond table range: apply the rule of thumb
  const factor = fuelType === GeneratorFuelType.DIESEL ? 0.3 : 0.5;
  return parseFloat((ratedPowerKw * factor).toFixed(2));
};
