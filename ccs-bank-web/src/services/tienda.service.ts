import { http } from '@/lib/http'
import type {
  CatalogoTienda,
  CompraTienda,
  ConsultaTarjeta,
  DatosProducto,
  FilaTarjeta,
  ResultadoCobroTarjeta,
  GestionTienda,
  Producto,
  ResultadoCompra,
} from '@/types/tienda'

export const tiendaService = {
  // Alumno
  async catalogo(): Promise<CatalogoTienda> {
    const { data } = await http.get<CatalogoTienda>('/tienda')
    return data
  },

  async comprar(items: { productoId: string; cantidad: number }[]): Promise<ResultadoCompra> {
    const { data } = await http.post<ResultadoCompra>('/tienda/compras', { items })
    return data
  },

  async misCompras(): Promise<CompraTienda[]> {
    const { data } = await http.get<CompraTienda[]>('/tienda/compras')
    return data
  },

  // Docente / admin
  async gestion(gradoId: string): Promise<GestionTienda> {
    const { data } = await http.get<GestionTienda>(`/nomina/clases/${gradoId}/tienda`)
    return data
  },

  async crearProducto(gradoId: string, datos: DatosProducto): Promise<Producto> {
    const { data } = await http.post<Producto>(`/nomina/clases/${gradoId}/productos`, datos)
    return data
  },

  async actualizarProducto(id: string, datos: Partial<DatosProducto> & { activo?: boolean }): Promise<Producto> {
    const { data } = await http.patch<Producto>(`/nomina/productos/${id}`, datos)
    return data
  },

  async eliminarProducto(id: string): Promise<void> {
    await http.delete(`/nomina/productos/${id}`)
  },

  async tarjetas(gradoId: string): Promise<FilaTarjeta[]> {
    const { data } = await http.get<FilaTarjeta[]>(`/nomina/clases/${gradoId}/tarjetas`)
    return data
  },

  async consultarTarjeta(gradoId: string, uid: string): Promise<ConsultaTarjeta> {
    const { data } = await http.post<ConsultaTarjeta>(`/nomina/clases/${gradoId}/tarjetas/consulta`, { uid })
    return data
  },

  async cobrarConTarjeta(
    gradoId: string,
    datos: { uid: string; pin: string; items: { productoId: string; cantidad: number }[] },
  ): Promise<ResultadoCobroTarjeta> {
    const { data } = await http.post<ResultadoCobroTarjeta>(`/nomina/clases/${gradoId}/cobro-tarjeta`, datos)
    return data
  },

  async registrarTarjeta(alumnoId: string, uid: string, pin: string): Promise<void> {
    await http.put(`/nomina/alumnos/${alumnoId}/tarjeta`, { uid, pin })
  },

  async bloquearTarjeta(alumnoId: string, bloquear: boolean): Promise<void> {
    if (bloquear) await http.post(`/nomina/alumnos/${alumnoId}/tarjeta/bloqueo`)
    else await http.delete(`/nomina/alumnos/${alumnoId}/tarjeta/bloqueo`)
  },

  async quitarTarjeta(alumnoId: string): Promise<void> {
    await http.delete(`/nomina/alumnos/${alumnoId}/tarjeta`)
  },

  async marcarEntrega(compraId: string, entregada: boolean): Promise<void> {
    if (entregada) await http.post(`/nomina/compras/${compraId}/entrega`)
    else await http.delete(`/nomina/compras/${compraId}/entrega`)
  },
}
