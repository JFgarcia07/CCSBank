export type EstadoReporte = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO'

export interface ReporteAlumno {
  id: string
  /** Lunes de la semana (AAAA-MM-DD). */
  semana: string
  trabajo: string
  estado: EstadoReporte
  comentario: string | null
  enviadoEn: string
  pagado: boolean
}

export interface MiTrabajo {
  semanaActual: string
  trabajo: { id: string; nombre: string; descripcion: string | null; salarioSemanal: string } | null
  reportes: ReporteAlumno[]
}

export interface FilaReporte {
  alumnoId: string
  nombre: string
  apellidos: string
  trabajo: string
  salario: string
  reporte: {
    id: string
    estado: EstadoReporte
    comentario: string | null
    enviadoEn: string
    pagado: boolean
  } | null
}

export interface ReportesSemana {
  semana: string
  semanaActual: string
  filas: FilaReporte[]
}
