import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UsuarioAutenticado } from '../tipos/usuario-autenticado.js';

/** Devuelve el usuario autenticado de la petición: @UsuarioActual() usuario */
export const UsuarioActual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioAutenticado => {
    return ctx.switchToHttp().getRequest().user;
  },
);
