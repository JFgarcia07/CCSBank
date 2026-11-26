import { reportesService } from '@/services/reportes.service'

/**
 * Abre el PDF de un reporte en otra pestaña con una URL firmada de corta duración.
 * La pestaña se abre antes de pedir la URL para que el navegador no la bloquee.
 */
export async function abrirReporte(id: string): Promise<void> {
  const ventana = window.open('about:blank', '_blank')
  try {
    const url = await reportesService.urlDelArchivo(id)
    if (ventana) ventana.location.href = url
    else window.location.href = url
  } catch (e) {
    ventana?.close()
    throw e
  }
}
