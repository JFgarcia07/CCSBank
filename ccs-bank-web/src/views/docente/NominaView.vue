<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Alerta from '@/components/Alerta.vue'
import ConceptoFormDialog from '@/components/ConceptoFormDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ReportesNomina from '@/components/ReportesNomina.vue'
import TarjetasNomina from '@/components/TarjetasNomina.vue'
import TiendaNomina from '@/components/TiendaNomina.vue'
import { mensajeDeError } from '@/lib/errores'
import { aulaService } from '@/services/aula.service'
import { nominaService } from '@/services/nomina.service'
import type { ClaseAula } from '@/types/aula'
import type { ConceptoNomina, DetalleNomina, MovimientoNomina, TipoMovimiento } from '@/types/nomina'

const clases = ref<ClaseAula[]>([])
const claseId = ref('')
const detalle = ref<DetalleNomina | null>(null)
const pestana = ref<'emitir' | 'reportes' | 'conceptos' | 'tienda' | 'tarjetas'>('emitir')

const cargandoClases = ref(true)
const cargando = ref(false)
const errorCarga = ref('')
const aviso = ref('')

const dinero = (v: string | number) => {
  const n = Number(v)
  return `${n < 0 ? '−' : ''}CCS$ ${Math.abs(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

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

async function recargar() {
  const id = claseId.value
  const d = await nominaService.detalle(id)
  if (id === claseId.value) detalle.value = d // ignora respuestas de una clase anterior
}

async function cargarClase() {
  if (!claseId.value) return
  cargando.value = true
  errorCarga.value = ''
  aviso.value = ''
  seleccion.value = []
  conceptoId.value = ''
  try {
    await recargar()
  } catch (e) {
    errorCarga.value = mensajeDeError(e, 'No se pudo cargar la clase.')
  } finally {
    cargando.value = false
  }
}

onMounted(cargarClases)

// ───── Emitir ─────
const tipo = ref<TipoMovimiento>('BONUS')
const conceptoId = ref('')
const seleccion = ref<string[]>([])
const errores = ref<{ alumnos?: string; concepto?: string; motivo?: string; monto?: string }>({})

/** Valor del selector para escribir el motivo y el monto a mano. */
const OTRO = '__otro'
const motivoManual = ref('')
const montoManual = ref('')
const esManual = computed(() => conceptoId.value === OTRO)

const alumnos = computed(() => detalle.value?.alumnos ?? [])
const conceptosDelTipo = computed(() => (detalle.value?.conceptos ?? []).filter((c) => c.tipo === tipo.value))
const guardado = computed(() => conceptosDelTipo.value.find((c) => c.id === conceptoId.value) ?? null)
const montoManualNum = computed(() => {
  const n = Number(montoManual.value.replace(',', '.'))
  return montoManual.value.trim() !== '' && Number.isFinite(n) ? n : NaN
})
const montoManualValido = computed(
  () => montoManualNum.value > 0 && Math.round(montoManualNum.value * 100) / 100 === montoManualNum.value,
)
/** Lo que se va a emitir: un concepto guardado o lo escrito a mano. */
const concepto = computed<{ nombre: string; monto: string } | null>(() => {
  if (esManual.value) {
    return montoManualValido.value && motivoManual.value.trim()
      ? { nombre: motivoManual.value.trim(), monto: String(montoManualNum.value) }
      : null
  }
  return guardado.value
})
const monto = computed(() => (concepto.value ? Number(concepto.value.monto) : 0))

const todosMarcados = computed(() => alumnos.value.length > 0 && seleccion.value.length === alumnos.value.length)
const seleccionados = computed(() => alumnos.value.filter((a) => seleccion.value.includes(a.id)))
const totalEmitido = computed(() => monto.value * seleccionados.value.length)

/** Un fine puede dejar saldo negativo: esos alumnos quedan con una deuda. */
const quedanEnDeuda = computed(() =>
  tipo.value === 'FINE' && concepto.value ? seleccionados.value.filter((a) => Number(a.saldo) - monto.value < 0) : [],
)

function alternarTodos() {
  seleccion.value = todosMarcados.value ? [] : alumnos.value.map((a) => a.id)
}

function cambiarTipo(t: TipoMovimiento) {
  tipo.value = t
  conceptoId.value = ''
  errores.value = {}
}

// ───── Confirmar y emitir ─────
const confirmAbierto = ref(false)
const emitiendo = ref(false)
const errorEmitir = ref('')

function revisar() {
  const e: typeof errores.value = {}
  if (!conceptoId.value) e.concepto = tipo.value === 'BONUS' ? 'Elige un bonus.' : 'Elige un fine.'
  if (esManual.value) {
    if (!motivoManual.value.trim()) e.motivo = 'Escribe el motivo.'
    if (!montoManualValido.value) e.monto = 'Ingresa un monto mayor que 0 (máximo 2 decimales).'
  }
  if (!seleccion.value.length) e.alumnos = 'Elige al menos un alumno.'
  errores.value = e
  if (Object.keys(e).length) return
  errorEmitir.value = ''
  confirmAbierto.value = true
}

const lineasConfirmacion = computed(() => {
  const n = seleccionados.value.length
  const cada = dinero(monto.value)
  const total = dinero(totalEmitido.value)
  const quienes = n === 1 ? seleccionados.value[0]?.nombre : `${n} alumnos`
  const deudores = quedanEnDeuda.value
  const motivo = `Motivo que verán: "${concepto.value?.nombre ?? ''}".`
  return tipo.value === 'BONUS'
    ? [
        `Se enviará un bonus de ${cada} a ${quienes}${n > 1 ? ' (a cada uno)' : ''}. Total: ${total}.`,
        'El dinero no se suma de inmediato: queda pendiente y cada alumno lo cobra desde su cuenta.',
        motivo,
      ]
    : [
        `Se descontará un fine de ${cada} a ${quienes}${n > 1 ? ' (a cada uno)' : ''}. Total: ${total}.`,
        'El descuento se aplica ahora mismo sobre el saldo y no se puede deshacer desde esta pantalla.',
        ...(deudores.length
          ? [
              `${deudores.map((a) => `${a.nombre} ${a.apellidos}`).join(', ')} no tiene${deudores.length > 1 ? 'n' : ''} saldo suficiente: quedará${deudores.length > 1 ? 'n' : ''} con una deuda (saldo negativo) que se irá pagando con lo que cobre${deudores.length > 1 ? 'n' : ''}.`,
            ]
          : []),
        motivo,
      ]
})

async function emitir() {
  if (!concepto.value) return
  emitiendo.value = true
  errorEmitir.value = ''
  try {
    const alumnoIds = [...seleccion.value]
    const r = await nominaService.emitir(
      claseId.value,
      esManual.value
        ? { tipo: tipo.value, concepto: concepto.value.nombre, monto: Number(concepto.value.monto), alumnoIds }
        : { conceptoId: conceptoId.value, alumnoIds },
    )
    const quienes = r.alumnos === 1 ? '1 alumno' : `${r.alumnos} alumnos`
    aviso.value =
      tipo.value === 'BONUS'
        ? `Listo: bonus enviado a ${quienes}. Quedó pendiente de cobro.`
        : `Listo: fine aplicado a ${quienes}.`
    confirmAbierto.value = false
    seleccion.value = []
    motivoManual.value = ''
    montoManual.value = ''
    errores.value = {}
    await recargar()
  } catch (e) {
    errorEmitir.value = mensajeDeError(e)
  } finally {
    emitiendo.value = false
  }
}

// ───── Quitar un movimiento ya emitido ─────
const quitarAbierto = ref(false)
const porQuitar = ref<MovimientoNomina | null>(null)
const quitando = ref(false)
const errorQuitar = ref('')

/** Todo se puede quitar; si el bonus ya se cobró, se descuenta del saldo. */
const sePuedeQuitar = (_m: MovimientoNomina) => true

function pedirQuitar(m: MovimientoNomina) {
  porQuitar.value = m
  errorQuitar.value = ''
  quitarAbierto.value = true
}

const lineasQuitar = computed(() => {
  const m = porQuitar.value
  if (!m) return []
  return m.tipo === 'FINE'
    ? [
        `Se quitará el fine "${m.concepto}" de ${m.alumno}.`,
        `Se le devolverán ${dinero(m.monto)} al saldo de inmediato y el fine desaparecerá de su historial.`,
      ]
    : [
        `Se quitará el bonus "${m.concepto}" de ${m.alumno}.`,
        m.estado === 'COBRADO'
          ? `Ya lo cobró: se le descontarán ${dinero(m.monto)} del saldo y desaparecerá de su historial. Si no le alcanza, su saldo quedará en negativo.`
          : `Aún no lo ha cobrado: dejará de aparecer en su cuenta y no recibirá ${dinero(m.monto)}.`,
      ]
})

async function quitar() {
  if (!porQuitar.value) return
  quitando.value = true
  errorQuitar.value = ''
  try {
    const m = porQuitar.value
    await nominaService.quitarMovimiento(m.id)
    aviso.value = m.tipo === 'FINE' ? 'Fine quitado: se devolvió el dinero al alumno.' : 'Bonus quitado.'
    quitarAbierto.value = false
    await recargar()
  } catch (e) {
    errorQuitar.value = mensajeDeError(e)
  } finally {
    quitando.value = false
  }
}

// ───── Conceptos (catálogo) ─────
const bonusLista = computed(() => (detalle.value?.conceptos ?? []).filter((c) => c.tipo === 'BONUS'))
const finesLista = computed(() => (detalle.value?.conceptos ?? []).filter((c) => c.tipo === 'FINE'))

const formAbierto = ref(false)
const editando = ref<ConceptoNomina | null>(null)
const tipoNuevo = ref<TipoMovimiento>('BONUS')
const guardando = ref(false)
const errorForm = ref('')

function nuevoConcepto(t: TipoMovimiento) {
  editando.value = null
  tipoNuevo.value = t
  errorForm.value = ''
  formAbierto.value = true
}

function editarConcepto(c: ConceptoNomina) {
  editando.value = c
  errorForm.value = ''
  formAbierto.value = true
}

async function guardarConcepto(datos: { nombre: string; monto: number }) {
  guardando.value = true
  errorForm.value = ''
  try {
    if (editando.value) {
      await nominaService.actualizarConcepto(editando.value.id, datos)
      aviso.value = 'Concepto actualizado.'
    } else {
      await nominaService.crearConcepto(claseId.value, { tipo: tipoNuevo.value, ...datos })
      aviso.value = tipoNuevo.value === 'BONUS' ? 'Bonus creado.' : 'Fine creado.'
    }
    formAbierto.value = false
    await recargar()
  } catch (e) {
    errorForm.value = mensajeDeError(e)
  } finally {
    guardando.value = false
  }
}

const borrarAbierto = ref(false)
const porBorrar = ref<ConceptoNomina | null>(null)
const borrando = ref(false)
const errorBorrar = ref('')

function pedirBorrar(c: ConceptoNomina) {
  porBorrar.value = c
  errorBorrar.value = ''
  borrarAbierto.value = true
}

async function borrar() {
  if (!porBorrar.value) return
  borrando.value = true
  errorBorrar.value = ''
  try {
    await nominaService.eliminarConcepto(porBorrar.value.id)
    if (conceptoId.value === porBorrar.value.id) conceptoId.value = ''
    aviso.value = 'Concepto eliminado.'
    borrarAbierto.value = false
    await recargar()
  } catch (e) {
    errorBorrar.value = mensajeDeError(e)
  } finally {
    borrando.value = false
  }
}
</script>

<template>
  <div class="pagina">
    <header class="cabecera">
      <div>
        <h1 class="titulo">Nómina</h1>
        <p class="sub">Emite bonus y fines a los alumnos de tu clase.</p>
      </div>
      <div v-if="clases.length > 1" class="selector campo">
        <label for="clase" class="etiqueta">Clase</label>
        <select id="clase" v-model="claseId" class="entrada" @change="cargarClase">
          <option v-for="c in clases" :key="c.id" :value="c.id">{{ c.nombre }} ({{ c.totalAlumnos }})</option>
        </select>
      </div>
      <p v-else-if="clases[0]" class="clase-unica">{{ clases[0].nombre }}</p>
    </header>

    <p v-if="cargandoClases" class="estado" role="status">Cargando…</p>

    <div v-else-if="errorCarga && !detalle" class="estado error" role="alert">
      <p>{{ errorCarga }}</p>
      <button type="button" class="btn secundario" @click="clases.length ? cargarClase() : cargarClases()">
        Reintentar
      </button>
    </div>

    <div v-else-if="!clases.length" class="estado">
      <p><strong>Aún no tienes clases asignadas.</strong></p>
      <p>El administrador debe asignarte una clase para que puedas emitir bonus y fines.</p>
    </div>

    <template v-else>
      <Alerta v-if="aviso" tipo="ok">{{ aviso }}</Alerta>
      <Alerta v-if="errorCarga" tipo="error">{{ errorCarga }}</Alerta>

      <div class="pestanas" role="tablist" aria-label="Secciones de nómina">
        <button
          type="button"
          role="tab"
          class="pestana"
          :class="{ activa: pestana === 'emitir' }"
          :aria-selected="pestana === 'emitir'"
          @click="pestana = 'emitir'"
        >
          Emitir
        </button>
        <button
          type="button"
          role="tab"
          class="pestana"
          :class="{ activa: pestana === 'reportes' }"
          :aria-selected="pestana === 'reportes'"
          @click="pestana = 'reportes'"
        >
          Reportes y salarios
        </button>
        <button
          type="button"
          role="tab"
          class="pestana"
          :class="{ activa: pestana === 'conceptos' }"
          :aria-selected="pestana === 'conceptos'"
          @click="pestana = 'conceptos'"
        >
          Bonus y fines guardados
        </button>
        <button
          type="button"
          role="tab"
          class="pestana"
          :class="{ activa: pestana === 'tienda' }"
          :aria-selected="pestana === 'tienda'"
          @click="pestana = 'tienda'"
        >
          Tienda
        </button>
        <button
          type="button"
          role="tab"
          class="pestana"
          :class="{ activa: pestana === 'tarjetas' }"
          :aria-selected="pestana === 'tarjetas'"
          @click="pestana = 'tarjetas'"
        >
          Tarjetas
        </button>
      </div>

      <p v-if="cargando" class="estado" role="status">Cargando clase…</p>

      <!-- ───── Pestaña: emitir ───── -->
      <template v-else-if="pestana === 'emitir'">
        <div v-if="!alumnos.length" class="estado">
          <p><strong>Esta clase aún no tiene alumnos activos.</strong></p>
          <p>El administrador los agrega desde Cuentas, eligiendo esta clase.</p>
        </div>

        <div v-else class="rejilla">
          <form class="panel" novalidate @submit.prevent="revisar">
            <h2 class="panel-titulo">Nuevo movimiento</h2>

            <div class="selector-tipo" role="radiogroup" aria-label="Tipo de movimiento">
              <button
                type="button"
                role="radio"
                :aria-checked="tipo === 'BONUS'"
                class="tipo bonus"
                :class="{ activo: tipo === 'BONUS' }"
                @click="cambiarTipo('BONUS')"
              >
                <strong>Bonus</strong>
                <span>Suma dinero (el alumno lo cobra)</span>
              </button>
              <button
                type="button"
                role="radio"
                :aria-checked="tipo === 'FINE'"
                class="tipo fine"
                :class="{ activo: tipo === 'FINE' }"
                @click="cambiarTipo('FINE')"
              >
                <strong>Fine</strong>
                <span>Descuenta dinero al instante</span>
              </button>
            </div>

            <div class="campo">
              <label for="concepto" class="etiqueta">{{ tipo === 'BONUS' ? 'Bonus' : 'Fine' }}</label>
              <select
                id="concepto"
                v-model="conceptoId"
                class="entrada"
                :class="{ 'con-error': errores.concepto }"
              >
                <option value="" disabled>Elige un motivo…</option>
                <option v-for="c in conceptosDelTipo" :key="c.id" :value="c.id">
                  {{ c.nombre }} — {{ dinero(c.monto) }}
                </option>
                <option :value="OTRO">✎ Otro: escribir el motivo y el monto a mano</option>
              </select>
              <p v-if="errores.concepto" class="error" role="alert">{{ errores.concepto }}</p>
              <p v-if="!conceptosDelTipo.length" class="nota">
                Para no escribirlo cada vez, guárdalo en
                <button type="button" class="enlace" @click="pestana = 'conceptos'">Bonus y fines guardados</button>.
              </p>
              <p v-else-if="guardado" class="nota">
                Motivo: <strong>{{ guardado.nombre }}</strong> · Monto a cada alumno:
                <strong>{{ dinero(guardado.monto) }}</strong>
              </p>
            </div>

            <div v-if="esManual" class="fila-doble">
              <div class="campo">
                <label for="motivo" class="etiqueta">Motivo</label>
                <input
                  id="motivo"
                  v-model="motivoManual"
                  class="entrada"
                  :class="{ 'con-error': errores.motivo }"
                  maxlength="200"
                  :placeholder="tipo === 'BONUS' ? 'Ej. Ayudó a un compañero' : 'Ej. Llegó tarde'"
                  autocomplete="off"
                />
                <p v-if="errores.motivo" class="error" role="alert">{{ errores.motivo }}</p>
              </div>
              <div class="campo">
                <label for="monto-manual" class="etiqueta">Monto (CCS$, a cada alumno)</label>
                <input
                  id="monto-manual"
                  v-model="montoManual"
                  class="entrada"
                  :class="{ 'con-error': errores.monto }"
                  inputmode="decimal"
                  placeholder="0.00"
                  autocomplete="off"
                />
                <p v-if="errores.monto" class="error" role="alert">{{ errores.monto }}</p>
              </div>
            </div>

            <fieldset class="alumnos">
              <legend class="etiqueta">Alumnos</legend>
              <label class="fila-todos">
                <input type="checkbox" :checked="todosMarcados" @change="alternarTodos" />
                <span>Seleccionar a todos ({{ alumnos.length }})</span>
              </label>
              <ul class="opciones">
                <li v-for="a in alumnos" :key="a.id">
                  <label class="opcion" :class="{ falta: quedanEnDeuda.some((s) => s.id === a.id) }">
                    <input v-model="seleccion" type="checkbox" :value="a.id" />
                    <span class="opcion-nombre">
                      {{ a.apellidos }}, {{ a.nombre }}
                      <small>
                        <span :class="{ negativo: Number(a.saldo) < 0 }">Saldo {{ dinero(a.saldo) }}</span>
                        <template v-if="Number(a.bonusPorCobrar) > 0">
                          · por cobrar {{ dinero(a.bonusPorCobrar) }}
                        </template>
                        <template v-if="quedanEnDeuda.some((s) => s.id === a.id)"> · quedará en deuda</template>
                      </small>
                    </span>
                  </label>
                </li>
              </ul>
              <p v-if="errores.alumnos" class="error" role="alert">{{ errores.alumnos }}</p>
            </fieldset>

            <Alerta v-if="quedanEnDeuda.length" tipo="aviso">
              Con este fine quedarán con deuda (saldo negativo):
              {{ quedanEnDeuda.map((a) => `${a.nombre} ${a.apellidos}`).join(', ') }}. Se puede aplicar igual.
            </Alerta>

            <p v-if="seleccionados.length && concepto" class="total">
              {{ tipo === 'BONUS' ? 'Se enviarán' : 'Se descontarán' }}
              <strong>{{ dinero(totalEmitido) }}</strong> en total a {{ seleccionados.length }}
              {{ seleccionados.length === 1 ? 'alumno' : 'alumnos' }}.
            </p>

            <button type="submit" class="btn primario">
              {{ tipo === 'BONUS' ? 'Revisar y enviar bonus' : 'Revisar y aplicar fine' }}
            </button>
          </form>

          <section class="panel" aria-labelledby="hist">
            <h2 id="hist" class="panel-titulo">Últimos movimientos</h2>
            <p v-if="!detalle?.movimientos.length" class="nota">Aún no se han emitido bonus ni fines en esta clase.</p>
            <ul v-else class="historial">
              <li v-for="m in detalle.movimientos" :key="m.id" class="mov">
                <div class="mov-izq">
                  <strong>{{ m.alumno }}</strong>
                  <span class="mov-concepto">{{ m.concepto }}</span>
                  <small>{{ fechaCorta(m.fecha) }}</small>
                </div>
                <div class="mov-der">
                  <span class="mov-monto" :class="m.tipo === 'BONUS' ? 'mas' : 'menos'">
                    {{ m.tipo === 'BONUS' ? '+' : '−' }}{{ dinero(m.monto) }}
                  </span>
                  <span class="chip" :class="m.estado === 'PENDIENTE' ? 'pendiente' : m.tipo === 'FINE' ? 'fine' : ''">
                    {{ m.tipo === 'FINE' ? 'Fine aplicado' : m.estado === 'PENDIENTE' ? 'Bonus por cobrar' : 'Bonus cobrado' }}
                  </span>
                  <button v-if="sePuedeQuitar(m)" type="button" class="btn peligro chico" @click="pedirQuitar(m)">
                    Quitar<span class="solo-lector"> {{ m.concepto }} de {{ m.alumno }}</span>
                  </button>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </template>

      <!-- ───── Pestaña: reportes y salarios ───── -->
      <ReportesNomina v-else-if="pestana === 'reportes'" :clase-id="claseId" />

      <!-- ───── Pestaña: tienda ───── -->
      <TiendaNomina v-else-if="pestana === 'tienda'" :clase-id="claseId" />

      <!-- ───── Pestaña: tarjetas NFC ───── -->
      <TarjetasNomina v-else-if="pestana === 'tarjetas'" :clase-id="claseId" />

      <!-- ───── Pestaña: catálogo ───── -->
      <div v-else class="rejilla dos">
        <section v-for="grupo in [
          { t: 'BONUS' as const, titulo: 'Bonus', lista: bonusLista, vacio: 'Aún no hay bonus guardados.' },
          { t: 'FINE' as const, titulo: 'Fines', lista: finesLista, vacio: 'Aún no hay fines guardados.' },
        ]" :key="grupo.t" class="panel">
          <div class="panel-cab">
            <h2 class="panel-titulo">{{ grupo.titulo }}</h2>
            <button type="button" class="btn secundario chico" @click="nuevoConcepto(grupo.t)">
              {{ grupo.t === 'BONUS' ? 'Nuevo bonus' : 'Nuevo fine' }}
            </button>
          </div>
          <p v-if="!grupo.lista.length" class="nota">{{ grupo.vacio }} Créalos una vez y luego emítelos con un clic.</p>
          <ul v-else class="conceptos">
            <li v-for="c in grupo.lista" :key="c.id" class="concepto">
              <div class="concepto-info">
                <strong>{{ c.nombre }}</strong>
                <span class="mov-monto" :class="c.tipo === 'BONUS' ? 'mas' : 'menos'">
                  {{ c.tipo === 'BONUS' ? '+' : '−' }}{{ dinero(c.monto) }}
                </span>
              </div>
              <div class="concepto-acc">
                <button type="button" class="btn secundario chico" @click="editarConcepto(c)">
                  Editar<span class="solo-lector"> {{ c.nombre }}</span>
                </button>
                <button type="button" class="btn peligro chico" @click="pedirBorrar(c)">
                  Eliminar<span class="solo-lector"> {{ c.nombre }}</span>
                </button>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </template>

    <ConfirmDialog
      v-model="confirmAbierto"
      :tono="tipo === 'FINE' ? 'peligro' : 'aviso'"
      :titulo="tipo === 'BONUS' ? '¿Enviar este bonus?' : '¿Aplicar este fine?'"
      :boton="tipo === 'BONUS' ? 'Sí, enviar bonus' : 'Sí, aplicar fine'"
      cancelar="No, volver"
      :lineas="lineasConfirmacion"
      :ejecutando="emitiendo"
      :error="errorEmitir"
      @confirmar="emitir"
    />

    <ConfirmDialog
      v-model="quitarAbierto"
      tono="peligro"
      :titulo="porQuitar?.tipo === 'FINE' ? '¿Quitar este fine?' : '¿Quitar este bonus?'"
      boton="Sí, quitar"
      cancelar="No, conservar"
      :lineas="lineasQuitar"
      :ejecutando="quitando"
      :error="errorQuitar"
      @confirmar="quitar"
    />

    <ConceptoFormDialog
      v-model="formAbierto"
      :concepto="editando"
      :tipo-nuevo="tipoNuevo"
      :cargando="guardando"
      :error="errorForm"
      @guardar="guardarConcepto"
    />

    <ConfirmDialog
      v-model="borrarAbierto"
      tono="peligro"
      :titulo="porBorrar?.tipo === 'FINE' ? '¿Eliminar este fine?' : '¿Eliminar este bonus?'"
      boton="Sí, eliminar"
      cancelar="No, conservar"
      :lineas="[
        `Se eliminará «${porBorrar?.nombre ?? ''}» de la lista de ${porBorrar?.tipo === 'FINE' ? 'fines' : 'bonus'} guardados.`,
        'Lo que ya se emitió con este motivo no cambia: sigue en el historial y en las cuentas de los alumnos.',
      ]"
      :ejecutando="borrando"
      :error="errorBorrar"
      @confirmar="borrar"
    />
  </div>
</template>

<style scoped>
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

.rejilla {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.rejilla.dos {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

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

.nota {
  margin: 0;
  font-size: 0.88rem;
  color: var(--color-texto-suave);
}

.enlace {
  padding: 0;
  font: inherit;
  color: var(--color-azul-2);
  text-decoration: underline;
  background: none;
  border: 0;
  cursor: pointer;
}

/* Catálogo */
.conceptos {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.concepto {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
}

.concepto + .concepto {
  border-top: 1px solid var(--color-borde);
}

.concepto-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.concepto-acc {
  display: flex;
  flex: none;
  gap: 8px;
}

/* Bonus / Fine */
.selector-tipo {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.tipo {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 14px;
  font: inherit;
  text-align: left;
  color: var(--color-texto);
  background: #fff;
  border: 1.5px solid var(--color-borde-fuerte);
  border-radius: var(--radio-sm);
  cursor: pointer;
}

.tipo span {
  font-size: 0.78rem;
  color: var(--color-texto-suave);
}

.tipo.bonus.activo {
  background: var(--ok-fondo);
  border-color: #47cd89;
}

.tipo.fine.activo {
  background: var(--peligro-fondo);
  border-color: #f97066;
}

.tipo:focus-visible {
  outline: 3px solid rgba(47, 63, 112, 0.3);
  outline-offset: 2px;
}

/* Alumnos */
.alumnos {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.alumnos legend {
  padding: 0;
  margin-bottom: 8px;
}

.fila-todos {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
}

.fila-todos input,
.opcion input {
  width: 18px;
  height: 18px;
  accent-color: var(--color-azul-2);
}

.opciones {
  max-height: 260px;
  margin: 0;
  padding: 4px;
  overflow-y: auto;
  list-style: none;
  border: 1px solid var(--color-borde-fuerte);
  border-radius: var(--radio-sm);
}

.opcion {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  font-size: 0.92rem;
  border-radius: 6px;
  cursor: pointer;
}

.opcion:hover {
  background: var(--color-fondo);
}

.opcion.falta {
  background: var(--peligro-fondo);
}

.opcion small {
  display: block;
  color: var(--color-texto-suave);
}

.opcion.falta small,
.negativo {
  color: var(--peligro-texto);
}

.total {
  margin: 0;
  padding: 10px 12px;
  font-size: 0.92rem;
  background: var(--color-fondo);
  border-radius: var(--radio-sm);
}

/* Historial */
.historial {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.mov {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
}

.mov + .mov {
  border-top: 1px solid var(--color-borde);
}

.mov-izq,
.mov-der {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.mov-der {
  align-items: flex-end;
  flex: none;
}

.mov-concepto {
  font-size: 0.88rem;
  color: var(--color-texto-suave);
  overflow-wrap: anywhere;
}

.mov small {
  color: var(--color-texto-suave);
}

.mov-monto {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.mov-monto.mas {
  color: var(--ok-texto);
}

.mov-monto.menos {
  color: var(--peligro-texto);
}

.chip.pendiente {
  color: var(--aviso-texto);
  background: var(--aviso-fondo);
}

.chip.fine {
  color: var(--peligro-texto);
  background: var(--peligro-fondo);
}

@media (max-width: 900px) {
  .rejilla,
  .rejilla.dos {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .selector {
    width: 100%;
  }

  .selector-tipo {
    grid-template-columns: 1fr;
  }

  .concepto {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
