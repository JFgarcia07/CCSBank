export interface ItemNav {
  id: string
  etiqueta: string
  /** Trazo SVG (24x24) del icono. */
  icono: string
  /** Nombre de la ruta. Sin ruta = pantalla aún no construida. */
  ruta?: string
}

const ICONOS = {
  inicio: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V11z',
  cuenta: 'M3 7a2 2 0 0 1 2-2h14v4M3 7v10a2 2 0 0 0 2 2h16V9H5a2 2 0 0 1-2-2zM16 14h2',
  estado: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  trabajo:
    'M4 8h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM9 8V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3',
  tienda: 'M6 2L3 6v14a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
  perfil: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  grado:
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  clases: 'M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z',
  nomina: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  cuentas:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6',
} as const

export const DESCRIPCIONES: Record<string, string> = {
  cuenta: 'Consulta tu saldo y cobra tus pagos pendientes.',
  estado: 'Revisa el historial de tus transacciones.',
  trabajo: 'Tu historial de trabajos y el reporte semanal en PDF.',
  tienda: 'Canjea premios al final de la unidad.',
  perfil: 'Cambia tu nombre, tu foto y tu CV.',
  dashboard: 'Resumen de las cuentas de los estudiantes.',
  grado: 'Balance de bonus y fines, trabajos y sus responsabilidades.',
  clases: 'Crea las clases y asigna a los docentes.',
  cuentas: 'Crea las cuentas de docentes y alumnos.',
  nomina: 'Revisa reportes, paga salarios y gestiona la tienda.',
}

const INICIO: ItemNav = { id: 'inicio', etiqueta: 'Inicio', icono: ICONOS.inicio, ruta: 'inicio' }

const ALUMNO: ItemNav[] = [
  INICIO,
  { id: 'cuenta', etiqueta: 'Cuenta', icono: ICONOS.cuenta, ruta: 'cuenta' },
  { id: 'estado', etiqueta: 'Estado de cuenta', icono: ICONOS.estado, ruta: 'estado-de-cuenta' },
  { id: 'trabajo', etiqueta: 'Trabajo', icono: ICONOS.trabajo, ruta: 'trabajo' },
  { id: 'tienda', etiqueta: 'Tienda', icono: ICONOS.tienda, ruta: 'tienda' },
  { id: 'perfil', etiqueta: 'Perfil', icono: ICONOS.perfil, ruta: 'perfil' },
]

const STAFF: ItemNav[] = [
  INICIO,
  { id: 'dashboard', etiqueta: 'Dashboard', icono: ICONOS.dashboard },
  { id: 'grado', etiqueta: 'Grado', icono: ICONOS.grado, ruta: 'grado' },
  { id: 'nomina', etiqueta: 'Nómina', icono: ICONOS.nomina, ruta: 'nomina' },
  { id: 'perfil', etiqueta: 'Perfil', icono: ICONOS.perfil, ruta: 'perfil' },
]

const ADMIN: ItemNav[] = [
  ...STAFF.slice(0, 3),
  { id: 'clases', etiqueta: 'Clases', icono: ICONOS.clases, ruta: 'clases' },
  { id: 'cuentas', etiqueta: 'Cuentas', icono: ICONOS.cuentas, ruta: 'cuentas' },
  ...STAFF.slice(3),
]

export function itemsNavegacion(esStaff: boolean, esAdmin = false): ItemNav[] {
  if (esAdmin) return ADMIN
  return esStaff ? STAFF : ALUMNO
}
