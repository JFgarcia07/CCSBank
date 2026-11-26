export interface ClaseAula {
  id: string
  nombre: string
  totalAlumnos: number
}

export interface AlumnoResumen {
  id: string
  carne: string
  nombre: string
  apellidos: string
  activo: boolean
  /** URL temporal de su foto (null si no tiene). */
  fotoUrl: string | null
  /** Montos como texto con 2 decimales (vienen de Decimal). */
  saldo: string
  bonus: string
  /** Bonus emitidos que el alumno aún no cobra. */
  bonusPorCobrar: string
  fines: string
  trabajo: { id: string; nombre: string } | null
}

export interface ResumenAula {
  totales: { saldo: string; bonus: string; bonusPorCobrar: string; fines: string }
  alumnos: AlumnoResumen[]
}

export interface TrabajoAula {
  id: string
  gradoId: string
  nombre: string
  /** Responsabilidades del trabajo. */
  descripcion: string | null
  salarioSemanal: string
  activo: boolean
  asignado: { asignacionId: string; alumnoId: string; nombre: string; apellidos: string } | null
}

export interface DatosTrabajo {
  nombre: string
  descripcion: string
  salarioSemanal: number
  activo?: boolean
}

export interface DetalleAula extends ResumenAula {
  trabajos: TrabajoAula[]
}
