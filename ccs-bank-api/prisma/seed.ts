// Crea el usuario ADMIN inicial (no hay registro público).
// Uso: npm run seed   — lee SEED_ADMIN_CARNE y SEED_ADMIN_PASSWORD del .env
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/client.js';

const carne = process.env.SEED_ADMIN_CARNE ?? 'admin';
const password = process.env.SEED_ADMIN_PASSWORD;
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!password) throw new Error('Falta SEED_ADMIN_PASSWORD en .env');
if (!url) throw new Error('Falta DIRECT_URL o DATABASE_URL en .env');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url, ssl: { rejectUnauthorized: false } }),
});

try {
  const admin = await prisma.usuario.upsert({
    where: { carne },
    update: { password: await bcrypt.hash(password, 12), activo: true, rol: 'ADMIN' },
    create: {
      carne,
      password: await bcrypt.hash(password, 12),
      nombre: 'Administrador',
      apellidos: 'CCS Bank',
      rol: 'ADMIN',
    },
  });
  console.log(`Administrador listo: carné "${admin.carne}" (id ${admin.id})`);
} finally {
  await prisma.$disconnect();
}
