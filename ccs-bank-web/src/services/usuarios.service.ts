import { http } from '@/lib/http'
import type { DatosAlumno, DatosDocente, DatosEdicion, UsuarioListado } from '@/types/usuario'

export const usuariosService = {
  async listarDocentes(): Promise<UsuarioListado[]> {
    const { data } = await http.get<UsuarioListado[]>('/usuarios/docentes')
    return data
  },

  async listarAdmins(): Promise<UsuarioListado[]> {
    const { data } = await http.get<UsuarioListado[]>('/usuarios/admins')
    return data
  },

  async crearAdmin(datos: DatosDocente): Promise<UsuarioListado> {
    const { data } = await http.post<UsuarioListado>('/usuarios/admins', datos)
    return data
  },

  async listarAlumnos(): Promise<UsuarioListado[]> {
    const { data } = await http.get<UsuarioListado[]>('/usuarios/alumnos')
    return data
  },

  async crearDocente(datos: DatosDocente): Promise<UsuarioListado> {
    const { data } = await http.post<UsuarioListado>('/usuarios/docentes', datos)
    return data
  },

  async crearAlumno(datos: DatosAlumno): Promise<UsuarioListado> {
    const { data } = await http.post<UsuarioListado>('/usuarios/alumnos', datos)
    return data
  },

  async actualizar(id: string, datos: DatosEdicion): Promise<UsuarioListado> {
    const { data } = await http.patch<UsuarioListado>(`/usuarios/${id}`, datos)
    return data
  },

  async eliminar(id: string): Promise<void> {
    await http.delete(`/usuarios/${id}`)
  },
}
