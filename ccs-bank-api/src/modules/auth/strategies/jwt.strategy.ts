import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { UsuarioAutenticado } from '../../../common/tipos/usuario-autenticado.js';

const TTL_MS = 30_000;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Caché corta: evita una consulta a la BD (remota) en cada petición.
  // Un usuario desactivado o con otro rol pierde acceso como máximo tras TTL_MS.
  private readonly cache = new Map<string, { usuario: UsuarioAutenticado; expira: number }>();

  /** Se ejecuta con un token válido. Revisa que el usuario siga activo. */
  async validate(payload: { sub: string }): Promise<UsuarioAutenticado> {
    const ahora = Date.now();
    const guardado = this.cache.get(payload.sub);
    if (guardado && guardado.expira > ahora) return guardado.usuario;

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: { id: true, carne: true, nombre: true, apellidos: true, rol: true, gradoId: true, activo: true },
    });
    if (!usuario || !usuario.activo) {
      this.cache.delete(payload.sub);
      throw new UnauthorizedException();
    }
    const { activo: _activo, ...datos } = usuario;
    if (this.cache.size > 500) this.cache.clear();
    this.cache.set(payload.sub, { usuario: datos, expira: ahora + TTL_MS });
    return datos;
  }
}
