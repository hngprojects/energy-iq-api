import 'reflect-metadata';
import dataSource from '../data-source';
import { Seeder } from './seeder.interface';
import { userSeeder } from './user.seeder';
import { inverterSeeder } from './inverter.seeder';
import { inverterMetricsSeeder } from './inverter-metrics.seeder';

const seeders: Seeder[] = [userSeeder, inverterSeeder, inverterMetricsSeeder];

async function run() {
  await dataSource.initialize();
  console.log('Running seeders…');
  for (const seeder of seeders) {
    console.log(`→ ${seeder.name}`);
    await seeder.run(dataSource);
  }
  await dataSource.destroy();
  console.log('Done.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
