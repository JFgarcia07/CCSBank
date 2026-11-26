export type TipoMovimiento = 'BONUS' | 'FINE'

export interface AlumnoNomina {
  id: string
  carne: string
  nombre: string
  apellidos: string
  /** Montos como texto con 2 decimales. */
  saldo: string
  bonusPorCobrar: string
}

export interface MovimientoNomina {
  id: string
  tipo: TipoMovimiento
  monto: string
  concepto: string
  fecha: string
  /** Bonus: PENDIENTE (aún sin cobrar) o COBRADO. Fine: APLICADO. */
  estado: 'PENDIENTE' | 'COBRADO' | 'APLICADO'
  alumno: string
}

/** Transacción de la clase: bonus, fine o salario. */
export interface TransaccionClase {
  id: string
  tipo: TipoMovimiento | 'SALARIO'
  monto: string
  concepto: string
  fecha: string
  estado: 'PENDIENTE' | 'COBRADO' | 'APLICADO'
  alumno: string
}

export interface ConceptoNomina {
  id: string
  tipo: TipoMovimiento
  /** Se usa como motivo del movimiento. */
  nombre: string
  monto: string
}

export interface DetalleNomina {
  alumnos: AlumnoNomina[]
  movimientos: MovimientoNomina[]
  conceptos: ConceptoNomina[]
}

/** Con `conceptoId` se usa un concepto guardado; sin él, tipo + concepto + monto escritos a mano. */
export type DatosMovimiento =
  | { conceptoId: string; alumnoIds: string[] }
  | { tipo: TipoMovimiento; concepto: string; monto: number; alumnoIds: string[] }

export interface DatosConcepto {
  tipo: TipoMovimiento
  nombre: string
  monto: number
}
