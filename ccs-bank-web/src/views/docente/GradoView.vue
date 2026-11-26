<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Alerta from '@/components/Alerta.vue'
import AvatarAlumno from '@/components/AvatarAlumno.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import TrabajoFormDialog from '@/components/TrabajoFormDialog.vue'
import TransaccionesDialog from '@/components/TransaccionesDialog.vue'
import { mensajeDeError } from '@/lib/errores'
import { aulaService } from '@/services/aula.service'
import type { ClaseAula, DatosTrabajo, ResumenAula, TrabajoAula } from '@/types/aula'

const clases = ref<ClaseAula[]>([])
const claseId = ref('')
const resumen = ref<ResumenAula | null>(null)
const trabajos = ref<TrabajoAula[]>([])
const pestana = ref<'alumnos' | 'trabajos'>('alumnos')
const transAbierto = ref(false)
const alumnoTrans = ref<{ id: string; nombre: string } | null>(null)

function verTransacciones(a: { id: string; nombre: string; apellidos: string }) {
  alumnoTrans.value = { id: a.id, nombre: `${a.nombre} ${a.apellidos}` }
  transAbierto.value = true
}

const cargandoClases = ref(true)
const cargando = ref(false)
const errorCarga = ref('')
const aviso = ref('')
const errorAviso = ref('')

const dinero = (v: string | number) =>
  `CCS$ ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const alumnosActivos = computed(() => (resumen.value?.alumnos ?? []).filter((a) => a.activo))
const asignadosAhora = computed(() => trabajos.value.filter((t) => t.asignado).length)

/** Celda de CSV: se entrecomilla si hace falta y se evita que Excel lo trate como fórmula. */
function celdaCsv(v: string): string {
  const t = /^[=+\-@]/.test(v) ? `'${v}` : v
  return /[",;\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

/** Balance por alumno: nombre, total de bonus (cobrados y por cobrar) y total de fines. Sin salarios. */
function descargarBalance() {
  const alumnos = resumen.value?.alumnos ?? []
  const filas = [
    ['Nombre', 'Total de bonus', 'Total de fines'],
    ...alumnos.map((a) => [
      `${a.nombre} ${a.apellidos}`,
      (Number(a.bonus) + Number(a.bonusPorCobrar)).toFixed(2),
      Number(a.fines).toFixed(2),
    ]),
  ]
  // El BOM hace que Excel lea bien las tildes.
  const csv = '\uFEFF' + filas.map((f) => f.map(celdaCsv).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const clase = clases.value.find((c) => c.id === claseId.value)?.nombre ?? 'clase'
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `balance-${clase.replace(/[^\w-]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`
  enlace.click()
  URL.revokeObjectURL(url)
}

async function cargarClases() {
  cargandoClases.value = true
  errorCarga.value = ''
  try {
    clases.value = await aulaService.clases()
    const primera = clases.value[0]
    if (primera) {
      claseId.value = primera.id
      await cargarClase()
    }
  } catch (e) {
    errorCarga.value = mensajeDeError(e, 'No se pudieron cargar tus clases.')
  } finally {
    cargandoClases.value = false
  }
}

/** Una sola petición trae el resumen y los trabajos. */
async function recargarAula() {
  const id = claseId.value
  const d = await aulaService.detalle(id)
  if (id !== claseId.value) return // se cambió de clase mientras cargaba
  resumen.value = { totales: d.totales, alumnos: d.alumnos }
  trabajos.value = d.trabajos
}

async function cargarClase() {
  if (!claseId.value) return
  cargando.value = true
  errorCarga.value = ''
  aviso.value = ''
  errorAviso.value = ''
  try {
    await recargarAula()
  } catch (e) {
    errorCarga.value = mensajeDeError(e, 'No se pudo cargar la clase.')
  } finally {
    cargando.value = false
  }
}

onMounted(cargarClases)

// ───── Crear / editar trabajo ─────
const formAbierto = ref(false)
const edicion = ref<TrabajoAula | null>(null)
const guardando = ref(false)
const errorForm = ref('')

function nuevoTrabajo() {
  edicion.value = null
  errorForm.value = ''
  formAbierto.value = true
}

function editarTrabajo(t: TrabajoAula) {
  edicion.value = t
  errorForm.value = ''
  formAbierto.value = true
}

const porNombre = (a: TrabajoAula, b: TrabajoAula) => a.nombre.localeCompare(b.nombre, 'es')

async function guardarTrabajo(datos: DatosTrabajo) {
  guardando.value = true
  errorForm.value = ''
  try {
    const actual = edicion.value
    if (actual) {
      const t = await aulaService.actualizarTrabajo(actual.id, datos)
      trabajos.value = trabajos.value.map((x) => (x.id === t.id ? t : x)).sort(porNombre)
      aviso.value = `Trabajo "${t.nombre}" actualizado.`
      // Si se desactivó, el alumno queda libre: refresca la tabla de alumnos.
      if (datos.activo === false) await recargarAula()
    } else {
      const t = await aulaService.crearTrabajo(claseId.value, datos)
      trabajos.value = [...trabajos.value, t].sort(porNombre)
      aviso.value = `Trabajo "${t.nombre}" creado.`
    }
    errorAviso.value = ''
    formAbierto.value = false
  } catch (e) {
    errorForm.value = mensajeDeError(e)
  } finally {
    guardando.value = false
  }
}

// ───── Asignar (siempre explica qué va a pasar antes de quitar a alguien) ─────
const asignando = ref<string | null>(null)
/** Se incrementa para volver a dibujar los selectores cuando se cancela un cambio. */
const version = ref(0)

interface Confirmacion {
  titulo: string
  lineas: string[]
  boton: string
  cancelar: string
  ejecutar: () => Promise<void>
}
const confirmacion = ref<Confirmacion | null>(null)
const confirmAbierto = ref(false)
const ejecutando = ref(false)

const nombreCompleto = (n: string, a: string) => `${n} ${a}`

function pedirConfirmacion(c: Confirmacion) {
  confirmacion.value = c
  confirmAbierto.value = true
}

async function aceptarConfirmacion() {
  const c = confirmacion.value
  if (!c) return
  ejecutando.value = true
  try {
    await c.ejecutar()
  } finally {
    ejecutando.value = false
    confirmAbierto.value = false
  }
}

async function ejecutarAsignacion(t: TrabajoAula, alumnoId: string | null) {
  asignando.value = t.id
  errorAviso.value = ''
  aviso.value = ''
  try {
    await aulaService.asignar(t.id, alumnoId)
    // Un alumno solo tiene un trabajo: se recarga todo para reflejar el movimiento.
    await recargarAula()
    aviso.value = alumnoId ? `Listo: "${t.nombre}" fue asignado.` : `Listo: "${t.nombre}" quedó libre.`
  } catch (e) {
    errorAviso.value = mensajeDeError(e)
  } finally {
    asignando.value = null
    version.value++
  }
}

function asignar(t: TrabajoAula, alumnoId: string) {
  const actual = t.asignado

  if (!alumnoId) {
    if (!actual) return
    pedirConfirmacion({
      titulo: '¿Quitar al alumno de este trabajo?',
      lineas: [
        `${nombreCompleto(actual.nombre, actual.apellidos)} dejará de tener el trabajo "${t.nombre}" y se quedará sin trabajo.`,
        'El trabajo quedará libre para asignarlo a otro alumno. No se borra nada y el historial se conserva.',
      ],
      boton: 'Sí, quitar del trabajo',
      cancelar: 'No, dejar como está',
      ejecutar: () => ejecutarAsignacion(t, null),
    })
    return
  }

  const alumno = resumen.value?.alumnos.find((a) => a.id === alumnoId)
  const lineas: string[] = []
  if (alumno?.trabajo && alumno.trabajo.id !== t.id) {
    lineas.push(
      `${nombreCompleto(alumno.nombre, alumno.apellidos)} ya tiene el trabajo "${alumno.trabajo.nombre}". Al darle "${t.nombre}" dejará el anterior, que quedará libre.`,
    )
  }
  if (actual && actual.alumnoId !== alumnoId) {
    lineas.push(
      `${nombreCompleto(actual.nombre, actual.apellidos)} tiene ahora "${t.nombre}". Al cambiarlo dejará este trabajo y se quedará sin trabajo.`,
    )
  }
  if (!lineas.length) {
    void ejecutarAsignacion(t, alumnoId)
    return
  }
  pedirConfirmacion({
    titulo: '¿Cambiar la asignación?',
    lineas: [...lineas, 'No se borra nada y el historial se conserva.'],
    boton: 'Sí, cambiar',
    cancelar: 'No, dejar como está',
    ejecutar: () => ejecutarAsignacion(t, alumnoId),
  })
}

function pedirLiberarTodos() {
  const n = asignadosAhora.value
  pedirConfirmacion({
    titulo: '¿Quitar a todos de sus trabajos?',
    lineas: [
      `${n} ${n === 1 ? 'alumno se quedará' : 'alumnos se quedarán'} sin trabajo y ${n === 1 ? 'su trabajo quedará libre' : 'sus trabajos quedarán libres'}.`,
      'Los trabajos no se borran: después podrás asignarlos otra vez a los alumnos que quieras.',
      'No cambia el dinero de nadie y el historial se conserva.',
    ],
    boton: 'Sí, quitar a todos',
    cancelar: 'No, dejar como está',
    ejecutar: async () => {
      errorAviso.value = ''
      aviso.value = ''
      try {
        const liberados = await aulaService.liberarTodos(claseId.value)
        await recargarAula()
        aviso.value = `Listo: ${liberados} ${liberados === 1 ? 'alumno quedó' : 'alumnos quedaron'} sin trabajo.`
      } catch (e) {
        errorAviso.value = mensajeDeError(e)
      }
    },
  })
}

// ───── Eliminar trabajo ─────
const aEliminar = ref<TrabajoAula | null>(null)
const eliminando = ref(false)
const errorEliminar = ref('')

function pedirEliminar(t: TrabajoAula) {
  aEliminar.value = t
  errorEliminar.value = ''
}

async function confirmarEliminar() {
  const t = aEliminar.value
  if (!t) return
  eliminando.value = true
  errorEliminar.value = ''
  try {
    await aulaService.eliminarTrabajo(t.id)
    trabajos.value = trabajos.value.filter((x) => x.id !== t.id)
    aviso.value = `Trabajo "${t.nombre}" eliminado.`
    aEliminar.value = null
  } catch (e) {
    errorEliminar.value = mensajeDeError(e)
  } finally {
    eliminando.value = false
  }
}
</script>

<template>
  <div class="pagina">
    <header class="cabecera">
      <div>
        <h1 class="titulo">Grado</h1>
        <p class="sub">Balance de tus alumnos y los trabajos de la clase. Los bonus y fines se emiten en Nómina.</p>
      </div>
      <div class="cab-derecha">
        <div v-if="clases.length > 1" class="selector campo">
          <label for="clase" class="etiqueta">Clase</label>
          <select id="clase" v-model="claseId" class="entrada" @change="cargarClase">
            <option v-for="c in clases" :key="c.id" :value="c.id">{{ c.nombre }} ({{ c.totalAlumnos }})</option>
          </select>
        </div>
        <p v-else-if="clases[0]" class="clase-unica">{{ clases[0].nombre }}</p>
      </div>
    </header>

    <p v-if="cargandoClases" class="estado" role="status">Cargando…</p>

    <div v-else-if="errorCarga && !resumen" class="estado error" role="alert">
      <p>{{ errorCarga }}</p>
      <button type="button" class="btn secundario" @click="clases.length ? cargarClase() : cargarClases()">
        Reintentar
      </button>
    </div>

    <div v-else-if="!clases.length" class="estado">
      <p><strong>Aún no tienes clases asignadas.</strong></p>
      <p>El administrador debe asignarte una clase para que puedas verla aquí.</p>
    </div>

    <template v-else>
      <Alerta v-if="aviso" tipo="ok">{{ aviso }}</Alerta>
      <Alerta v-if="errorAviso" tipo="error">{{ errorAviso }}</Alerta>
      <Alerta v-if="errorCarga" tipo="error">{{ errorCarga }}</Alerta>

      <section class="resumen" aria-label="Balance de la clase">
        <div class="stat">
          <span class="stat-etiqueta">Total en cuentas</span>
          <strong class="stat-valor">{{ dinero(resumen?.totales.saldo ?? 0) }}</strong>
        </div>
        <div class="stat">
          <span class="stat-etiqueta">Bonus</span>
          <strong class="stat-valor positivo">{{ dinero(resumen?.totales.bonus ?? 0) }}</strong>
        </div>
        <div class="stat">
          <span class="stat-etiqueta">Bonus por cobrar</span>
          <strong class="stat-valor pendiente">{{ dinero(resumen?.totales.bonusPorCobrar ?? 0) }}</strong>
        </div>
        <div class="stat">
          <span class="stat-etiqueta">Fines</span>
          <strong class="stat-valor negativo">{{ dinero(resumen?.totales.fines ?? 0) }}</strong>
        </div>
      </section>

      <div class="pestanas" role="tablist" aria-label="Secciones del grado">
        <button
          type="button"
          role="tab"
          class="pestana"
          :aria-selected="pestana === 'alumnos'"
          :class="{ activa: pestana === 'alumnos' }"
          @click="pestana = 'alumnos'"
        >
          Alumnos <span class="cuenta">{{ resumen?.alumnos.length ?? 0 }}</span>
        </button>
        <button
          type="button"
          role="tab"
          class="pestana"
          :aria-selected="pestana === 'trabajos'"
          :class="{ activa: pestana === 'trabajos' }"
          @click="pestana = 'trabajos'"
        >
          Trabajos <span class="cuenta">{{ trabajos.length }}</span>
        </button>
        <button
          v-if="resumen?.alumnos.length"
          type="button"
          class="btn exito chico descargar"
          title="Descarga un .csv con el total de bonus y de fines de cada alumno (sin salarios)"
          @click="descargarBalance"
        >
          <svg viewBox="0 0 24 24" class="icono" aria-hidden="true"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" /></svg>
          Descargar balance (.csv)
        </button>
      </div>

      <p v-if="cargando" class="estado" role="status">Cargando clase…</p>

      <!-- Alumnos -->
      <template v-else-if="pestana === 'alumnos'">
        <div v-if="!resumen?.alumnos.length" class="estado">
          <p><strong>Esta clase aún no tiene alumnos.</strong></p>
          <p>El administrador los agrega desde Cuentas, eligiendo esta clase.</p>
        </div>
        <div v-else class="tabla-caja">
          <table class="tabla">
            <thead>
              <tr>
                <th scope="col">Alumno</th>
                <th scope="col">Trabajo</th>
                <th scope="col" class="num">Bonus</th>
                <th scope="col" class="num">Por cobrar</th>
                <th scope="col" class="num">Fines</th>
                <th scope="col" class="num">Total</th>
                <th scope="col"><span class="solo-lector">Transacciones</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in resumen.alumnos" :key="a.id" :class="{ apagado: !a.activo }">
                <td>
                  <div class="alumno">
                    <AvatarAlumno :nombre="a.nombre" :apellidos="a.apellidos" :foto="a.fotoUrl" :tamano="36" />
                    <span class="alumno-datos">
                      {{ a.apellidos }}, {{ a.nombre }}
                      <small class="carne">{{ a.carne }}<template v-if="!a.activo"> · inactivo</template></small>
                    </span>
                  </div>
                </td>
                <td>{{ a.trabajo?.nombre ?? '—' }}</td>
                <td class="num positivo">{{ dinero(a.bonus) }}</td>
                <td class="num pendiente">{{ dinero(a.bonusPorCobrar) }}</td>
                <td class="num negativo">{{ dinero(a.fines) }}</td>
                <td class="num fuerte" :class="{ negativo: Number(a.saldo) < 0 }">{{ dinero(a.saldo) }}</td>
                <td class="num">
                  <button type="button" class="btn info chico" @click="verTransacciones(a)">
                    Ver transacciones<span class="solo-lector"> de {{ a.nombre }} {{ a.apellidos }}</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- Trabajos -->
      <template v-else>
        <div class="barra">
          <p class="nota">Cada trabajo lo ocupa un alumno y cada alumno tiene un solo trabajo.</p>
          <div class="barra-botones">
            <button
              type="button"
              class="btn peligro"
              :disabled="!asignadosAhora"
              :title="asignadosAhora ? '' : 'Nadie tiene un trabajo asignado por ahora'"
              @click="pedirLiberarTodos"
            >
              Quitar a todos de sus trabajos
            </button>
            <button type="button" class="btn primario" @click="nuevoTrabajo">
              <svg viewBox="0 0 24 24" class="icono" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              Nuevo trabajo
            </button>
          </div>
        </div>

        <div v-if="!trabajos.length" class="estado">
          <p><strong>Aún no hay trabajos en esta clase.</strong></p>
          <button type="button" class="btn primario" @click="nuevoTrabajo">Nuevo trabajo</button>
        </div>

        <ul v-else class="lista">
          <li v-for="t in trabajos" :key="`${t.id}-${version}`" class="tarjeta" :class="{ apagada: !t.activo }">
            <div class="tarjeta-cab">
              <h2 class="tarjeta-titulo">{{ t.nombre }}</h2>
              <span class="chip neutro">{{ dinero(t.salarioSemanal) }} / sem.</span>
            </div>

            <p v-if="t.descripcion" class="resp">{{ t.descripcion }}</p>
            <p v-else class="resp vacio">Sin responsabilidades escritas.</p>

            <div class="campo">
              <label :for="`as-${t.id}`" class="etiqueta">
                {{ t.activo ? 'Alumno asignado' : 'Trabajo inactivo' }}
              </label>
              <select
                :id="`as-${t.id}`"
                class="entrada"
                :disabled="!t.activo || asignando === t.id"
                :value="t.asignado?.alumnoId ?? ''"
                @change="asignar(t, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">Sin asignar</option>
                <option v-for="a in alumnosActivos" :key="a.id" :value="a.id">
                  {{ a.apellidos }}, {{ a.nombre }}<template v-if="a.trabajo && a.trabajo.id !== t.id"> (tiene "{{ a.trabajo.nombre }}")</template>
                </option>
              </select>
            </div>

            <div class="tarjeta-acciones">
              <button type="button" class="btn info chico" @click="editarTrabajo(t)">
                Editar<span class="solo-lector"> {{ t.nombre }}</span>
              </button>
              <button type="button" class="btn peligro chico" @click="pedirEliminar(t)">
                Eliminar<span class="solo-lector"> {{ t.nombre }}</span>
              </button>
            </div>
          </li>
        </ul>
      </template>
    </template>

    <TransaccionesDialog v-model="transAbierto" :grado-id="claseId" :alumno="alumnoTrans" @cambio="recargarAula" />

    <TrabajoFormDialog
      v-model="formAbierto"
      :trabajo="edicion"
      :cargando="guardando"
      :error="errorForm"
      @guardar="guardarTrabajo"
    />

    <!-- Confirmaciones de asignación: explican qué pasará antes de quitar a alguien -->
    <ConfirmDialog
      v-model="confirmAbierto"
      tono="aviso"
      :titulo="confirmacion?.titulo ?? ''"
      :boton="confirmacion?.boton ?? ''"
      :cancelar="confirmacion?.cancelar"
      :lineas="confirmacion?.lineas"
      :ejecutando="ejecutando"
      @confirmar="aceptarConfirmacion"
      @cerrado="version++"
    />

    <ConfirmDialog
      :model-value="!!aEliminar"
      titulo="¿Eliminar este trabajo?"
      boton="Sí, eliminar trabajo"
      cancelar="No, conservarlo"
      :ejecutando="eliminando"
      :error="errorEliminar"
      @update:model-value="(v) => !v && (aEliminar = null)"
      @confirmar="confirmarEliminar"
    >
      <p>
        Se eliminará el trabajo <strong>{{ aEliminar?.nombre }}</strong>. Esta acción no se puede deshacer.
      </p>
      <Alerta tipo="info">
        Si ya fue asignado a algún alumno, no se podrá eliminar. En ese caso usa Editar y desmarca "Trabajo
        activo": quedará libre y su historial se conserva.
      </Alerta>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.descargar {
  align-self: center;
  margin-left: auto;
}

.cab-derecha {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
}

.selector {
  min-width: 220px;
}

.clase-unica {
  margin: 0;
  padding: 6px 14px;
  font-weight: 600;
  color: var(--color-azul-2);
  background: #fff;
  border: 1px solid var(--color-borde);
  border-radius: 999px;
}

/* Balance */
.resumen {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px 20px;
  background: #fff;
  border: 1px solid var(--color-borde);
  border-radius: var(--radio-md);
  box-shadow: var(--sombra-sm);
}

.stat-etiqueta {
  font-size: 0.74rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-texto-suave);
}

.stat-valor {
  font-family: var(--fuente-titulo);
  font-size: clamp(1.2rem, 3vw, 1.7rem);
  color: var(--color-azul-2);
}

.positivo {
  color: var(--ok-texto);
}

.negativo {
  color: var(--peligro-texto);
}

.pendiente {
  color: var(--aviso-texto);
}

.fuerte {
  font-weight: 700;
}

.apagado {
  opacity: 0.6;
}

.alumno {
  display: flex;
  align-items: center;
  gap: 12px;
}

.alumno-datos {
  min-width: 0;
}

.carne {
  display: block;
  color: var(--color-texto-suave);
}

/* Trabajos */
.barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.barra-botones {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tarjeta.apagada {
  background: var(--color-fondo);
}

.resp {
  flex: 1;
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  white-space: pre-line;
  color: var(--color-texto-suave);
}

.resp.vacio {
  font-style: italic;
}

@media (max-width: 1000px) {
  .resumen {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 520px) {
  .resumen {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {

  .selector {
    width: 100%;
  }

  .barra-botones,
  .barra-botones .btn {
    width: 100%;
  }
}
</style>
