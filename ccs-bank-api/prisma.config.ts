import { config } from 'dotenv';

// El .env único está en la raíz del repositorio.
config({ path: '../.env', quiet: true });
import { defineConfig, env } from 'prisma/config';

// Las migraciones usan la conexión directa (puerto 5432).
// La app en ejecución usa DATABASE_URL (pooler, puerto 6543) mediante el adaptador pg.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DIRECT_URL') },
});
