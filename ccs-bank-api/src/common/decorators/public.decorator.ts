import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'esPublica';

/** Marca una ruta como pública (sin token). Por defecto todas las rutas exigen login. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
