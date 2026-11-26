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
import { ActualizarConceptoDto } from './dto/actualizar-concepto.dto.js';
import { CrearConceptoDto } from './dto/crear-concepto.dto.js';
import { EmitirMovimientoDto } from './dto/emitir-movimiento.dto.js';

const dinero = (d: Prisma.Decimal | null | undefined) => (d ?? new Prisma.Decimal(0)).toFixed(2);
const nombre = (u: { nombre: string; apellidos: string }) => `${u.nombre} ${u.apellidos}`;

const MOVIMIENTOS_RECIENTES = 30;
const MAXIMO_TRANSACCIONES = 300;

@Injectable()
export class NominaService {
  constructor(private readonly prisma: PrismaService) {}

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

  /** Alumnos de la clase (con saldo y bonus por cobrar) y los últimos bonus y fines emitidos. */
  async detalle(gradoId: string, usuario: UsuarioAutenticado) {
    const [, alumnos, pendientes, cobros, fines, conceptos] = await Promise.all([
      this.verificarAcceso(usuario, gradoId), // si no hay acceso, lanza y no se devuelve nada
      this.prisma.usuario.findMany({
        where: { gradoId, rol: 'ALUMNO', activo: true },
        select: { id: true, carne: true, nombre: true, apellidos: true, cuenta: { select: { id: true, saldo: true } } },
        orderBy: [{ apellidos: 'asc' }, { nombre: 'asc' }],
      }),
      this.prisma.cobroPendiente.groupBy({
        by: ['cuentaId'],
        where: { estado: 'PENDIENTE', tipo: 'BONUS', cuenta: { usuario: { gradoId, rol: 'ALUMNO' } } },
        _sum: { monto: true },
      }),
      this.prisma.cobroPendiente.findMany({
        where: { tipo: 'BONUS', cuenta: { usuario: { gradoId, rol: 'ALUMNO' } } },
        select: {
          id: true,
          monto: true,
          concepto: true,
          estado: true,
          creadoEn: true,
          cuenta: { select: { usuario: { select: { nombre: true, apellidos: true } } } },
        },
        orderBy: { creadoEn: 'desc' },
        take: MOVIMIENTOS_RECIENTES,
      }),
      this.prisma.transaccion.findMany({
        where: { tipo: 'FINE', cuenta: { usuario: { gradoId, rol: 'ALUMNO' } } },
        select: {
          id: true,
          monto: true,
          concepto: true,
          fecha: true,
          cuenta: { select: { usuario: { select: { nombre: true, apellidos: true } } } },
        },
        orderBy: { fecha: 'desc' },
        take: MOVIMIENTOS_RECIENTES,
      }),
      this.prisma.conceptoNomina.findMany({
        where: { gradoId },
        select: { id: true, tipo: true, nombre: true, monto: true },
        orderBy: { nombre: 'asc' },
      }),
    ]);

    const porCobrar = new Map(pendientes.map((p) => [p.cuentaId, p._sum.monto]));

    const movimientos = [
      ...cobros.map((c) => ({
        id: c.id,
        tipo: 'BONUS' as const,
        monto: dinero(c.monto),
        concepto: c.concepto,
        fecha: c.creadoEn,
        estado: c.estado === 'COBRADO' ? ('COBRADO' as const) : ('PENDIENTE' as const),
        alumno: nombre(c.cuenta.usuario),
      })),
      ...fines.map((f) => ({
        id: f.id,
        tipo: 'FINE' as const,
        monto: dinero(f.monto.abs()), // se guarda como egreso (negativo)
        concepto: f.concepto,
        fecha: f.fecha,
        estado: 'APLICADO' as const,
        alumno: nombre(f.cuenta.usuario),
      })),
    ]
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
      .slice(0, MOVIMIENTOS_RECIENTES);

    return {
      alumnos: alumnos.map((a) => ({
        id: a.id,
        carne: a.carne,
        nombre: a.nombre,
        apellidos: a.apellidos,
        saldo: dinero(a.cuenta?.saldo),
        bonusPorCobrar: dinero(a.cuenta ? porCobrar.get(a.cuenta.id) : null),
      })),
      movimientos,
      conceptos: conceptos.map((c) => this.resultado(c)),
    };
  }

  private resultado(c: { id: string; tipo: string; nombre: string; monto: Prisma.Decimal }) {
    return { id: c.id, tipo: c.tipo, nombre: c.nombre, monto: dinero(c.monto) };
  }

  private async conceptoConAcceso(id: string, usuario: UsuarioAutenticado) {
    const concepto = await this.prisma.conceptoNomina.findUnique({ where: { id } });
    if (!concepto) throw new NotFoundException('El concepto no existe.');
    await this.verificarAcceso(usuario, concepto.gradoId);
    return concepto;
  }

  private repetido(e: unknown): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException('Ya existe un concepto con ese nombre.');
    }
    throw e;
  }

  async crearConcepto(gradoId: string, dto: CrearConceptoDto, usuario: UsuarioAutenticado) {
    await this.verificarAcceso(usuario, gradoId);
    try {
      const c = await this.prisma.conceptoNomina.create({
        data: { gradoId, tipo: dto.tipo, nombre: dto.nombre, monto: new Prisma.Decimal(dto.monto.toFixed(2)) },
      });
      return this.resultado(c);
    } catch (e) {
      return this.repetido(e);
    }
  }

  async actualizarConcepto(id: string, dto: ActualizarConceptoDto, usuario: UsuarioAutenticado) {
    await this.conceptoConAcceso(id, usuario);
    try {
      const c = await this.prisma.conceptoNomina.update({
        where: { id },
        data: {
          ...(dto.nombre !== undefined && { nombre: dto.nombre }),
          ...(dto.monto !== undefined && { monto: new Prisma.Decimal(dto.monto.toFixed(2)) }),
        },
      });
      return this.resultado(c);
    } catch (e) {
      return this.repetido(e);
    }
  }

  /**
   * Quita un bonus, salario o fine ya emitido. Si el alumno ya cobró el bonus/salario, se descuenta
   * de su saldo; un fine se revierte devolviendo el dinero. Todo queda en la auditoría.
   */
  async quitarMovimiento(id: string, usuario: UsuarioAutenticado) {
    const cobro = await this.prisma.cobroPendiente.findUnique({
      where: { id },
      select: {
        id: true,
        tipo: true,
        estado: true,
        monto: true,
        concepto: true,
        cuentaId: true,
        creadoEn: true,
        cobradoEn: true,
        cuenta: { select: { usuario: { select: { id: true, gradoId: true } } } },
      },
    });

    if (cobro &&(cobro.tipo === 'BONUS' || cobro.tipo === 'SALARIO')) {
      const gradoId = cobro.cuenta.usuario.gradoId;
      const esSalario = cobro.tipo === 'SALARIO';
      const palabra = esSalario ? 'salario' : 'bonus';
      if (!gradoId) throw new NotFoundException('El movimiento no existe.');
      await this.verificarAcceso(usuario, gradoId);
      await this.prisma.$transaction(async (tx) => {
        // Se borra con el estado que se vio: si el alumno cobra justo ahora, se avisa en vez de pisarlo.
        const r = await tx.cobroPendiente.deleteMany({ where: { id, estado: cobro.estado } });
        if (r.count === 0) throw new ConflictException(`El ${palabra} cambió mientras lo quitabas. Vuelve a intentarlo.`);

        const yaCobrado = cobro.estado === 'COBRADO';
        if (yaCobrado) {
          // Ya estaba en la cuenta del alumno: se borra su transacción y se descuenta del saldo
          // (puede quedar en negativo = deuda, igual que con un fine).
          const candidatas = await tx.transaccion.findMany({
            where: { cuentaId: cobro.cuentaId, tipo: cobro.tipo, monto: cobro.monto, concepto: cobro.concepto },
            select: { id: true, fecha: true },
          });
          const base = (cobro.cobradoEn ?? cobro.creadoEn).getTime();
          const mas = candidatas.sort((a, b) => Math.abs(a.fecha.getTime() - base) - Math.abs(b.fecha.getTime() - base))[0];
          if (mas) await tx.transaccion.delete({ where: { id: mas.id } });
          await tx.cuenta.update({ where: { id: cobro.cuentaId }, data: { saldo: { decrement: cobro.monto } } });
        }
        // Un salario quitado deja el reporte como "por pagar" otra vez, para poder pagarlo de nuevo.
        if (esSalario) await this.reabrirPagoDeReporte(tx, cobro.cuenta.usuario.id, cobro.concepto);
        await tx.auditoria.create({
          data: {
            usuarioId: usuario.id,
            accion: esSalario ? 'QUITAR_SALARIO' : 'QUITAR_BONUS',
            entidad: 'Grado',
            entidadId: gradoId,
            detalle: {
              monto: cobro.monto.toFixed(2),
              concepto: cobro.concepto,
              alumnoId: cobro.cuenta.usuario.id,
              yaCobrado,
            },
          },
        });
      });
      return;
    }

    const fine = await this.prisma.transaccion.findUnique({
      where: { id },
      select: {
        id: true,
        tipo: true,
        monto: true,
        concepto: true,
        cuentaId: true,
        cuenta: { select: { usuario: { select: { id: true, gradoId: true } } } },
      },
    });
    const gradoFine = fine?.cuenta.usuario.gradoId;
    if (!fine || fine.tipo !== 'FINE' || !gradoFine) throw new NotFoundException('El movimiento no existe.');
    await this.verificarAcceso(usuario, gradoFine);

    await this.prisma.$transaction(async (tx) => {
      const r = await tx.transaccion.deleteMany({ where: { id, tipo: 'FINE' } });
      if (r.count === 0) throw new ConflictException('Este fine ya fue quitado.');
      await tx.cuenta.update({ where: { id: fine.cuentaId }, data: { saldo: { increment: fine.monto.abs() } } });
      await tx.auditoria.create({
        data: {
          usuarioId: usuario.id,
          accion: 'QUITAR_FINE',
          entidad: 'Grado',
          entidadId: gradoFine,
          detalle: { monto: fine.monto.abs().toFixed(2), concepto: fine.concepto, alumnoId: fine.cuenta.usuario.id },
        },
      });
    });
  }

  /**
   * El cobro de un salario no guarda a qué reporte pertenece, solo su concepto
   * ("Salario de la semana del DD/MM · Trabajo"). Con eso se busca el reporte pagado del alumno
   * y se marca como no pagado. Si no se encuentra, no pasa nada.
   */
  private async reabrirPagoDeReporte(tx: Prisma.TransactionClient, alumnoId: string, concepto: string) {
    const m = /del (\d{2})\/(\d{2}) · (.+)$/.exec(concepto);
    if (!m) return;
    const [, dd, mm, trabajo] = m;
    const pagados = await tx.reporteSemanal.findMany({
      where: { alumnoId, estado: 'APROBADO', pagadoEn: { not: null } },
      select: { id: true, semana: true, asignacion: { select: { trabajo: { select: { nombre: true } } } } },
      orderBy: { semana: 'desc' },
    });
    const reporte = pagados.find(
      (r) => r.semana.toISOString().slice(5, 10) === `${mm}-${dd}` && r.asignacion.trabajo.nombre === trabajo,
    );
    if (reporte) await tx.reporteSemanal.update({ where: { id: reporte.id }, data: { pagadoEn: null } });
  }

  /** Bonus, fines y salarios de la clase (los más recientes primero), con filtro opcional por tipo. */
  async transacciones(
    gradoId: string,
    tipoParam: string | undefined,
    alumnoId: string | undefined,
    usuario: UsuarioAutenticado,
  ) {
    await this.verificarAcceso(usuario, gradoId);
    if (tipoParam && !['BONUS', 'FINE', 'SALARIO'].includes(tipoParam)) {
      throw new BadRequestException('El tipo debe ser BONUS, FINE o SALARIO.');
    }
    // Con alumnoId solo salen las de ese alumno (y solo si es de esta clase).
    const alumno = { usuario: { gradoId, rol: 'ALUMNO' as const, ...(alumnoId ? { id: alumnoId } : {}) } };
    const cobrosTipos = tipoParam ? (tipoParam === 'FINE' ? [] : [tipoParam as 'BONUS' | 'SALARIO']) : ['BONUS' as const, 'SALARIO' as const];

    const [cobros, fines] = await Promise.all([
      cobrosTipos.length
        ? this.prisma.cobroPendiente.findMany({
            where: { tipo: { in: cobrosTipos }, cuenta: alumno },
            select: {
              id: true,
              tipo: true,
              monto: true,
              concepto: true,
              estado: true,
              creadoEn: true,
              cuenta: { select: { usuario: { select: { nombre: true, apellidos: true } } } },
            },
            orderBy: { creadoEn: 'desc' },
            take: MAXIMO_TRANSACCIONES,
          })
        : Promise.resolve([]),
      !tipoParam || tipoParam === 'FINE'
        ? this.prisma.transaccion.findMany({
            where: { tipo: 'FINE', cuenta: alumno },
            select: {
              id: true,
              monto: true,
              concepto: true,
              fecha: true,
              cuenta: { select: { usuario: { select: { nombre: true, apellidos: true } } } },
            },
            orderBy: { fecha: 'desc' },
            take: MAXIMO_TRANSACCIONES,
          })
        : Promise.resolve([]),
    ]);

    return [
      ...cobros.map((c) => ({
        id: c.id,
        tipo: c.tipo as 'BONUS' | 'SALARIO',
        monto: dinero(c.monto),
        concepto: c.concepto,
        fecha: c.creadoEn,
        estado: c.estado,
        alumno: nombre(c.cuenta.usuario),
      })),
      ...fines.map((f) => ({
        id: f.id,
        tipo: 'FINE' as const,
        monto: dinero(f.monto.abs()),
        concepto: f.concepto,
        fecha: f.fecha,
        estado: 'APLICADO' as const,
        alumno: nombre(f.cuenta.usuario),
      })),
    ]
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
      .slice(0, MAXIMO_TRANSACCIONES);
  }

  async eliminarConcepto(id: string, usuario: UsuarioAutenticado) {
    await this.conceptoConAcceso(id, usuario);
    await this.prisma.conceptoNomina.delete({ where: { id } });
  }

  /**
   * Emite un bonus (queda pendiente de cobro: el alumno lo cobra en su cuenta) o un fine
   * (se descuenta de inmediato; el saldo puede quedar negativo = deuda). Todo en una transacción.
   */
  async emitir(gradoId: string, dto: EmitirMovimientoDto, usuario: UsuarioAutenticado) {
    await this.verificarAcceso(usuario, gradoId);
    let monto: Prisma.Decimal;
    let tipo: 'BONUS' | 'FINE';
    let concepto: string;
    let conceptoId: string | null = null;
    if (dto.conceptoId) {
      // Concepto guardado: el tipo, el motivo y el monto salen del catálogo.
      const guardado = await this.prisma.conceptoNomina.findUnique({ where: { id: dto.conceptoId } });
      if (!guardado || guardado.gradoId !== gradoId) {
        throw new BadRequestException('El concepto no existe en esta clase.');
      }
      monto = guardado.monto;
      tipo = guardado.tipo === 'FINE' ? 'FINE' : 'BONUS';
      concepto = guardado.nombre;
      conceptoId = guardado.id;
    } else {
      // Movimiento único: motivo y monto escritos a mano.
      if (!dto.tipo || !dto.concepto || dto.monto === undefined) {
        throw new BadRequestException('Indica el tipo, el motivo y el monto, o elige un concepto guardado.');
      }
      monto = new Prisma.Decimal(dto.monto.toFixed(2));
      tipo = dto.tipo;
      concepto = dto.concepto;
    }

    return this.prisma.$transaction(async (tx) => {
      const alumnos = await tx.usuario.findMany({
        where: { id: { in: dto.alumnoIds }, gradoId, rol: 'ALUMNO', activo: true },
        select: { id: true, nombre: true, apellidos: true, cuenta: { select: { id: true, saldo: true } } },
      });
      if (alumnos.length !== dto.alumnoIds.length) {
        throw new BadRequestException('Todos los alumnos deben estar activos y pertenecer a esta clase.');
      }

      // Todo movimiento necesita una cuenta; si por alguna razón falta, se abre en 0.
      const cuentaIds = new Map<string, string>();
      for (const a of alumnos) {
        const cuenta = a.cuenta ?? (await tx.cuenta.create({ data: { usuarioId: a.id }, select: { id: true } }));
        cuentaIds.set(a.id, cuenta.id);
      }

      for (const a of alumnos) {
        const cuentaId = cuentaIds.get(a.id)!;
        if (tipo === 'BONUS') {
          await tx.cobroPendiente.create({
            data: { cuentaId, tipo: 'BONUS', monto, concepto },
          });
        } else {
          // El saldo puede quedar negativo: el alumno queda con una deuda.
          await tx.cuenta.update({ where: { id: cuentaId }, data: { saldo: { decrement: monto } } });
          await tx.transaccion.create({
            data: {
              cuentaId,
              tipo: 'FINE',
              monto: monto.negated(),
              concepto,
              creadoPorId: usuario.id,
            },
          });
        }
      }

      await tx.auditoria.create({
        data: {
          usuarioId: usuario.id,
          accion: tipo === 'BONUS' ? 'EMITIR_BONUS' : 'APLICAR_FINE',
          entidad: 'Grado',
          entidadId: gradoId,
          detalle: { monto: monto.toFixed(2), concepto, conceptoId, alumnoIds: dto.alumnoIds },
        },
      });

      return { tipo, alumnos: alumnos.length, montoPorAlumno: monto.toFixed(2) };
    });
  }
}
