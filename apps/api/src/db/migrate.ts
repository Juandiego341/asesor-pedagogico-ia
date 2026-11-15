import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'node:path';
import { createDb } from './db.module';

export async function runMigrations() {
  const db = createDb();
  await migrate(db, { migrationsFolder: join(__dirname, '..', '..', 'drizzle') });
  await db.$client.end();
}

if (require.main === module) {
  runMigrations().then(() => { console.log('Migraciones aplicadas'); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}
