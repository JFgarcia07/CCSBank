export interface PagoPendiente {
  id: string
  tipo: 'SALARIO' | 'BONUS'
  /** Monto como texto con 2 decimales. */
  monto: string
  concepto: string
  creadoEn: string
}

export interface ResumenCuenta {
  /** Puede ser negativo: el alumno tiene una deuda. */
  saldo: string
  enDeuda: boolean
  totalPendiente: string
  pendientes: PagoPendiente[]
}

export interface ResultadoCobro {
  cobrados: number
  total: string
  saldo: string
}

export type TipoMovimientoCuenta = 'SALARIO' | 'BONUS' | 'FINE' | 'COMPRA' | 'TRANSFERENCIA' | 'PRESTAMO'

export interface MovimientoCuenta {
  id: string
  tipo: TipoMovimientoCuenta
  /** Con signo: positivo = ingreso, negativo = egreso. */
  monto: string
  concepto: string
  fecha: string
  /** Saldo que quedó justo después de este movimiento. */
  saldoDespues: string
}

export interface EstadoDeCuenta {
  saldo: string
  /** Sumas de lo que muestran los filtros actuales. */
  totalIngresos: string
  totalEgresos: string
  total: number
  pagina: number
  porPagina: number
  movimientos: MovimientoCuenta[]
}

export interface FiltrosEstado {
  tipo?: TipoMovimientoCuenta
  desde?: string
  hasta?: string
  pagina?: number
}
