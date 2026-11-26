import type { Rol } from '@/types/auth'

export interface UsuarioListado {
  id: string
  /** Nombre de usuario (alumnos) o correo (docentes). */
  carne: string
  email: string | null
  nombre: string
  apellidos: string
  rol: Rol
  activo: boolean
  gradoId: string | null
  grado: { nombre: string } | null
  creadoEn: string
}

export interface DatosDocente {
  nombre: string
  apellidos: string
  email: string
  password: string
}

export interface DatosAlumno {
  nombre: string
  apellidos: string
  username: string
  password: string
  gradoId?: string
}

/** Edición: solo viajan los campos que aplican al tipo de cuenta. */
export interface DatosEdicion {
  nombre: string
  apellidos: string
  email?: string
  username?: string
  gradoId?: string | null
  activo: boolean
  password?: string
}
