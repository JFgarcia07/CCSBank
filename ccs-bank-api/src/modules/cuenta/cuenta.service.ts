import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const dinero = (d: Prisma.Decimal | null | undefined) => (d ?? new Prisma.Decimal(0)).toFixed(2);

type Tx = Prisma.TransactionClient;

const POR_PAGINA = 25;
const TIPOS_ESTADO = ['SALARIO', 'BONUS', 'FINE', 'COMPRA', 'TRANSFERENCIA', 'PRESTAMO'] as const;

@Injectable()
export class CuentaService {
  constructor(private readonly prisma: PrismaService) {}

  /** La cuenta se abre al crear al alumno; si por alguna razón falta, se abre en 0. */
  private cuentaDe(usuarioId: string, tx: Tx | PrismaService = this.prisma) {
    return tx.cuenta.upsert({
      where: { usuarioId },
      create: { usuarioId },
      update: {},
      select: { id: true, saldo: true },
    });
  }

  /** Saldo (puede ser negativo si el alumno tiene una deuda) y cobros pendientes. */
  async resumen(usuario: UsuarioAutenticado) {
    const cuenta = await this.cuentaDe(usuario.id);
    const pendientes = await this.prisma.cobroPendiente.findMany({
      where: { cuentaId: cuenta.id, estado: 'PENDIENTE' },
      select: { id: true, tipo: true, monto: true, concepto: true, creadoEn: true },
      orderBy: { creadoEn: 'desc' },
    });
    const totalPendiente = pendientes.reduce((suma, p) => suma.plus(p.monto), new Prisma.Decimal(0));

    return {
      saldo: dinero(cuenta.saldo),
      enDeuda: cuenta.saldo.isNegative() && !cuenta.saldo.isZero(),
      totalPendiente: dinero(totalPendiente),
      pendientes: pendientes.map((p) => ({
        id: p.id,
        tipo: p.tipo,
        monto: dinero(p.monto),
        concepto: p.concepto,
        creadoEn: p.creadoEn,
      })),
    };
  }

  /**
   * Estado de cuenta: historial de movimientos con el saldo que quedó después de cada uno.
   * El saldo se reconstruye hacia atrás desde el saldo actual, así siempre cuadra con la cuenta.
   * Los filtros (tipo y fechas) solo limitan lo que se muestra; el saldo de cada fila no cambia.
   */
  async estadoDeCuenta(
    usuario: UsuarioAutenticado,
    filtros: { tipo?: string; desde?: string; hasta?: string; pagina?: number },
  ) {
    const { tipo, desde, hasta } = filtros;
    if (tipo && !TIPOS_ESTADO.includes(tipo as (typeof TIPOS_ESTADO)[number])) {
      throw new BadRequestException('El tipo de movimiento no es válido.');
    }
    const inicio = desde ? this.dia(desde, 'desde', false) : null;
    const fin = hasta ? this.dia(hasta, 'hasta', true) : null;
    if (inicio && fin && inicio > fin) throw new BadRequestException('La fecha "desde" va después de "hasta".');
    const pagina = Math.max(1, Math.floor(filtros.pagina ?? 1) || 1);

    const cuenta = await this.cuentaDe(usuario.id);
    const todos = await this.prisma.transaccion.findMany({
      where: { cuentaId: cuenta.id },
      select: { id: true, tipo: true, monto: true, concepto: true, fecha: true },
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    });

    let corriente = cuenta.saldo;
    const filas = todos.map((t) => {
      const saldoDespues = corriente;
      corriente = corriente.minus(t.monto);
      return { t, saldoDespues };
    });

    const visibles = filas.filter(
      ({ t }) => (!tipo || t.tipo === tipo) && (!inicio || t.fecha >= inicio) && (!fin || t.fecha <= fin),
    );
    const sumar = (signo: 1 | -1) =>
      visibles.reduce(
        (s, { t }) => (t.monto.isPositive() === (signo === 1) && !t.monto.isZero() ? s.plus(t.monto.abs()) : s),
        new Prisma.Decimal(0),
      );

    const desdeFila = (pagina - 1) * POR_PAGINA;
    return {
      saldo: dinero(cuenta.saldo),
      totalIngresos: dinero(sumar(1)),
      totalEgresos: dinero(sumar(-1)),
      total: visibles.length,
      pagina,
      porPagina: POR_PAGINA,
      movimientos: visibles.slice(desdeFila, desdeFila + POR_PAGINA).map(({ t, saldoDespues }) => ({
        id: t.id,
        tipo: t.tipo,
        monto: dinero(t.monto), // con signo: positivo = ingreso, negativo = egreso
        concepto: t.concepto,
        fecha: t.fecha,
        saldoDespues: dinero(saldoDespues),
      })),
    };
  }

  /** Convierte AAAA-MM-DD en el inicio (o fin) de ese día con la hora de Guatemala (UTC-6). */
  private dia(valor: string, campo: string, finDelDia: boolean): Date {
    const f = new Date(`${valor}T${finDelDia ? '23:59:59.999' : '00:00:00.000'}-06:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number.isNaN(f.getTime())) {
      throw new BadRequestException(`La fecha "${campo}" debe tener formato AAAA-MM-DD.`);
    }
    return f;
  }

  /**
   * Cobra un pago pendiente (cobroId) o todos (sin cobroId). Cada cobro crea su Transaccion y
   * el saldo se actualiza en la misma transacción. Un cobro no se puede cobrar dos veces.
   */
  async cobrar(usuario: UsuarioAutenticado, cobroId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const cuenta = await this.cuentaDe(usuario.id, tx);
      const candidatos = await tx.cobroPendiente.findMany({
        where: { cuentaId: cuenta.id, estado: 'PENDIENTE', ...(cobroId ? { id: cobroId } : {}) },
        select: { id: true, tipo: true, monto: true, concepto: true },
      });

      if (!candidatos.length) {
        if (cobroId) {
          const existe = await tx.cobroPendiente.findFirst({ where: { id: cobroId, cuentaId: cuenta.id }, select: { id: true } });
          if (!existe) throw new NotFoundException('Ese pago no existe.');
          throw new ConflictException('Ese pago ya fue cobrado.');
        }
        throw new ConflictException('No tienes pagos pendientes por cobrar.');
      }

      const ahora = new Date();
      let total = new Prisma.Decimal(0);
      let cobrados = 0;

      for (const c of candidatos) {
        // Solo cobra si sigue pendiente (evita cobrarlo dos veces si se hacen dos clics a la vez).
        const { count } = await tx.cobroPendiente.updateMany({
          where: { id: c.id, estado: 'PENDIENTE' },
          data: { estado: 'COBRADO', cobradoEn: ahora },
        });
        if (!count) continue;
        await tx.transaccion.create({
          data: {
            cuentaId: cuenta.id,
            tipo: c.tipo,
            monto: c.monto,
            concepto: c.concepto,
            creadoPorId: usuario.id,
          },
        });
        total = total.plus(c.monto);
        cobrados++;
      }

      if (!cobrados) throw new ConflictException('Ese pago ya fue cobrado.');

      const actualizada = await tx.cuenta.update({
        where: { id: cuenta.id },
        data: { saldo: { increment: total } },
        select: { saldo: true },
      });
      await tx.auditoria.create({
        data: {
          usuarioId: usuario.id,
          accion: 'COBRAR_PAGOS',
          entidad: 'Cuenta',
          entidadId: cuenta.id,
          detalle: { cobrados, total: total.toFixed(2) },
        },
      });

      return { cobrados, total: dinero(total), saldo: dinero(actualizada.saldo) };
    });
  }
}
