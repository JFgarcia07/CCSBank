import { http } from '@/lib/http'
import type { ConceptoNomina, DatosConcepto, DatosMovimiento, DetalleNomina, TransaccionClase } from '@/types/nomina'

export const nominaService = {
  async detalle(gradoId: string): Promise<DetalleNomina> {
    const { data } = await http.get<DetalleNomina>(`/nomina/clases/${gradoId}`)
    return data
  },

  async transacciones(
    gradoId: string,
    tipo?: 'BONUS' | 'FINE' | 'SALARIO',
    alumnoId?: string,
  ): Promise<TransaccionClase[]> {
    const { data } = await http.get<TransaccionClase[]>(`/nomina/clases/${gradoId}/transacciones`, {
      params: { ...(tipo ? { tipo } : {}), ...(alumnoId ? { alumnoId } : {}) },
    })
    return data
  },

  async emitir(gradoId: string, datos: DatosMovimiento): Promise<{ alumnos: number }> {
    const { data } = await http.post<{ alumnos: number }>(`/nomina/clases/${gradoId}/movimientos`, datos)
    return data
  },

  async quitarMovimiento(id: string): Promise<void> {
    await http.delete(`/nomina/movimientos/${id}`)
  },

  async crearConcepto(gradoId: string, datos: DatosConcepto): Promise<ConceptoNomina> {
    const { data } = await http.post<ConceptoNomina>(`/nomina/clases/${gradoId}/conceptos`, datos)
    return data
  },

  async actualizarConcepto(id: string, datos: Partial<Omit<DatosConcepto, 'tipo'>>): Promise<ConceptoNomina> {
    const { data } = await http.patch<ConceptoNomina>(`/nomina/conceptos/${id}`, datos)
    return data
  },

  async eliminarConcepto(id: string): Promise<void> {
    await http.delete(`/nomina/conceptos/${id}`)
  },
}
