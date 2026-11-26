import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { Prisma } from '../../generated/prisma/client.js';
import type { Rol } from '../../generated/prisma/enums.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto.js';
import { CrearAlumnoDto } from './dto/crear-alumno.dto.js';
import { CrearDocenteDto } from './dto/crear-docente.dto.js';

const publico = {
  id: true,
  carne: true,
  email: true,
  nombre: true,
  apellidos: true,
  rol: true,
  activo: true,
  gradoId: true,
  grado: { select: { nombre: true } },
  creadoEn: true,
} satisfies Prisma.UsuarioSelect;

const RONDAS_BCRYPT = 12;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  listar(rol: Rol) {
    return this.prisma.usuario.findMany({
      where: { rol },
      select: publico,
      orderBy: [{ apellidos: 'asc' }, { nombre: 'asc' }],
    });
  }

  /** Docente: inicia sesión con correo y contraseña (el correo también queda como carné). */
  crearDocente(dto: CrearDocenteDto, admin: UsuarioAutenticado) {
    return this.crearConCorreo('MAESTRO', dto, admin);
  }

  /** Administrador: igual que el docente (correo y contraseña), con rol ADMIN. */
  crearAdmin(dto: CrearDocenteDto, admin: UsuarioAutenticado) {
    return this.crearConCorreo('ADMIN', dto, admin);
  }

  private async crearConCorreo(rol: 'MAESTRO' | 'ADMIN', dto: CrearDocenteDto, admin: UsuarioAutenticado) {
    const password = await bcrypt.hash(dto.password, RONDAS_BCRYPT);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const usuario = await tx.usuario.create({
          data: {
            carne: dto.email,
            email: dto.email,
            password,
            nombre: dto.nombre,
            apellidos: dto.apellidos,
            rol,
          },
          select: publico,
        });
        await tx.auditoria.create({
          data: {
            usuarioId: admin.id,
            accion: 'CREAR_USUARIO',
            entidad: 'Usuario',
            entidadId: usuario.id,
            detalle: { rol, email: dto.email },
          },
        });
        return usuario;
      });
    } catch (e) {
      this.manejarError(e, 'Ya existe una cuenta con ese correo.');
    }
  }

  /** Alumno: inicia sesión con nombre de usuario y contraseña. Se le abre su cuenta con saldo 0. */
  async crearAlumno(dto: CrearAlumnoDto, admin: UsuarioAutenticado) {
    const password = await bcrypt.hash(dto.password, RONDAS_BCRYPT);
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.gradoId) {
          const grado = await tx.grado.findUnique({ where: { id: dto.gradoId }, select: { id: true } });
          if (!grado) throw new BadRequestException('La clase indicada no existe.');
        }
        const usuario = await tx.usuario.create({
          data: {
            carne: dto.username,
            password,
            nombre: dto.nombre,
            apellidos: dto.apellidos,
            rol: 'ALUMNO',
            gradoId: dto.gradoId ?? null,
            cuenta: { create: {} },
          },
          select: publico,
        });
        await tx.auditoria.create({
          data: {
            usuarioId: admin.id,
            accion: 'CREAR_USUARIO',
            entidad: 'Usuario',
            entidadId: usuario.id,
            detalle: { rol: 'ALUMNO', username: dto.username, gradoId: dto.gradoId ?? null },
          },
        });
        return usuario;
      });
    } catch (e) {
      this.manejarError(e, 'Ese nombre de usuario ya está en uso.');
    }
  }

  async actualizar(id: string, dto: ActualizarUsuarioDto, admin: UsuarioAutenticado) {
    const actual = await this.prisma.usuario.findUnique({ where: { id }, select: { id: true, rol: true } });
    if (!actual) throw new NotFoundException('La cuenta no existe.');

    const esAlumno = actual.rol === 'ALUMNO';
    if (esAlumno && dto.email !== undefined) {
      throw new BadRequestException('Los alumnos inician sesión con usuario, no con correo.');
    }
    if (!esAlumno && (dto.username !== undefined || dto.gradoId !== undefined)) {
      throw new BadRequestException('El usuario y la clase solo aplican a alumnos.');
    }
    if (id === admin.id && dto.activo === false) {
      throw new BadRequestException('No puedes desactivar tu propia cuenta.');
    }

    const data: Prisma.UsuarioUncheckedUpdateInput = {
      nombre: dto.nombre,
      apellidos: dto.apellidos,
      activo: dto.activo,
    };
    if (esAlumno && dto.username !== undefined) data.carne = dto.username;
    if (!esAlumno && dto.email !== undefined) {
      data.email = dto.email;
      data.carne = dto.email; // el correo también es el carné de inicio de sesión
    }
    if (esAlumno && dto.gradoId !== undefined) data.gradoId = dto.gradoId;
    if (dto.password) data.password = await bcrypt.hash(dto.password, RONDAS_BCRYPT);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const usuario = await tx.usuario.update({ where: { id }, data, select: publico });
        await tx.auditoria.create({
          data: {
            usuarioId: admin.id,
            accion: 'ACTUALIZAR_USUARIO',
            entidad: 'Usuario',
            entidadId: id,
            detalle: {
              nombre: dto.nombre,
              apellidos: dto.apellidos,
              email: dto.email,
              username: dto.username,
              gradoId: dto.gradoId,
              activo: dto.activo,
              passwordCambiada: !!dto.password,
            },
          },
        });
        return usuario;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new BadRequestException('La clase indicada no existe.');
      }
      this.manejarError(e, esAlumno ? 'Ese nombre de usuario ya está en uso.' : 'Ya existe una cuenta con ese correo.');
    }
  }

  /** Borra la cuenta solo si no tiene historial; si lo tiene, hay que desactivarla. */
  async eliminar(id: string, admin: UsuarioAutenticado) {
    if (id === admin.id) throw new BadRequestException('No puedes eliminar tu propia cuenta.');
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: { id: true, rol: true, carne: true },
    });
    if (!usuario) throw new NotFoundException('La cuenta no existe.');

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.cuenta.deleteMany({ where: { usuarioId: id } });
        await tx.usuario.delete({ where: { id } });
        await tx.auditoria.create({
          data: {
            usuarioId: admin.id,
            accion: 'ELIMINAR_USUARIO',
            entidad: 'Usuario',
            entidadId: id,
            detalle: { rol: usuario.rol, carne: usuario.carne },
          },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException(
          'Esta cuenta ya tiene movimientos o registros asociados y no se puede eliminar. Desactívala en su lugar.',
        );
      }
      throw e;
    }
  }

  private manejarError(e: unknown, mensaje: string): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException(mensaje);
    }
    throw e;
  }
}
