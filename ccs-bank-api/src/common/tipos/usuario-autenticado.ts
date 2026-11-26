import type { Rol } from '../../generated/prisma/enums.js';

export interface UsuarioAutenticado {
  id: string;
  carne: string;
  nombre: string;
  apellidos: string;
  rol: Rol;
  gradoId: string | null;
}
