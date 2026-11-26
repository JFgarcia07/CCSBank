import { http } from '@/lib/http'
import type { Perfil } from '@/types/perfil'

function conArchivo(ruta: string, archivo: File): Promise<Perfil> {
  const form = new FormData()
  form.append('archivo', archivo)
  return http.post<Perfil>(ruta, form, { timeout: 60000 }).then((r) => r.data)
}

export const perfilService = {
  async obtener(): Promise<Perfil> {
    const { data } = await http.get<Perfil>('/perfil')
    return data
  },

  async actualizar(datos: { nombre: string; apellidos: string }): Promise<Perfil> {
    const { data } = await http.patch<Perfil>('/perfil', datos)
    return data
  },

  subirFoto: (archivo: File) => conArchivo('/perfil/foto', archivo),

  async quitarFoto(): Promise<Perfil> {
    const { data } = await http.delete<Perfil>('/perfil/foto')
    return data
  },

  subirCv: (archivo: File) => conArchivo('/perfil/cv', archivo),

  async quitarCv(): Promise<Perfil> {
    const { data } = await http.delete<Perfil>('/perfil/cv')
    return data
  },

  async urlDelCv(): Promise<string> {
    const { data } = await http.get<{ url: string }>('/perfil/cv/url')
    return data.url
  },
}
