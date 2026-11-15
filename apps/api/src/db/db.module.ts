import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export type DB = NodePgDatabase<typeof schema> & { $client: Pool };
export const DB_TOKEN = 'DB';

export function createDb(url = process.env.DATABASE_URL): DB {
  if (!url) throw new Error('DATABASE_URL no está configurada');
  // Neon: la cadena incluye sslmode=require, pg valida el certificado.
  const pool = new Pool({ connectionString: url, max: 10 });
  return drizzle(pool, { schema });
}

@Global()
@Module({
  providers: [{ provide: DB_TOKEN, useFactory: () => createDb() }],
  exports: [DB_TOKEN],
})
export class DbModule {}
