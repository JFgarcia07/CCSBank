/** Lectura de tarjetas NFC con Web NFC (solo Chrome en Android y con HTTPS; en localhost también funciona). */

interface LectorNfc {
  scan(opciones?: { signal?: AbortSignal }): Promise<void>
  onreading: ((e: { serialNumber?: string }) => void) | null
  onreadingerror: (() => void) | null
}

declare global {
  interface Window {
    NDEFReader?: new () => LectorNfc
  }
}

export const nfcDisponible = () => typeof window !== 'undefined' && 'NDEFReader' in window

/** Mismo formato que en el servidor: sin espacios ni dos puntos, en mayúsculas. */
export const normalizarUid = (uid: string) => uid.replace(/[\s:]/g, '').toUpperCase()

/**
 * Espera UNA tarjeta y devuelve su UID. Cancelable con `senal`.
 * Lanza un Error con mensaje en español si no se puede leer.
 */
export async function leerUid(senal?: AbortSignal): Promise<string> {
  if (!window.NDEFReader) {
    throw new Error('Este navegador no puede leer tarjetas NFC. Usa Chrome en un teléfono Android.')
  }
  const lector = new window.NDEFReader()
  try {
    await lector.scan({ signal: senal })
  } catch (e) {
    if (senal?.aborted) throw new Error('Lectura cancelada.')
    const nombre = (e as { name?: string }).name
    if (nombre === 'NotAllowedError') throw new Error('Permiso de NFC denegado. Actívalo en el navegador.')
    throw new Error('No se pudo activar el NFC. Revisa que esté encendido en el teléfono.')
  }
  return new Promise<string>((resolver, rechazar) => {
    senal?.addEventListener('abort', () => rechazar(new Error('Lectura cancelada.')), { once: true })
    lector.onreadingerror = () => rechazar(new Error('No se pudo leer la tarjeta. Inténtalo de nuevo.'))
    lector.onreading = (e) => {
      if (e.serialNumber) resolver(normalizarUid(e.serialNumber))
      else rechazar(new Error('La tarjeta no entregó su identificador.'))
    }
  })
}
