// Carga el .env único de la raíz del repositorio (../../.env desde src/ o dist/).
// Debe importarse PRIMERO en main.ts: otros módulos leen process.env al cargarse.
// En producción las variables vienen del servidor y, si no hay .env, no pasa nada.
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
