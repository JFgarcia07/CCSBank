import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import { Prisma } from '../../generated/prisma/client.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ComprarDto } from './dto/comprar.dto.js';
import { ActualizarProductoDto, CrearProductoDto } from './dto/producto.dto.js';
import { CobroTarjetaDto } from './dto/tarjeta.dto.js';

const MAX_INTENTOS_PIN = 5;

const dinero = (d: Prisma.Decimal | null | undefined) => (d ?? new Prisma.Decimal(0)).toFixed(2);

const COMPRAS_RECIENTES = 50;

const selectProducto = {
  id: true,
  nombre: true,
  descripcion: true,
  precio: true,
  stock: true,
  activo: true,
} satisfies Prisma.ProductoSelect;

type ProductoFila = Prisma.ProductoGetPayload<{ select: typeof selectProducto }>;
const verProducto = (p: ProductoFila) => ({ ...p, precio: dinero(p.precio) });

const selectCompra = {
  id: true,
  total: true,
  metodo: true,
  fecha: true,
  entregadaEn: true,
  items: { select: { cantidad: true, precioUnitario: true, producto: { select: { nombre: true } } } },
} satisfies Prisma.CompraSelect;

type CompraFila = Prisma.CompraGetPayload<{ select: typeof selectCompra }>;
const verCompra = (c: CompraFila) => ({
  id: c.id,
  total: dinero(c.total),
  metodo: c.metodo,
  fecha: c.fecha,
  entregadaEn: c.entregadaEn,
  items: c.items.map((i) => ({
    nombre: i.producto.nombre,
    cantidad: i.cantidad,
    precioUnitario: dinero(i.precioUnitario),
  })),
});

@Injectable()
export class TiendaService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────── Alumno ─────────────────────────

  /** Saldo y productos disponibles (activos y con stock) de la clase del alumno. */
  async catalogo(usuario: UsuarioAutenticado) {
    const alumno = await this.prisma.usuario.findUnique({
      where: { id: usuario.id },
      select: { gradoId: true, cuenta: { select: { saldo: true } } },
    });
    const productos = alumno?.gradoId
      ? await this.prisma.producto.findMany({
          where: { gradoId: alumno.gradoId, activo: true, stock: { gt: 0 } },
          select: selectProducto,
          orderBy: { nombre: 'asc' },
        })
      : [];
    return { saldo: dinero(alumno?.cuenta?.saldo), productos: productos.map(verProducto) };
  }

  /**
   * Compra por transferencia (descuenta del saldo). Una compra NUNCA deja deuda: el saldo debe
   * alcanzar. Todo ocurre en una transacción y con descuentos condicionados, así dos compras
   * simultáneas no pueden gastar dos veces el mismo dinero ni pasarse del stock.
   */
  async comprar(usuario: UsuarioAutenticado, dto: ComprarDto) {
    return this.comprarEn(usuario.id, this.unirPedido(dto), 'TRANSFERENCIA', usuario.id);
  }

  /** Une líneas repetidas del mismo producto. */
  private unirPedido(dto: ComprarDto) {
    const pedido = new Map<string, number>();
    for (const i of dto.items) pedido.set(i.productoId, (pedido.get(i.productoId) ?? 0) + i.cantidad);
    for (const cantidad of pedido.values()) {
      if (cantidad > 20) throw new BadRequestException('La cantidad máxima por producto es 20.');
    }
    return pedido;
  }

  /** Compra completa en una transacción. `ejecutorId` es quien la realiza (el alumno o el docente con tarjeta). */
  private comprarEn(
    alumnoId: string,
    pedido: Map<string, number>,
    metodo: 'TRANSFERENCIA' | 'TARJETA',
    ejecutorId: string,
    gradoRequerido?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const alumno = await tx.usuario.findUnique({ where: { id: alumnoId }, select: { gradoId: true } });
      if (!alumno?.gradoId || (gradoRequerido && alumno.gradoId !== gradoRequerido)) {
        throw new ForbiddenException('El alumno no pertenece a esta clase.');
      }
      const cuenta = await tx.cuenta.upsert({
        where: { usuarioId: alumnoId },
        create: { usuarioId: alumnoId },
        update: {},
        select: { id: true },
      });

      const productos = await tx.producto.findMany({
        where: { id: { in: [...pedido.keys()] }, gradoId: alumno.gradoId, activo: true },
        select: { id: true, nombre: true, precio: true },
      });
      if (productos.length !== pedido.size) {
        throw new NotFoundException('Alguno de los productos ya no está disponible. Actualiza la tienda.');
      }

      let total = new Prisma.Decimal(0);
      for (const p of productos) total = total.plus(p.precio.times(pedido.get(p.id)!));

      for (const p of productos) {
        const cantidad = pedido.get(p.id)!;
        const { count } = await tx.producto.updateMany({
          where: { id: p.id, activo: true, stock: { gte: cantidad } },
          data: { stock: { decrement: cantidad } },
        });
        if (!count) throw new ConflictException(`No hay suficiente stock de "${p.nombre}".`);
      }

      const { count: cobrado } = await tx.cuenta.updateMany({
        where: { id: cuenta.id, saldo: { gte: total } },
        data: { saldo: { decrement: total } },
      });
      if (!cobrado) throw new ConflictException('No tienes saldo suficiente para esta compra.');

      const resumen = productos.map((p) => `${pedido.get(p.id)}× ${p.nombre}`).join(', ');
      const compra = await tx.compra.create({
        data: {
          alumnoId,
          total,
          metodo,
          items: {
            create: productos.map((p) => ({
              productoId: p.id,
              cantidad: pedido.get(p.id)!,
              precioUnitario: p.precio,
            })),
          },
        },
        select: { id: true },
      });
      await tx.transaccion.create({
        data: {
          cuentaId: cuenta.id,
          tipo: 'COMPRA',
          monto: total.negated(),
          concepto: `Tienda: ${resumen}`.slice(0, 200),
          creadoPorId: ejecutorId,
        },
      });
      await tx.auditoria.create({
        data: {
          usuarioId: ejecutorId,
          accion: 'COMPRA_TIENDA',
          entidad: 'Compra',
          entidadId: compra.id,
          detalle: { total: total.toFixed(2), metodo, alumnoId, productos: resumen },
        },
      });

      const saldo = await tx.cuenta.findUnique({ where: { id: cuenta.id }, select: { saldo: true } });
      return { compraId: compra.id, total: dinero(total), saldo: dinero(saldo?.saldo) };
    });
  }

  async misCompras(usuario: UsuarioAutenticado) {
    const compras = await this.prisma.compra.findMany({
      where: { alumnoId: usuario.id },
      select: selectCompra,
      orderBy: { fecha: 'desc' },
      take: COMPRAS_RECIENTES,
    });
    return compras.map(verCompra);
  }

  // ───────────────────── Docente / admin ─────────────────────

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

  private async productoConAcceso(id: string, usuario: UsuarioAutenticado) {
    const p = await this.prisma.producto.findUnique({ where: { id }, select: { id: true, gradoId: true, nombre: true } });
    if (!p) throw new NotFoundException('El producto no existe.');
    await this.verificarAcceso(usuario, p.gradoId);
    return p;
  }

  /** Productos de la clase (incluye los ocultos) y las compras recientes. */
  async gestion(gradoId: string, usuario: UsuarioAutenticado) {
    await this.verificarAcceso(usuario, gradoId);
    const [productos, compras] = await Promise.all([
      this.prisma.producto.findMany({ where: { gradoId }, select: selectProducto, orderBy: { nombre: 'asc' } }),
      this.prisma.compra.findMany({
        where: { alumno: { gradoId } },
        select: { ...selectCompra, alumno: { select: { nombre: true, apellidos: true } } },
        orderBy: { fecha: 'desc' },
        take: COMPRAS_RECIENTES,
      }),
    ]);
    return {
      productos: productos.map(verProducto),
      compras: compras.map((c) => ({ ...verCompra(c), alumno: `${c.alumno.nombre} ${c.alumno.apellidos}` })),
    };
  }

  async crearProducto(gradoId: string, dto: CrearProductoDto, usuario: UsuarioAutenticado) {
    await this.verificarAcceso(usuario, gradoId);
    try {
      const p = await this.prisma.$transaction(async (tx) => {
        const creado = await tx.producto.create({
          data: { gradoId, nombre: dto.nombre, descripcion: dto.descripcion || null, precio: dto.precio, stock: dto.stock },
          select: selectProducto,
        });
        await tx.auditoria.create({
          data: {
            usuarioId: usuario.id,
            accion: 'CREAR_PRODUCTO',
            entidad: 'Producto',
            entidadId: creado.id,
            detalle: { nombre: dto.nombre, precio: dto.precio, stock: dto.stock },
          },
        });
        return creado;
      });
      return verProducto(p);
    } catch (e) {
      throw this.traducir(e);
    }
  }

  async actualizarProducto(id: string, dto: ActualizarProductoDto, usuario: UsuarioAutenticado) {
    await this.productoConAcceso(id, usuario);
    try {
      const p = await this.prisma.$transaction(async (tx) => {
        const act = await tx.producto.update({
          where: { id },
          data: {
            nombre: dto.nombre,
            descripcion: dto.descripcion === undefined ? undefined : dto.descripcion || null,
            precio: dto.precio,
            stock: dto.stock,
            activo: dto.activo,
          },
          select: selectProducto,
        });
        await tx.auditoria.create({
          data: { usuarioId: usuario.id, accion: 'EDITAR_PRODUCTO', entidad: 'Producto', entidadId: id, detalle: { ...dto } },
        });
        return act;
      });
      return verProducto(p);
    } catch (e) {
      throw this.traducir(e);
    }
  }

  async eliminarProducto(id: string, usuario: UsuarioAutenticado) {
    const p = await this.productoConAcceso(id, usuario);
    const ventas = await this.prisma.compraItem.count({ where: { productoId: id } });
    if (ventas > 0) {
      throw new ConflictException('Este producto ya tiene compras. Ocúltalo de la tienda en lugar de eliminarlo.');
    }
    await this.prisma.$transaction([
      this.prisma.producto.delete({ where: { id } }),
      this.prisma.auditoria.create({
        data: { usuarioId: usuario.id, accion: 'ELIMINAR_PRODUCTO', entidad: 'Producto', entidadId: id, detalle: { nombre: p.nombre } },
      }),
    ]);
  }

  /** Marca la compra como entregada (o la vuelve a pendiente si `entregada` es false). */
  async marcarEntrega(compraId: string, entregada: boolean, usuario: UsuarioAutenticado) {
    const compra = await this.prisma.compra.findUnique({
      where: { id: compraId },
      select: { id: true, alumno: { select: { gradoId: true } } },
    });
    if (!compra?.alumno.gradoId) throw new NotFoundException('La compra no existe.');
    await this.verificarAcceso(usuario, compra.alumno.gradoId);
    await this.prisma.$transaction([
      this.prisma.compra.update({ where: { id: compraId }, data: { entregadaEn: entregada ? new Date() : null } }),
      this.prisma.auditoria.create({
        data: {
          usuarioId: usuario.id,
          accion: entregada ? 'ENTREGAR_COMPRA' : 'DESHACER_ENTREGA',
          entidad: 'Compra',
          entidadId: compraId,
        },
      }),
    ]);
  }

  // ───────────────────── Tarjetas NFC ─────────────────────

  /** El UID se guarda siempre igual (mayúsculas y sin espacios) para que coincida al leerlo. */
  private normalizarUid(uid: string) {
    return uid.replace(/\s+/g, '').toUpperCase();
  }

  /** Alumnos de la clase con el estado de su tarjeta (el UID completo no se muestra). */
  async tarjetas(gradoId: string, usuario: UsuarioAutenticado) {
    await this.verificarAcceso(usuario, gradoId);
    const alumnos = await this.prisma.usuario.findMany({
      where: { gradoId, rol: 'ALUMNO', activo: true },
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        tarjeta: { select: { estado: true, uidNfc: true, intentosFallidos: true } },
      },
      orderBy: [{ apellidos: 'asc' }, { nombre: 'asc' }],
    });
    return alumnos.map((a) => ({
      alumnoId: a.id,
      alumno: `${a.nombre} ${a.apellidos}`,
      estado: a.tarjeta?.uidNfc ? a.tarjeta.estado : null,
      terminacion: a.tarjeta?.uidNfc ? a.tarjeta.uidNfc.slice(-4) : null,
    }));
  }

  private async alumnoConAcceso(alumnoId: string, usuario: UsuarioAutenticado) {
    const a = await this.prisma.usuario.findUnique({
      where: { id: alumnoId },
      select: { id: true, rol: true, gradoId: true, nombre: true, apellidos: true },
    });
    if (!a || a.rol !== 'ALUMNO' || !a.gradoId) throw new NotFoundException('El alumno no existe.');
    await this.verificarAcceso(usuario, a.gradoId);
    return a as typeof a & { gradoId: string };
  }

  /** Vincula (o reemplaza) la tarjeta del alumno y define su PIN. */
  async registrarTarjeta(alumnoId: string, uidCrudo: string, pin: string, usuario: UsuarioAutenticado) {
    const alumno = await this.alumnoConAcceso(alumnoId, usuario);
    const uid = this.normalizarUid(uidCrudo);
    const pinHash = await bcrypt.hash(pin, 10);
    try {
      await this.prisma.$transaction([
        this.prisma.tarjeta.upsert({
          where: { usuarioId: alumnoId },
          create: { usuarioId: alumnoId, uidNfc: uid, pinHash, estado: 'ACTIVA' },
          update: { uidNfc: uid, pinHash, estado: 'ACTIVA', intentosFallidos: 0 },
        }),
        this.prisma.auditoria.create({
          data: {
            usuarioId: usuario.id,
            accion: 'REGISTRAR_TARJETA',
            entidad: 'Tarjeta',
            entidadId: alumnoId,
            detalle: { alumno: `${alumno.nombre} ${alumno.apellidos}`, terminacion: uid.slice(-4) },
          },
        }),
      ]);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Esa tarjeta ya está registrada a otro alumno.');
      }
      throw e;
    }
  }

  async cambiarEstadoTarjeta(alumnoId: string, bloquear: boolean, usuario: UsuarioAutenticado) {
    await this.alumnoConAcceso(alumnoId, usuario);
    const t = await this.prisma.tarjeta.findUnique({ where: { usuarioId: alumnoId }, select: { uidNfc: true } });
    if (!t?.uidNfc) throw new NotFoundException('El alumno no tiene tarjeta registrada.');
    await this.prisma.$transaction([
      this.prisma.tarjeta.update({
        where: { usuarioId: alumnoId },
        data: { estado: bloquear ? 'BLOQUEADA' : 'ACTIVA', intentosFallidos: 0 },
      }),
      this.prisma.auditoria.create({
        data: {
          usuarioId: usuario.id,
          accion: bloquear ? 'BLOQUEAR_TARJETA' : 'ACTIVAR_TARJETA',
          entidad: 'Tarjeta',
          entidadId: alumnoId,
        },
      }),
    ]);
  }

  async quitarTarjeta(alumnoId: string, usuario: UsuarioAutenticado) {
    await this.alumnoConAcceso(alumnoId, usuario);
    await this.prisma.$transaction([
      this.prisma.tarjeta.deleteMany({ where: { usuarioId: alumnoId } }),
      this.prisma.auditoria.create({
        data: { usuarioId: usuario.id, accion: 'QUITAR_TARJETA', entidad: 'Tarjeta', entidadId: alumnoId },
      }),
    ]);
  }

  private tarjetaPorUid(uidCrudo: string) {
    return this.prisma.tarjeta.findUnique({
      where: { uidNfc: this.normalizarUid(uidCrudo) },
      select: {
        id: true,
        estado: true,
        pinHash: true,
        usuario: { select: { id: true, nombre: true, apellidos: true, gradoId: true, activo: true } },
      },
    });
  }

  /** Dice de quién es la tarjeta (solo si es alumno de esta clase) antes de pedir el PIN. */
  async consultarTarjeta(gradoId: string, uid: string, usuario: UsuarioAutenticado) {
    await this.verificarAcceso(usuario, gradoId);
    const t = await this.tarjetaPorUid(uid);
    if (!t || t.usuario.gradoId !== gradoId || !t.usuario.activo) {
      throw new NotFoundException('Esta tarjeta no está registrada en esta clase.');
    }
    return {
      alumno: `${t.usuario.nombre} ${t.usuario.apellidos}`,
      bloqueada: t.estado !== 'ACTIVA',
    };
  }

  /**
   * Cobro en tienda con tarjeta: UID + PIN. El PIN se valida aquí; tras 5 errores seguidos la
   * tarjeta se bloquea y solo un docente puede reactivarla.
   */
  async cobrarConTarjeta(gradoId: string, dto: CobroTarjetaDto, usuario: UsuarioAutenticado) {
    await this.verificarAcceso(usuario, gradoId);
    const pedido = this.unirPedido(dto);
    const t = await this.tarjetaPorUid(dto.uid);
    if (!t || t.usuario.gradoId !== gradoId || !t.usuario.activo) {
      throw new NotFoundException('Esta tarjeta no está registrada en esta clase.');
    }
    if (t.estado !== 'ACTIVA' || !t.pinHash) {
      throw new ForbiddenException('Esta tarjeta está bloqueada. Un docente debe reactivarla.');
    }

    if (!(await bcrypt.compare(dto.pin, t.pinHash))) {
      const { intentosFallidos } = await this.prisma.tarjeta.update({
        where: { id: t.id },
        data: { intentosFallidos: { increment: 1 } },
        select: { intentosFallidos: true },
      });
      if (intentosFallidos >= MAX_INTENTOS_PIN) {
        await this.prisma.$transaction([
          this.prisma.tarjeta.update({ where: { id: t.id }, data: { estado: 'BLOQUEADA' } }),
          this.prisma.auditoria.create({
            data: { usuarioId: usuario.id, accion: 'TARJETA_BLOQUEADA_PIN', entidad: 'Tarjeta', entidadId: t.usuario.id },
          }),
        ]);
        throw new ForbiddenException('PIN incorrecto demasiadas veces. La tarjeta quedó bloqueada.');
      }
      const quedan = MAX_INTENTOS_PIN - intentosFallidos;
      throw new ForbiddenException(`PIN incorrecto. Te ${quedan === 1 ? 'queda 1 intento' : `quedan ${quedan} intentos`}.`);
    }

    const r = await this.comprarEn(t.usuario.id, pedido, 'TARJETA', usuario.id, gradoId);
    await this.prisma.tarjeta.update({ where: { id: t.id }, data: { intentosFallidos: 0 } });
    return { ...r, alumno: `${t.usuario.nombre} ${t.usuario.apellidos}` };
  }

  private traducir(e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return new ConflictException('Ya existe un producto con ese nombre en esta clase.');
    }
    return e;
  }
}
