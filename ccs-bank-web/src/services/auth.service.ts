import { http } from '@/lib/http'
import type { RespuestaLogin, Usuario } from '@/types/auth'

export const authService = {
  async login(usuario: string, password: string): Promise<RespuestaLogin> {
    const { data } = await http.post<RespuestaLogin>('/auth/login', { usuario, password })
    return data
  },

  async perfil(): Promise<Usuario> {
    const { data } = await http.get<Usuario>('/auth/me')
    return data
  },
}
