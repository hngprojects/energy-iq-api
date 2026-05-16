import { DataSource } from 'typeorm';
import { Seeder } from './seeder.interface';
import { InvertersMetrics } from '../../modules/inverters-metrics/entities/inverters-metrics.entity';
import { Inverter } from '../../modules/inverters/entities/inverters.entity';

export const inverterMetricsSeeder: Seeder = {
  name: 'InverterMetricsSeeder',
  async run(dataSource: DataSource) {
    const inverterRepository = dataSource.getRepository(Inverter);
    const metricsRepository = dataSource.getRepository(InvertersMetrics);

    const inverter = await inverterRepository.findOne({
      where: {
        user: {
          email: 'admin@example.com',
        },
      },
    });
    if (!inverter)
      throw new Error('InverterMetricsSeeder: failed to find inverter');

    await metricsRepository.deleteAll();

    const rightNow = new Date().getTime();

    for (let i = 1; i <= 100; i++) {
      const currentTimestamp = new Date(rightNow);
      currentTimestamp.setSeconds(currentTimestamp.getSeconds() + 60 * i);
      const inverterMetric = metricsRepository.create({
        inverterId: inverter.id,
        solarGenKw: i,
        batterySocPercent: i,
        loadKw: i,
        gridFrequencyHz: i,
        batteryVoltageV: Math.abs(Math.round(i / 3)),
        batteryCurrentA: i,
        gridVoltageV: Math.abs(Math.round(i / 3)),
        nairaSavedNgn: i * 10000,
        dailyEnergyKwh: Math.floor(Math.random() * i),
        inverterStatus: 'active',
        batteryTemperatureC: i,
        batteryTimeToGoMin: i * 10,
        inverterTemperatureC: i,
        metricTimestamp: currentTimestamp,
        inverter,
      });
      await metricsRepository.save(inverterMetric);
    }

    console.log(
      `[InverterMetricsSeeder] created inverter metrics for inverter with id → ${inverter.id}`,
    );
  },
};
