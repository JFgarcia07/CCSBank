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
import { RevisarReporteDto } from './dto/revisar-reporte.dto.js';

export const TAMANO_MAXIMO = 2 * 1024 * 1024; // 2 MB

export interface ArchivoSubido {
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const dinero = (d: Prisma.Decimal | null | undefined) => (d ?? new Prisma.Decimal(0)).toFixed(2);
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Lunes (YYYY-MM-DD) de la semana de una fecha, con la hora de Guatemala (UTC-6). */
export function lunesDe(fecha: Date = new Date()): string {
  const gt = new Date(fecha.getTime() - 6 * 3600 * 1000);
  gt.setUTCDate(gt.getUTCDate() - ((gt.getUTCDay() + 6) % 7));
  return iso(gt);
}

const comoFecha = (semana: string) => new Date(`${semana}T00:00:00.000Z`);

/** Valida que sea una fecha real y que caiga en lunes. */
function validarSemana(semana: string): string {
  const f = comoFecha(semana);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(semana) || Number.isNaN(f.getTime()) || iso(f) !== semana || f.getUTCDay() !== 1) {
    throw new BadRequestException('La semana debe ser un lunes con formato AAAA-MM-DD.');
  }
  return semana;
}

const corta = (semana: string) => {
  const [, m, d] = semana.split('-');
  return `${d}/${m}`;
};

@Injectable()
export class ReportesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly almacenamiento: AlmacenamientoService,
  ) {}

  /** ADMIN entra a cualquier clase; el MAESTRO solo a las que tiene asignadas. */
  private async verificarAcceso(usuario: UsuarioAutenticado, gradoId: string) {
    if (usuario.rol === 'ADMIN') {
      const grado = await this.prisma.grado.findUnique({ where: { id: gradoId }, select: { id: true } });
      if (!grado) throw new NotFoundException('La clase no existe.');
      return;
    }
    const asignado = await this.prisma.maestroGrado.findUnique({
      where: { maestroId_gradoId: { maestroId: usuario.id, gradoId } },
      select: { gradoId: true },
    });
    if (!asignado) throw new ForbiddenException('No tienes acceso a esta clase.');
  }

  // ───────────────────────── Alumno ─────────────────────────

  /** Mi trabajo vigente, la semana en curso y mis últimos reportes. */
  async miTrabajo(usuario: UsuarioAutenticado) {
    const semanaActual = lunesDe();
    const [asignacion, reportes] = await Promise.all([
      this.prisma.asignacion.findFirst({
        where: { usuarioId: usuario.id, hasta: null, trabajo: { activo: true } },
        select: { trabajo: { select: { id: true, nombre: true, descripcion: true, salarioSemanal: true } } },
      }),
      this.prisma.reporteSemanal.findMany({
        where: { alumnoId: usuario.id },
        select: {
          id: true,
          semana: true,
          estado: true,
          comentario: true,
          creadoEn: true,
          revisadoEn: true,
          pagadoEn: true,
          asignacion: { select: { trabajo: { select: { nombre: true } } } },
        },
        orderBy: { semana: 'desc' },
        take: 20,
      }),
    ]);

    const t = asignacion?.trabajo;
    return {
      semanaActual,
      trabajo: t
        ? { id: t.id, nombre: t.nombre, descripcion: t.descripcion, salarioSemanal: dinero(t.salarioSemanal) }
        : null,
      reportes: reportes.map((r) => ({
        id: r.id,
        semana: iso(r.semana),
        trabajo: r.asignacion.trabajo.nombre,
        estado: r.estado,
        comentario: r.comentario,
        enviadoEn: r.creadoEn,
        pagado: r.pagadoEn !== null,
      })),
    };
  }

  /** Sube (o reemplaza) el reporte de la semana en curso. Un PDF de máximo 2 MB. */
  async subir(usuario: UsuarioAutenticado, archivo: ArchivoSubido | undefined) {
    if (!archivo) throw new BadRequestException('Adjunta el reporte en PDF.');
    if (archivo.size > TAMANO_MAXIMO) {
      throw new BadRequestException('El PDF pesa más de 2 MB. Reduce el tamaño de las fotos y vuelve a intentarlo.');
    }
    // Se revisa el contenido real, no solo lo que dice el navegador.
    if (archivo.mimetype !== 'application/pdf' || archivo.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new BadRequestException('El archivo debe ser un PDF.');
    }

    const asignacion = await this.prisma.asignacion.findFirst({
      where: { usuarioId: usuario.id, hasta: null, trabajo: { activo: true } },
      select: { id: true },
    });
    if (!asignacion) throw new BadRequestException('Aún no tienes un trabajo asignado.');

    const semana = lunesDe();
    const existente = await this.prisma.reporteSemanal.findUnique({
      where: { asignacionId_semana: { asignacionId: asignacion.id, semana: comoFecha(semana) } },
      select: { estado: true },
    });
    if (existente?.estado === 'APROBADO') {
      throw new ConflictException('Tu reporte de esta semana ya fue aprobado y no se puede reemplazar.');
    }

    const ruta = `${usuario.id}/${asignacion.id}/${semana}.pdf`;
    await this.almacenamiento.subir('reportes', ruta, archivo.buffer, 'application/pdf');

    const datos = {
      alumnoId: usuario.id,
      archivoPath: ruta,
      estado: 'PENDIENTE' as const,
      comentario: null,
      revisadoPorId: null,
      revisadoEn: null,
      creadoEn: new Date(),
    };
    const r = await this.prisma.reporteSemanal.upsert({
      where: { asignacionId_semana: { asignacionId: asignacion.id, semana: comoFecha(semana) } },
      create: { asignacionId: asignacion.id, semana: comoFecha(semana), ...datos },
      update: datos,
      select: { id: true, semana: true, estado: true },
    });
    return { id: r.id, semana: iso(r.semana), estado: r.estado };
  }

  // ───────────────────── Ver el PDF (alumno o docente) ─────────────────────

  async urlDelArchivo(id: string, usuario: UsuarioAutenticado) {
    const r = await this.prisma.reporteSemanal.findUnique({
      where: { id },
      select: { archivoPath: true, alumnoId: true, alumno: { select: { gradoId: true } } },
    });
    if (!r) throw new NotFoundException('El reporte no existe.');
    if (usuario.rol === 'ALUMNO') {
      if (r.alumnoId !== usuario.id) throw new ForbiddenException('No tienes acceso a este reporte.');
    } else {
      if (!r.alumno.gradoId) throw new ForbiddenException('No tienes acceso a este reporte.');
      await this.verificarAcceso(usuario, r.alumno.gradoId);
    }
    return { url: await this.almacenamiento.urlFirmada('reportes', r.archivoPath) };
  }

  // ───────────────────────── Maestro / Admin ─────────────────────────

  /** Reportes de la clase en una semana (por defecto la actual), junto a quién no ha entregado. */
  async listar(gradoId: string, semanaParam: string | undefined, usuario: UsuarioAutenticado) {
    await this.verificarAcceso(usuario, gradoId);
    const semanaActual = lunesDe();
    const semana = semanaParam ? validarSemana(semanaParam) : semanaActual;

    const [alumnos, reportes] = await Promise.all([
      this.prisma.usuario.findMany({
        where: { gradoId, rol: 'ALUMNO', activo: true },
        select: {
          id: true,
          nombre: true,
          apellidos: true,
          asignaciones: {
            where: { hasta: null, trabajo: { activo: true } },
            take: 1,
            select: { trabajo: { select: { id: true, nombre: true, salarioSemanal: true } } },
          },
        },
        orderBy: [{ apellidos: 'asc' }, { nombre: 'asc' }],
      }),
      this.prisma.reporteSemanal.findMany({
        where: { semana: comoFecha(semana), alumno: { gradoId, rol: 'ALUMNO' } },
        select: {
          id: true,
          alumnoId: true,
          estado: true,
          comentario: true,
          creadoEn: true,
          pagadoEn: true,
          asignacion: { select: { trabajo: { select: { id: true, nombre: true, salarioSemanal: true } } } },
        },
      }),
    ]);

    const porAlumno = new Map(reportes.map((r) => [r.alumnoId, r]));
    const filas = alumnos
      .map((a) => {
        const r = porAlumno.get(a.id);
        const t = r?.asignacion.trabajo ?? a.asignaciones[0]?.trabajo ?? null;
        if (!t) return null; // sin trabajo y sin reporte: no aplica
        return {
          alumnoId: a.id,
          nombre: a.nombre,
          apellidos: a.apellidos,
          trabajo: t.nombre,
          salario: dinero(t.salarioSemanal),
          reporte: r
            ? {
                id: r.id,
                estado: r.estado,
                comentario: r.comentario,
                enviadoEn: r.creadoEn,
                pagado: r.pagadoEn !== null,
              }
            : null,
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    return { semana, semanaActual, filas };
  }

  /** Aprueba o rechaza un reporte (no se puede cambiar una vez pagado el salario). */
  async revisar(id: string, dto: RevisarReporteDto, usuario: UsuarioAutenticado) {
    const r = await this.prisma.reporteSemanal.findUnique({
      where: { id },
      select: { id: true, pagadoEn: true, semana: true, alumnoId: true, alumno: { select: { gradoId: true } } },
    });
    if (!r?.alumno.gradoId) throw new NotFoundException('El reporte no existe.');
    await this.verificarAcceso(usuario, r.alumno.gradoId);
    if (r.pagadoEn) throw new ConflictException('El salario de este reporte ya se pagó; no se puede cambiar.');
    if (dto.estado === 'RECHAZADO' && !dto.comentario) {
      throw new BadRequestException('Explica por qué lo rechazas para que el alumno pueda corregirlo.');
    }

    const gradoId = r.alumno.gradoId;
    await this.prisma.$transaction([
      this.prisma.reporteSemanal.update({
        where: { id },
        data: {
          estado: dto.estado,
          comentario: dto.estado === 'RECHAZADO' ? dto.comentario : null,
          revisadoPorId: usuario.id,
          revisadoEn: new Date(),
        },
      }),
      this.prisma.auditoria.create({
        data: {
          usuarioId: usuario.id,
          accion: dto.estado === 'APROBADO' ? 'APROBAR_REPORTE' : 'RECHAZAR_REPORTE',
          entidad: 'ReporteSemanal',
          entidadId: id,
          detalle: { gradoId, alumnoId: r.alumnoId, semana: iso(r.semana), comentario: dto.comentario ?? null },
        },
      }),
    ]);
  }

  /**
   * Paga el salario de todos los reportes aprobados de la semana que aún no se han pagado.
   * Cada pago queda como cobro pendiente para que el alumno lo cobre en su cuenta.
   */
  async pagarSalarios(gradoId: string, semanaParam: string, usuario: UsuarioAutenticado) {
    await this.verificarAcceso(usuario, gradoId);
    const semana = validarSemana(semanaParam);

    return this.prisma.$transaction(async (tx) => {
      const reportes = await tx.reporteSemanal.findMany({
        where: { semana: comoFecha(semana), estado: 'APROBADO', pagadoEn: null, alumno: { gradoId, rol: 'ALUMNO' } },
        select: {
          id: true,
          alumnoId: true,
          asignacion: { select: { trabajo: { select: { nombre: true, salarioSemanal: true } } } },
        },
      });
      if (!reportes.length) {
        throw new BadRequestException('No hay reportes aprobados pendientes de pago en esta semana.');
      }

      let total = new Prisma.Decimal(0);
      let pagados = 0;
      for (const r of reportes) {
        // Solo uno gana si dos personas pagan a la vez.
        const marcado = await tx.reporteSemanal.updateMany({
          where: { id: r.id, pagadoEn: null },
          data: { pagadoEn: new Date() },
        });
        if (marcado.count === 0) continue;

        const salario = r.asignacion.trabajo.salarioSemanal;
        pagados += 1;
        if (salario.lte(0)) continue; // trabajo sin salario: se marca pagado pero no hay cobro

        const cuenta =
          (await tx.cuenta.findUnique({ where: { usuarioId: r.alumnoId }, select: { id: true } })) ??
          (await tx.cuenta.create({ data: { usuarioId: r.alumnoId }, select: { id: true } }));
        await tx.cobroPendiente.create({
          data: {
            cuentaId: cuenta.id,
            tipo: 'SALARIO',
            monto: salario,
            concepto: `Salario de la semana del ${corta(semana)} · ${r.asignacion.trabajo.nombre}`,
          },
        });
        total = total.add(salario);
      }

      await tx.auditoria.create({
        data: {
          usuarioId: usuario.id,
          accion: 'PAGAR_SALARIOS',
          entidad: 'Grado',
          entidadId: gradoId,
          detalle: { semana, reportes: pagados, total: total.toFixed(2) },
        },
      });

      return { pagados, total: total.toFixed(2) };
    });
  }
}
