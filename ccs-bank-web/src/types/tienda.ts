export interface Producto {
  id: string
  nombre: string
  descripcion: string | null
  /** Decimal como texto, p. ej. "25.00". */
  precio: string
  stock: number
  activo: boolean
}

export interface CatalogoTienda {
  saldo: string
  productos: Producto[]
}

export interface ItemCompra {
  nombre: string
  cantidad: number
  precioUnitario: string
}

export interface CompraTienda {
  id: string
  total: string
  metodo: 'TRANSFERENCIA' | 'TARJETA'
  fecha: string
  entregadaEn: string | null
  items: ItemCompra[]
}

export interface CompraDeClase extends CompraTienda {
  alumno: string
}

export interface GestionTienda {
  productos: Producto[]
  compras: CompraDeClase[]
}

export interface ResultadoCompra {
  compraId: string
  total: string
  saldo: string
}

export interface FilaTarjeta {
  alumnoId: string
  alumno: string
  /** null = sin tarjeta. */
  estado: 'SOLICITADA' | 'ACTIVA' | 'BLOQUEADA' | null
  terminacion: string | null
}

export interface ConsultaTarjeta {
  alumno: string
  bloqueada: boolean
}

export interface ResultadoCobroTarjeta extends ResultadoCompra {
  alumno: string
}

export interface DatosProducto {
  nombre: string
  descripcion?: string
  precio: number
  stock: number
}
