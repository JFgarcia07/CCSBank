import axios from 'axios'
import { leerToken } from './token'

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 15000,
})

// Adjunta el token a cada petición.
http.interceptors.request.use((config) => {
  const token = leerToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Si la sesión expira o el token deja de ser válido, el store avisa y cierra sesión.
// Se registra desde fuera (ver main.ts) para no crear una dependencia circular con Pinia.
type ManejadorSesionExpirada = () => void
let alExpirarSesion: ManejadorSesionExpirada | null = null

export function registrarSesionExpirada(fn: ManejadorSesionExpirada): void {
  alExpirarSesion = fn
}

http.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    const noEsLogin = !String(error.config?.url ?? '').includes('/auth/login')
    if (error.response?.status === 401 && noEsLogin) alExpirarSesion?.()
    return Promise.reject(error)
  },
)
