import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActualizarGradoDto } from './dto/actualizar-grado.dto.js';
import { CrearGradoDto } from './dto/crear-grado.dto.js';

const incluir = {
  maestros: {
    take: 1, // una clase tiene un solo docente
    select: {
      maestro: { select: { id: true, carne: true, nombre: true, apellidos: true, activo: true } },
    },
  },
  _count: { select: { usuarios: true } },
} satisfies Prisma.GradoInclude;

type GradoConRelaciones = Prisma.GradoGetPayload<{ include: typeof incluir }>;
type Tx = Prisma.TransactionClient;

@Injectable()
export class GradosService {
  constructor(private readonly prisma: PrismaService) {}

  private formatear(g: GradoConRelaciones) {
    return {
      id: g.id,
      nombre: g.nombre,
      creadoEn: g.creadoEn,
      totalAlumnos: g._count.usuarios,
      maestro: g.maestros[0]?.maestro ?? null,
    };
  }

  /** El docente debe existir y estar activo. */
  private async validarMaestro(maestroId: string, tx: Tx) {
    const maestro = await tx.usuario.findFirst({
      where: { id: maestroId, rol: 'MAESTRO', activo: true },
      select: { id: true },
    });
    if (!maestro) {
      throw new BadRequestException('El docente debe existir, estar activo y tener rol MAESTRO.');
    }
  }

  /** Un docente solo puede tener una clase: si ya tenía otra, se le quita (se mueve a esta). */
  private liberarMaestro(maestroId: string, tx: Tx, gradoId?: string) {
    return tx.maestroGrado.deleteMany({
      where: { maestroId, ...(gradoId ? { gradoId: { not: gradoId } } : {}) },
    });
  }

  private manejarError(e: unknown): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException('Ya existe una clase con ese nombre.');
    }
    throw e;
  }

  async crear(dto: CrearGradoDto, admin: UsuarioAutenticado) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.maestroId) {
          await this.validarMaestro(dto.maestroId, tx);
          await this.liberarMaestro(dto.maestroId, tx);
        }
        const creado = await tx.grado.create({
          data: {
            nombre: dto.nombre,
            maestros: dto.maestroId ? { create: { maestroId: dto.maestroId } } : undefined,
          },
          include: incluir,
        });
        await tx.auditoria.create({
          data: {
            usuarioId: admin.id,
            accion: 'CREAR_GRADO',
            entidad: 'Grado',
            entidadId: creado.id,
            detalle: { nombre: creado.nombre, maestroId: dto.maestroId ?? null },
          },
        });
        return this.formatear(creado);
      });
    } catch (e) {
      this.manejarError(e);
    }
  }

  async listar() {
    const grados = await this.prisma.grado.findMany({
      include: incluir,
      orderBy: { nombre: 'asc' },
    });
    return grados.map((g) => this.formatear(g));
  }

  /** Docentes activos que se pueden asignar a una clase. */
  listarMaestros() {
    return this.prisma.usuario.findMany({
      where: { rol: 'MAESTRO', activo: true },
      select: { id: true, carne: true, nombre: true, apellidos: true, activo: true },
      orderBy: [{ apellidos: 'asc' }, { nombre: 'asc' }],
    });
  }

  async obtener(id: string) {
    const grado = await this.prisma.grado.findUnique({ where: { id }, include: incluir });
    if (!grado) throw new NotFoundException('La clase no existe.');
    return this.formatear(grado);
  }

  /** Cambia el nombre y/o el docente en una sola transacción. El docente anterior se reemplaza y el nuevo se mueve desde su clase previa, si tenía una. */
  async actualizar(id: string, dto: ActualizarGradoDto, admin: UsuarioAutenticado) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existe = await tx.grado.findUnique({ where: { id }, select: { id: true } });
        if (!existe) throw new NotFoundException('La clase no existe.');

        if (dto.maestroId !== undefined) {
          if (dto.maestroId) {
            await this.validarMaestro(dto.maestroId, tx);
            await this.liberarMaestro(dto.maestroId, tx, id);
          }
          await tx.maestroGrado.deleteMany({ where: { gradoId: id } });
          if (dto.maestroId) {
            await tx.maestroGrado.create({ data: { gradoId: id, maestroId: dto.maestroId } });
          }
        }

        const grado = await tx.grado.update({
          where: { id },
          data: dto.nombre !== undefined ? { nombre: dto.nombre } : {},
          include: incluir,
        });
        await tx.auditoria.create({
          data: {
            usuarioId: admin.id,
            accion: 'ACTUALIZAR_GRADO',
            entidad: 'Grado',
            entidadId: id,
            detalle: { nombre: dto.nombre, maestroId: dto.maestroId },
          },
        });
        return this.formatear(grado);
      });
    } catch (e) {
      this.manejarError(e);
    }
  }

  async eliminar(id: string, admin: UsuarioAutenticado) {
    const grado = await this.obtener(id);
    if (grado.totalAlumnos > 0) {
      throw new ConflictException('No se puede eliminar una clase que tiene alumnos asignados.');
    }
    const trabajos = await this.prisma.trabajo.count({ where: { gradoId: id } });
    if (trabajos > 0) {
      throw new ConflictException('No se puede eliminar una clase que tiene trabajos creados.');
    }
    const productos = await this.prisma.producto.count({ where: { gradoId: id } });
    if (productos > 0) {
      throw new ConflictException('No se puede eliminar una clase que tiene productos en la tienda.');
    }
    await this.prisma.$transaction([
      this.prisma.grado.delete({ where: { id } }),
      this.prisma.auditoria.create({
        data: {
          usuarioId: admin.id,
          accion: 'ELIMINAR_GRADO',
          entidad: 'Grado',
          entidadId: id,
          detalle: { nombre: grado.nombre },
        },
      }),
    ]);
  }
}
