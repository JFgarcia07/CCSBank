import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { LoginDto } from './dto/login.dto.js';

// Hash de relleno: se compara cuando el usuario no existe, para que la respuesta
// tarde lo mismo y no se pueda averiguar qué carnés existen.
const HASH_RELLENO = bcrypt.hashSync('relleno-no-valido', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login({ usuario: identificador, password }: LoginDto) {
    const clave = identificador.trim();
    const usuario = await this.prisma.usuario.findFirst({
      // Usuarios y correos se guardan en minúsculas.
      where: { OR: [{ carne: { in: [clave, clave.toLowerCase()] } }, { email: clave.toLowerCase() }] },
    });

    const coincide = await bcrypt.compare(password, usuario?.password ?? HASH_RELLENO);
    if (!usuario || !coincide || !usuario.activo) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos.');
    }

    const accessToken = await this.jwt.signAsync({ sub: usuario.id, rol: usuario.rol });
    return { accessToken, usuario: this.aPerfil(usuario) };
  }

  aPerfil(u: UsuarioAutenticado): UsuarioAutenticado {
    return {
      id: u.id,
      carne: u.carne,
      nombre: u.nombre,
      apellidos: u.apellidos,
      rol: u.rol,
      gradoId: u.gradoId,
    };
  }
}
