import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Rol } from '../../generated/prisma/enums.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { UsuarioAutenticado } from '../tipos/usuario-autenticado.js';

/** Guard global: valida @Roles(). Las rutas sin @Roles() solo exigen estar autenticado. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requeridos?.length) return true;

    const usuario: UsuarioAutenticado | undefined = context.switchToHttp().getRequest().user;
    if (!usuario) throw new ForbiddenException('No tienes permiso para esta acción.');

    const permitido =
      requeridos.includes(usuario.rol) ||
      (usuario.rol === Rol.ADMIN && requeridos.includes(Rol.MAESTRO));
    if (!permitido) throw new ForbiddenException('No tienes permiso para esta acción.');
    return true;
  }
}
