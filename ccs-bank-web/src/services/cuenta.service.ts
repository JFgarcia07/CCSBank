import { http } from '@/lib/http'
import type { EstadoDeCuenta, FiltrosEstado, ResultadoCobro, ResumenCuenta } from '@/types/cuenta'

export const cuentaService = {
  async resumen(): Promise<ResumenCuenta> {
    const { data } = await http.get<ResumenCuenta>('/cuenta')
    return data
  },

  async estadoDeCuenta(filtros: FiltrosEstado = {}): Promise<EstadoDeCuenta> {
    const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== undefined && v !== ''))
    const { data } = await http.get<EstadoDeCuenta>('/cuenta/movimientos', { params })
    return data
  },

  async cobrar(id: string): Promise<ResultadoCobro> {
    const { data } = await http.post<ResultadoCobro>(`/cuenta/cobros/${id}/cobrar`)
    return data
  },

  async cobrarTodo(): Promise<ResultadoCobro> {
    const { data } = await http.post<ResultadoCobro>('/cuenta/cobros/cobrar-todo')
    return data
  },
}
