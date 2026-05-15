import { execSync } from 'child_process';

const migrationName = process.argv[2];

if (!migrationName) {
  console.error(
    'Please provide a migration name. Example: pnpm migration:generate CreateUserTable',
  );
  process.exit(1);
}

const command = `pnpm exec typeorm-ts-node-commonjs -d src/database/data-source.ts migration:generate src/database/migrations/${migrationName}`;

console.log(`> ${command}`);
execSync(command, { stdio: 'inherit' });
