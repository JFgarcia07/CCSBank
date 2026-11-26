import type { Rol } from '@/types/auth'

export interface ClasePerfil {
  id: string
  nombre: string
}

export interface Perfil {
  id: string
  carne: string
  email: string | null
  nombre: string
  apellidos: string
  rol: Rol
  gradoId: string | null
  /** Alumno: su clase. Docente: las clases que tiene asignadas. */
  clases: ClasePerfil[]
  /** URL temporal de la foto (null si no tiene). */
  fotoUrl: string | null
  tieneCv: boolean
}
