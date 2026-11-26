import { http } from '@/lib/http'
import type { Grado, Maestro } from '@/types/grado'

export const gradosService = {
  async listar(): Promise<Grado[]> {
    const { data } = await http.get<Grado[]>('/grados')
    return data
  },

  async listarMaestros(): Promise<Maestro[]> {
    const { data } = await http.get<Maestro[]>('/grados/maestros')
    return data
  },

  async crear(nombre: string, maestroId: string | null): Promise<Grado> {
    const { data } = await http.post<Grado>('/grados', { nombre, ...(maestroId ? { maestroId } : {}) })
    return data
  },

  /** Cambia nombre y docente en una sola petición. maestroId null = sin docente. */
  async actualizar(id: string, datos: { nombre: string; maestroId: string | null }): Promise<Grado> {
    const { data } = await http.patch<Grado>(`/grados/${id}`, datos)
    return data
  },

  async eliminar(id: string): Promise<void> {
    await http.delete(`/grados/${id}`)
  }
}
