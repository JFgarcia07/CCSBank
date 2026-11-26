import { http } from '@/lib/http'
import type { ClaseAula, DatosTrabajo, DetalleAula, ResumenAula, TrabajoAula } from '@/types/aula'

export const aulaService = {
  async clases(): Promise<ClaseAula[]> {
    const { data } = await http.get<ClaseAula[]>('/aula/clases')
    return data
  },

  /** Resumen y trabajos de la clase en una sola petición. */
  async detalle(gradoId: string): Promise<DetalleAula> {
    const { data } = await http.get<DetalleAula>(`/aula/clases/${gradoId}`)
    return data
  },

  async resumen(gradoId: string): Promise<ResumenAula> {
    const { data } = await http.get<ResumenAula>(`/aula/clases/${gradoId}/resumen`)
    return data
  },

  async trabajos(gradoId: string): Promise<TrabajoAula[]> {
    const { data } = await http.get<TrabajoAula[]>(`/aula/clases/${gradoId}/trabajos`)
    return data
  },

  async crearTrabajo(gradoId: string, datos: DatosTrabajo): Promise<TrabajoAula> {
    const { data } = await http.post<TrabajoAula>(`/aula/clases/${gradoId}/trabajos`, datos)
    return data
  },

  async actualizarTrabajo(id: string, datos: Partial<DatosTrabajo>): Promise<TrabajoAula> {
    const { data } = await http.patch<TrabajoAula>(`/aula/trabajos/${id}`, datos)
    return data
  },

  async eliminarTrabajo(id: string): Promise<void> {
    await http.delete(`/aula/trabajos/${id}`)
  },

  /** alumnoId null = dejar el trabajo libre. */
  async asignar(trabajoId: string, alumnoId: string | null): Promise<TrabajoAula> {
    const { data } = await http.put<TrabajoAula>(`/aula/trabajos/${trabajoId}/asignado`, { alumnoId })
    return data
  },

  /** Quita a todos los alumnos de sus trabajos. Devuelve cuántos quedaron libres. */
  async liberarTodos(gradoId: string): Promise<number> {
    const { data } = await http.post<{ liberados: number }>(`/aula/clases/${gradoId}/trabajos/liberar-todos`)
    return data.liberados
  },
}
