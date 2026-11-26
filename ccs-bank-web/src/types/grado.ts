export interface Maestro {
  id: string
  carne: string
  nombre: string
  apellidos: string
  activo: boolean
}

export interface Grado {
  id: string
  nombre: string
  creadoEn: string
  totalAlumnos: number
  maestro: Maestro | null
}
