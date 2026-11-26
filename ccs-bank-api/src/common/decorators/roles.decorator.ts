import { SetMetadata } from '@nestjs/common';
import { Rol } from '../../generated/prisma/enums.js';

export const ROLES_KEY = 'roles';

/** Restringe una ruta a los roles indicados. ADMIN también entra donde se pide MAESTRO. */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
