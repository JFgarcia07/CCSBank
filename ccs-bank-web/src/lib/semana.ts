/** "2026-11-16" → "16 nov" (sin usar la zona horaria del navegador). */
export function semanaCorta(semana: string): string {
  const [a, m, d] = semana.split('-').map(Number)
  return new Date(Date.UTC(a!, m! - 1, d!)).toLocaleDateString('es-GT', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

/** Suma o resta semanas a un lunes (AAAA-MM-DD). */
export function moverSemana(semana: string, semanas: number): string {
  const [a, m, d] = semana.split('-').map(Number)
  const f = new Date(Date.UTC(a!, m! - 1, d! + semanas * 7))
  return f.toISOString().slice(0, 10)
}
