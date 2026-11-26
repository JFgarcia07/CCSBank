import axios from 'axios'

/** Mensaje legible (en español) a partir de un error de la API. */
export function mensajeDeError(e: unknown, porDefecto = 'Ocurrió un error. Inténtalo de nuevo.'): string {
  if (axios.isAxiosError(e)) {
    if (!e.response) return 'No se pudo conectar con el servidor.'
    const msg = e.response.data?.message
    if (Array.isArray(msg)) return msg.join(' ')
    if (typeof msg === 'string') return msg
  }
  return porDefecto
}
