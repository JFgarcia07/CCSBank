import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AlmacenamientoService } from '../almacenamiento/almacenamiento.service.js';
import { ActualizarTrabajoDto } from './dto/actualizar-trabajo.dto.js';
import { CrearTrabajoDto } from './dto/crear-trabajo.dto.js';

const incluirTrabajo = {
  // Solo la asignación vigente (hasta = null).
  asignaciones: {
    where: { hasta: null },
    take: 1,
    select: {
      id: true,
      usuario: { select: { id: true, nombre: true, apellidos: true, carne: true } },
    },
  },
} satisfies Prisma.TrabajoInclude;

type TrabajoConAsignado = Prisma.TrabajoGetPayload<{ include: typeof incluirTrabajo }>;
type Tx = Prisma.TransactionClient;

const dinero = (d: Prisma.Decimal | null | undefined) => (d ?? new Prisma.Decimal(0)).toFixed(2);

@Injectable()
export class AulaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly almacenamiento: AlmacenamientoService,
  ) {}

  /** ADMIN entra a cualquier clase; el MAESTRO solo a las que tiene asignadas. */
  private async verificarAcceso(usuario: UsuarioAutenticado, gradoId: string, tx: Tx | PrismaService = this.prisma) {
    if (usuario.rol === 'ADMIN') {
      const grado = await tx.grado.findUnique({ where: { id: gradoId }, select: { id: true } });
      if (!grado) throw new NotFoundException('La clase no existe.');
      return;
    }
    const asignado = await tx.maestroGrado.findUnique({
      where: { maestroId_gradoId: { maestroId: usuario.id, gradoId } },
      select: { gradoId: true },
    });
    if (!asignado) throw new ForbiddenException('No tienes acceso a esta clase.');
  }

  private formatearTrabajo(t: TrabajoConAsignado) {
    const vigente = t.asignaciones[0];
    return {
      id: t.id,
      gradoId: t.gradoId,
      nombre: t.nombre,
      descripcion: t.descripcion,
      salarioSemanal: dinero(t.salarioSemanal),
      activo: t.activo,
      asignado: vigente
        ? {
            asignacionId: vigente.id,
            alumnoId: vigente.usuario.id,
            nombre: vigente.usuario.nombre,
            apellidos: vigente.usuario.apellidos,
          }
        : null,
    };
  }

  private manejarDuplicado(e: unknown): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException('Ya existe un trabajo con ese nombre en esta clase.');
    }
    throw e;
  }

  private async trabajoConAcceso(id: string, usuario: UsuarioAutenticado, tx: Tx | PrismaService = this.prisma) {
    const trabajo = await tx.trabajo.findUnique({ where: { id }, select: { id: true, gradoId: true, activo: true } });
    if (!trabajo) throw new NotFoundException('El trabajo no existe.');
    await this.verificarAcceso(usuario, trabajo.gradoId, tx);
    return trabajo;
  }

  // ───────────── Clases y resumen ─────────────

  clases(usuario: UsuarioAutenticado) {
    return this.prisma.grado.findMany({
      where: usuario.rol === 'ADMIN' ? {} : { maestros: { some: { maestroId: usuario.id } } },
      select: { id: true, nombre: true, _count: { select: { usuarios: { where: { rol: 'ALUMNO' } } } } },
      orderBy: { nombre: 'asc' },
    }).then((lista) => lista.map((g) => ({ id: g.id, nombre: g.nombre, totalAlumnos: g._count.usuarios })));
  }

  /** Todo lo que necesita la pantalla Grado en una sola llamada (las consultas corren en paralelo). */
  async detalle(gradoId: string, usuario: UsuarioAutenticado) {
    const [, resumen, trabajos] = await Promise.all([
      this.verificarAcceso(usuario, gradoId), // si no hay acceso, lanza y no se devuelve nada
      this.calcularResumen(gradoId),
      this.listarTrabajos(gradoId),
    ]);
    return { ...resumen, trabajos };
  }

  async resumen(gradoId: string, usuario: UsuarioAutenticado) {
    const [, resumen] = await Promise.all([this.verificarAcceso(usuario, gradoId), this.calcularResumen(gradoId)]);
    return resumen;
  }

  private async calcularResumen(gradoId: string) {
    const [alumnos, movimientos, pendientes] = await Promise.all([
      this.prisma.usuario.findMany({
        where: { gradoId, rol: 'ALUMNO' },
        select: {
          id: true,
          carne: true,
          nombre: true,
          apellidos: true,
          activo: true,
          fotoUrl: true,
          cuenta: { select: { id: true, saldo: true } },
          asignaciones: { where: { hasta: null }, take: 1, select: { trabajo: { select: { id: true, nombre: true } } } },
        },
        orderBy: [{ apellidos: 'asc' }, { nombre: 'asc' }],
      }),
      // Bonus y fines acumulados por cuenta, calculados en la base de datos.
      this.prisma.transaccion.groupBy({
        by: ['cuentaId', 'tipo'],
        where: { tipo: { in: ['BONUS', 'FINE'] }, cuenta: { usuario: { gradoId, rol: 'ALUMNO' } } },
        _sum: { monto: true },
      }),
      // Bonus emitidos que el alumno todavía no cobra.
      this.prisma.cobroPendiente.groupBy({
        by: ['cuentaId'],
        where: { estado: 'PENDIENTE', tipo: 'BONUS', cuenta: { usuario: { gradoId, rol: 'ALUMNO' } } },
        _sum: { monto: true },
      }),
    ]);

    const porCobrar = new Map(pendientes.map((p) => [p.cuentaId, p._sum.monto ?? new Prisma.Decimal(0)]));
    const porCuenta = new Map<string, { bonus: Prisma.Decimal; fines: Prisma.Decimal }>();
    for (const m of movimientos) {
      const fila = porCuenta.get(m.cuentaId) ?? { bonus: new Prisma.Decimal(0), fines: new Prisma.Decimal(0) };
      const suma = m._sum.monto ?? new Prisma.Decimal(0);
      if (m.tipo === 'BONUS') fila.bonus = fila.bonus.plus(suma);
      else fila.fines = fila.fines.plus(suma.abs()); // los fines se guardan como egreso (negativo)
      porCuenta.set(m.cuentaId, fila);
    }

    // Fotos de los alumnos (si tienen): una sola llamada a Storage para todas.
    const rutasFoto = alumnos.map((a) => a.fotoUrl).filter((r): r is string => !!r);
    const urlsFoto = await this.almacenamiento.urlsFirmadas('avatares', rutasFoto, 3600);

    let totalSaldo = new Prisma.Decimal(0);
    let totalBonus = new Prisma.Decimal(0);
    let totalFines = new Prisma.Decimal(0);
    let totalPorCobrar = new Prisma.Decimal(0);

    const filas = alumnos.map((a) => {
      const pendiente = (a.cuenta && porCobrar.get(a.cuenta.id)) || new Prisma.Decimal(0);
      totalPorCobrar = totalPorCobrar.plus(pendiente);
      const saldo = a.cuenta?.saldo ?? new Prisma.Decimal(0);
      const mov = (a.cuenta && porCuenta.get(a.cuenta.id)) || { bonus: new Prisma.Decimal(0), fines: new Prisma.Decimal(0) };
      totalSaldo = totalSaldo.plus(saldo);
      totalBonus = totalBonus.plus(mov.bonus);
      totalFines = totalFines.plus(mov.fines);
      return {
        id: a.id,
        carne: a.carne,
        nombre: a.nombre,
        apellidos: a.apellidos,
        activo: a.activo,
        fotoUrl: (a.fotoUrl && urlsFoto.get(a.fotoUrl)) || null,
        saldo: dinero(saldo),
        bonus: dinero(mov.bonus),
        bonusPorCobrar: dinero(pendiente),
        fines: dinero(mov.fines),
        trabajo: a.asignaciones[0]?.trabajo ?? null,
      };
    });

    return {
      totales: {
        saldo: dinero(totalSaldo),
        bonus: dinero(totalBonus),
        bonusPorCobrar: dinero(totalPorCobrar),
        fines: dinero(totalFines),
      },
      alumnos: filas,
    };
  }

  // ───────────── Trabajos ─────────────

  private async listarTrabajos(gradoId: string) {
    const lista = await this.prisma.trabajo.findMany({
      where: { gradoId },
      include: incluirTrabajo,
      orderBy: { nombre: 'asc' },
    });
    return lista.map((t) => this.formatearTrabajo(t));
  }

  async trabajos(gradoId: string, usuario: UsuarioAutenticado) {
    const [, lista] = await Promise.all([this.verificarAcceso(usuario, gradoId), this.listarTrabajos(gradoId)]);
    return lista;
  }

  async crearTrabajo(gradoId: string, dto: CrearTrabajoDto, usuario: UsuarioAutenticado) {
    await this.verificarAcceso(usuario, gradoId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const creado = await tx.trabajo.create({
          data: {
            gradoId,
            nombre: dto.nombre,
            descripcion: dto.descripcion || null,
            salarioSemanal: dto.salarioSemanal,
          },
          include: incluirTrabajo,
        });
        await tx.auditoria.create({
          data: {
            usuarioId: usuario.id,
            accion: 'CREAR_TRABAJO',
            entidad: 'Trabajo',
            entidadId: creado.id,
            detalle: { gradoId, nombre: dto.nombre, salarioSemanal: dto.salarioSemanal },
          },
        });
        return this.formatearTrabajo(creado);
      });
    } catch (e) {
      this.manejarDuplicado(e);
    }
  }

  async actualizarTrabajo(id: string, dto: ActualizarTrabajoDto, usuario: UsuarioAutenticado) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.trabajoConAcceso(id, usuario, tx);
        const actualizado = await tx.trabajo.update({
          where: { id },
          data: {
            nombre: dto.nombre,
            descripcion: dto.descripcion === undefined ? undefined : dto.descripcion || null,
            salarioSemanal: dto.salarioSemanal,
            activo: dto.activo,
          },
          include: incluirTrabajo,
        });
        // Un trabajo desactivado queda libre.
        if (dto.activo === false) {
          await tx.asignacion.updateMany({ where: { trabajoId: id, hasta: null }, data: { hasta: new Date() } });
          actualizado.asignaciones = [];
        }
        await tx.auditoria.create({
          data: {
            usuarioId: usuario.id,
            accion: 'ACTUALIZAR_TRABAJO',
            entidad: 'Trabajo',
            entidadId: id,
            detalle: { ...dto },
          },
        });
        return this.formatearTrabajo(actualizado);
      });
    } catch (e) {
      this.manejarDuplicado(e);
    }
  }

  async eliminarTrabajo(id: string, usuario: UsuarioAutenticado) {
    await this.prisma.$transaction(async (tx) => {
      const trabajo = await this.trabajoConAcceso(id, usuario, tx);
      const historial = await tx.asignacion.count({ where: { trabajoId: id } });
      if (historial > 0) {
        throw new ConflictException(
          'Este trabajo ya fue asignado a algún alumno y no se puede eliminar. Desactívalo en su lugar.',
        );
      }
      await tx.trabajo.delete({ where: { id } });
      await tx.auditoria.create({
        data: {
          usuarioId: usuario.id,
          accion: 'ELIMINAR_TRABAJO',
          entidad: 'Trabajo',
          entidadId: id,
          detalle: { gradoId: trabajo.gradoId },
        },
      });
    });
  }

  /** Cierra todas las asignaciones vigentes de la clase. No borra trabajos ni historial. */
  async liberarTodos(gradoId: string, usuario: UsuarioAutenticado) {
    await this.verificarAcceso(usuario, gradoId);
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.asignacion.updateMany({
        where: { hasta: null, trabajo: { gradoId } },
        data: { hasta: new Date() },
      });
      await tx.auditoria.create({
        data: {
          usuarioId: usuario.id,
          accion: 'LIBERAR_TODOS_LOS_TRABAJOS',
          entidad: 'Grado',
          entidadId: gradoId,
          detalle: { liberados: count },
        },
      });
      return { liberados: count };
    });
  }

  /**
   * Un trabajo lo ocupa un solo alumno y un alumno tiene un solo trabajo:
   * al asignar, se cierran las asignaciones vigentes previas (se conserva el historial).
   */
  async asignar(trabajoId: string, alumnoId: string | null, usuario: UsuarioAutenticado) {
    return this.prisma.$transaction(async (tx) => {
      const trabajo = await this.trabajoConAcceso(trabajoId, usuario, tx);
      const ahora = new Date();

      if (alumnoId) {
        if (!trabajo.activo) throw new BadRequestException('El trabajo está inactivo.');
        const alumno = await tx.usuario.findFirst({
          where: { id: alumnoId, rol: 'ALUMNO', activo: true, gradoId: trabajo.gradoId },
          select: { id: true },
        });
        if (!alumno) {
          throw new BadRequestException('El alumno debe estar activo y pertenecer a esta clase.');
        }
        const yaEsSuyo = await tx.asignacion.findFirst({
          where: { trabajoId, usuarioId: alumnoId, hasta: null },
          select: { id: true },
        });
        if (!yaEsSuyo) {
          await tx.asignacion.updateMany({
            where: { hasta: null, OR: [{ trabajoId }, { usuarioId: alumnoId }] },
            data: { hasta: ahora },
          });
          await tx.asignacion.create({ data: { trabajoId, usuarioId: alumnoId, desde: ahora } });
        }
      } else {
        await tx.asignacion.updateMany({ where: { trabajoId, hasta: null }, data: { hasta: ahora } });
      }

      await tx.auditoria.create({
        data: {
          usuarioId: usuario.id,
          accion: alumnoId ? 'ASIGNAR_TRABAJO' : 'LIBERAR_TRABAJO',
          entidad: 'Trabajo',
          entidadId: trabajoId,
          detalle: { alumnoId },
        },
      });

      const actualizado = await tx.trabajo.findUniqueOrThrow({ where: { id: trabajoId }, include: incluirTrabajo });
      return this.formatearTrabajo(actualizado);
    });
  }
}
