// Guarda el token de sesión. localStorage puede fallar (modo privado, datos bloqueados),
// así que cada acceso va protegido y la app funciona aunque no se pueda persistir.
const CLAVE = 'ccs-bank-token'

export function leerToken(): string | null {
  try {
    return localStorage.getItem(CLAVE)
  } catch {
    return null
  }
}

export function guardarToken(token: string): void {
  try {
    localStorage.setItem(CLAVE, token)
  } catch {
    /* sin persistencia: la sesión durará hasta recargar */
  }
}

export function borrarToken(): void {
  try {
    localStorage.removeItem(CLAVE)
  } catch {
    /* nada que borrar */
  }
}
