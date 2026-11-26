import { http } from '@/lib/http'
import type { MiTrabajo, ReportesSemana } from '@/types/reportes'

export const reportesService = {
  // ───── Alumno ─────
  async miTrabajo(): Promise<MiTrabajo> {
    const { data } = await http.get<MiTrabajo>('/trabajo')
    return data
  },

  async subir(archivo: File): Promise<void> {
    const form = new FormData()
    form.append('archivo', archivo)
    await http.post('/trabajo/reportes', form, { timeout: 60000 })
  },

  // ───── Alumno y docente ─────
  async urlDelArchivo(id: string): Promise<string> {
    const { data } = await http.get<{ url: string }>(`/reportes/${id}/url`)
    return data.url
  },

  // ───── Maestro / Admin ─────
  async delaSemana(gradoId: string, semana?: string): Promise<ReportesSemana> {
    const { data } = await http.get<ReportesSemana>(`/nomina/clases/${gradoId}/reportes`, {
      params: semana ? { semana } : undefined,
    })
    return data
  },

  async revisar(id: string, estado: 'APROBADO' | 'RECHAZADO', comentario?: string): Promise<void> {
    await http.post(`/nomina/reportes/${id}/revision`, { estado, ...(comentario ? { comentario } : {}) })
  },

  async pagarSalarios(gradoId: string, semana: string): Promise<{ pagados: number; total: string }> {
    const { data } = await http.post<{ pagados: number; total: string }>(`/nomina/clases/${gradoId}/salarios`, {
      semana,
    })
    return data
  },
}
