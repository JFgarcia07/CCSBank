export type Rol = 'ALUMNO' | 'MAESTRO' | 'ADMIN'

export interface Usuario {
  id: string
  carne: string
  nombre: string
  apellidos: string
  rol: Rol
  gradoId: string | null
}

export interface RespuestaLogin {
  accessToken: string
  usuario: Usuario
}
