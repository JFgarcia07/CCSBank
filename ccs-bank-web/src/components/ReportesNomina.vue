<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Alerta from '@/components/Alerta.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { abrirReporte } from '@/lib/abrirReporte'
import { mensajeDeError } from '@/lib/errores'
import { moverSemana, semanaCorta } from '@/lib/semana'
import { reportesService } from '@/services/reportes.service'
import type { FilaReporte, ReportesSemana } from '@/types/reportes'

const props = defineProps<{ claseId: string }>()

const datos = ref<ReportesSemana | null>(null)
const semana = ref<string | undefined>(undefined) // undefined = la semana actual
const cargando = ref(true)
const errorCarga = ref('')
const aviso = ref('')
const errorAccion = ref('')
/** id del reporte que se está aprobando. */
const procesando = ref<string | null>(null)

const dinero = (v: string | number) =>
  `CCS$ ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

async function cargar() {
  const id = props.claseId
  const s = semana.value
  cargando.value = true
  errorCarga.value = ''
  try {
    const d = await reportesService.delaSemana(id, s)
    if (id === props.claseId && s === semana.value) datos.value = d
  } catch (e) {
    errorCarga.value = mensajeDeError(e, 'No se pudieron cargar los reportes.')
  } finally {
    cargando.value = false
  }
}

/** Recarga sin el texto de "Cargando", para que la lista no parpadee tras una acción. */
async function refrescar() {
  datos.value = await reportesService.delaSemana(props.claseId, semana.value)
}

watch(
  () => props.claseId,
  () => {
    semana.value = undefined
    aviso.value = ''
    errorAccion.value = ''
    cargar()
  },
  { immediate: true },
)

const semanaMostrada = computed(() => datos.value?.semana ?? semana.value ?? '')
const esActual = computed(() => !!datos.value && datos.value.semana === datos.value.semanaActual)

function irSemana(delta: number) {
  if (!datos.value) return
  semana.value = moverSemana(datos.value.semana, delta)
  aviso.value = ''
  errorAccion.value = ''
  cargar()
}

const filas = computed(() => datos.value?.filas ?? [])
const aprobadosSinPagar = computed(() => filas.value.filter((f) => f.reporte?.estado === 'APROBADO' && !f.reporte.pagado))
const totalPorPagar = computed(() => aprobadosSinPagar.value.reduce((s, f) => s + Number(f.salario), 0))
const enRevision = computed(() => filas.value.filter((f) => f.reporte?.estado === 'PENDIENTE').length)
const sinEntregar = computed(() => filas.value.filter((f) => !f.reporte).length)

function etiquetaEstado(f: FilaReporte) {
  const r = f.reporte
  if (!r) return { texto: 'Sin entregar', clase: 'est-nada' }
  if (r.estado === 'PENDIENTE') return { texto: 'Por revisar', clase: 'est-pendiente' }
  if (r.estado === 'RECHAZADO') return { texto: 'Rechazado', clase: 'est-rechazado' }
  return r.pagado ? { texto: 'Aprobado · pagado', clase: 'est-aprobado' } : { texto: 'Aprobado · por pagar', clase: 'est-aprobado' }
}

async function ver(id: string) {
  errorAccion.value = ''
  try {
    await abrirReporte(id)
  } catch (e) {
    errorAccion.value = mensajeDeError(e, 'No se pudo abrir el reporte.')
  }
}

async function aprobar(f: FilaReporte) {
  if (!f.reporte) return
  procesando.value = f.reporte.id
  aviso.value = ''
  errorAccion.value = ''
  try {
    await reportesService.revisar(f.reporte.id, 'APROBADO')
    aviso.value = `Reporte de ${f.nombre} aprobado.`
    await refrescar()
  } catch (e) {
    errorAccion.value = mensajeDeError(e)
  } finally {
    procesando.value = null
  }
}

// ───── Rechazar (pide el motivo) ─────
const rechazarAbierto = ref(false)
const porRechazar = ref<FilaReporte | null>(null)
const comentario = ref('')
const errorComentario = ref('')
const rechazando = ref(false)

function pedirRechazo(f: FilaReporte) {
  porRechazar.value = f
  comentario.value = ''
  errorComentario.value = ''
  rechazarAbierto.value = true
}

async function rechazar() {
  const f = porRechazar.value
  if (!f?.reporte) return
  if (!comentario.value.trim()) {
    errorComentario.value = 'Explica qué debe corregir el alumno.'
    return
  }
  rechazando.value = true
  errorComentario.value = ''
  try {
    await reportesService.revisar(f.reporte.id, 'RECHAZADO', comentario.value.trim())
    aviso.value = `Reporte de ${f.nombre} rechazado. Podrá corregirlo y subirlo otra vez.`
    rechazarAbierto.value = false
    await refrescar()
  } catch (e) {
    errorComentario.value = mensajeDeError(e)
  } finally {
    rechazando.value = false
  }
}

// ───── Pagar salarios ─────
const pagarAbierto = ref(false)
const pagando = ref(false)
const errorPago = ref('')

const lineasPago = computed(() => {
  const n = aprobadosSinPagar.value.length
  return [
    `Se pagará el salario de ${n} ${n === 1 ? 'alumno' : 'alumnos'} de la semana del ${semanaCorta(semanaMostrada.value)}. Total: ${dinero(totalPorPagar.value)}.`,
    'El dinero no se suma de inmediato: queda pendiente y cada alumno lo cobra desde su cuenta.',
    'No se puede volver a pagar la misma semana a quien ya cobró su salario.',
  ]
})

async function pagar() {
  pagando.value = true
  errorPago.value = ''
  try {
    const r = await reportesService.pagarSalarios(props.claseId, semanaMostrada.value)
    aviso.value = `Listo: salarios enviados a ${r.pagados} ${r.pagados === 1 ? 'alumno' : 'alumnos'} (${dinero(r.total)}). Quedaron pendientes de cobro.`
    pagarAbierto.value = false
    await refrescar()
  } catch (e) {
    errorPago.value = mensajeDeError(e)
  } finally {
    pagando.value = false
  }
}
</script>

<template>
  <section class="panel" aria-labelledby="rep-titulo">
    <div class="panel-cab">
      <h2 id="rep-titulo" class="panel-titulo">Reportes y salarios</h2>
      <div class="semanas" role="group" aria-label="Semana">
        <button type="button" class="btn secundario chico" :disabled="cargando" @click="irSemana(-1)">
          ← Anterior
        </button>
        <span class="semana-actual">
          Semana del {{ semanaCorta(semanaMostrada) }}<template v-if="esActual"> (actual)</template>
        </span>
        <button type="button" class="btn secundario chico" :disabled="cargando || esActual" @click="irSemana(1)">
          Siguiente →
        </button>
      </div>
    </div>

    <Alerta v-if="aviso" tipo="ok">{{ aviso }}</Alerta>
    <Alerta v-if="errorAccion" tipo="error">{{ errorAccion }}</Alerta>

    <p v-if="cargando && !datos" class="estado" role="status">Cargando reportes…</p>

    <div v-else-if="errorCarga" class="estado error" role="alert">
      <p>{{ errorCarga }}</p>
      <button type="button" class="btn secundario" @click="cargar">Reintentar</button>
    </div>

    <template v-else-if="datos">
      <div v-if="!filas.length" class="estado">
        <p><strong>Nadie tiene trabajo asignado en esta clase.</strong></p>
        <p>Asigna los trabajos desde Grado para que los alumnos puedan entregar su reporte.</p>
      </div>

      <template v-else>
        <p class="resumen">
          <span><strong>{{ enRevision }}</strong> por revisar</span>
          <span><strong>{{ aprobadosSinPagar.length }}</strong> por pagar</span>
          <span><strong>{{ sinEntregar }}</strong> sin entregar</span>
        </p>

        <ul class="filas" :aria-busy="cargando">
          <li v-for="f in filas" :key="f.alumnoId" class="fila">
            <div class="fila-info">
              <strong>{{ f.apellidos }}, {{ f.nombre }}</strong>
              <small>{{ f.trabajo }} · {{ dinero(f.salario) }}</small>
              <small v-if="f.reporte?.estado === 'RECHAZADO' && f.reporte.comentario" class="motivo">
                Rechazado: «{{ f.reporte.comentario }}»
              </small>
            </div>
            <div class="fila-der">
              <span class="chip" :class="etiquetaEstado(f).clase">{{ etiquetaEstado(f).texto }}</span>
              <template v-if="f.reporte">
                <button type="button" class="btn secundario chico" @click="ver(f.reporte.id)">
                  Ver PDF<span class="solo-lector"> de {{ f.nombre }}</span>
                </button>
                <template v-if="!f.reporte.pagado && f.reporte.estado !== 'APROBADO'">
                  <button
                    type="button"
                    class="btn primario chico"
                    :disabled="procesando === f.reporte.id"
                    @click="aprobar(f)"
                  >
                    Aprobar<span class="solo-lector"> a {{ f.nombre }}</span>
                  </button>
                </template>
                <button
                  v-if="!f.reporte.pagado && f.reporte.estado !== 'RECHAZADO'"
                  type="button"
                  class="btn peligro chico"
                  @click="pedirRechazo(f)"
                >
                  Rechazar<span class="solo-lector"> a {{ f.nombre }}</span>
                </button>
              </template>
            </div>
          </li>
        </ul>

        <div class="pago">
          <p class="nota">
            <template v-if="aprobadosSinPagar.length">
              Hay {{ dinero(totalPorPagar) }} por pagar en {{ aprobadosSinPagar.length }}
              {{ aprobadosSinPagar.length === 1 ? 'reporte aprobado' : 'reportes aprobados' }}.
            </template>
            <template v-else>Aprueba reportes para poder pagar los salarios de esta semana.</template>
          </p>
          <button
            type="button"
            class="btn primario"
            :disabled="!aprobadosSinPagar.length"
            @click="((errorPago = ''), (pagarAbierto = true))"
          >
            Pagar salarios aprobados
          </button>
        </div>
      </template>
    </template>

    <ConfirmDialog
      v-model="pagarAbierto"
      tono="aviso"
      titulo="¿Pagar los salarios de esta semana?"
      boton="Sí, pagar salarios"
      cancelar="No, volver"
      :lineas="lineasPago"
      :ejecutando="pagando"
      :error="errorPago"
      @confirmar="pagar"
    />

    <ConfirmDialog
      v-model="rechazarAbierto"
      tono="peligro"
      titulo="¿Rechazar este reporte?"
      boton="Sí, rechazar"
      cancelar="No, volver"
      :lineas="[
        `Se rechazará el reporte de ${porRechazar?.nombre ?? ''} ${porRechazar?.apellidos ?? ''}.`,
        'El alumno verá tu comentario y podrá corregirlo y subirlo otra vez. Mientras tanto no se le paga el salario de la semana.',
      ]"
      :ejecutando="rechazando"
      :error="errorComentario"
      @confirmar="rechazar"
    >
      <div class="campo">
        <label for="comentario" class="etiqueta">¿Qué debe corregir?</label>
        <textarea
          id="comentario"
          v-model="comentario"
          class="entrada area"
          maxlength="500"
          rows="3"
          placeholder="Ej. Faltan las evidencias."
        />
      </div>
    </ConfirmDialog>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: #fff;
  border: 1px solid var(--color-borde);
  border-radius: var(--radio-md);
  box-shadow: var(--sombra-sm);
}

.panel-cab {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-titulo {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: 1.1rem;
  color: var(--color-azul-2);
}

.semanas {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.semana-actual {
  font-weight: 600;
}

.resumen {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  margin: 0;
  padding: 10px 12px;
  font-size: 0.92rem;
  background: var(--color-fondo);
  border-radius: var(--radio-sm);
}

.filas {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.fila {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
}

.fila + .fila {
  border-top: 1px solid var(--color-borde);
}

.fila-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.fila-info small {
  color: var(--color-texto-suave);
}

.fila-info .motivo {
  color: var(--peligro-texto);
}

.fila-der {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.chip.est-nada {
  color: var(--color-texto-suave);
  background: var(--color-fondo);
}

.chip.est-pendiente {
  color: var(--aviso-texto);
  background: var(--aviso-fondo);
}

.chip.est-aprobado {
  color: var(--ok-texto);
  background: var(--ok-fondo);
}

.chip.est-rechazado {
  color: var(--peligro-texto);
  background: var(--peligro-fondo);
}

.pago {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 4px;
}

.nota {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-texto-suave);
}

@media (max-width: 700px) {
  .fila {
    flex-direction: column;
    align-items: stretch;
  }

  .fila-der {
    justify-content: flex-start;
  }
}
</style>
