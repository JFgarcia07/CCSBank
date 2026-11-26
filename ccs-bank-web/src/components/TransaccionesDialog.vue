<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import Alerta from '@/components/Alerta.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { mensajeDeError } from '@/lib/errores'
import { nominaService } from '@/services/nomina.service'
import type { TransaccionClase } from '@/types/nomina'

const abierto = defineModel<boolean>({ required: true })

const props = defineProps<{ gradoId: string; alumno: { id: string; nombre: string } | null }>()

/** Se emite después de quitar algo, para que la pantalla refresque los totales. */
const emit = defineEmits<{ cambio: [] }>()

type Filtro = '' | 'SALARIO' | 'BONUS' | 'FINE'
const filtros: { valor: Filtro; texto: string }[] = [
  { valor: '', texto: 'Todas' },
  { valor: 'SALARIO', texto: 'Salarios' },
  { valor: 'BONUS', texto: 'Bonus' },
  { valor: 'FINE', texto: 'Fines' },
]

const idTitulo = useId()
const dialogo = ref<HTMLDialogElement | null>(null)
const filtro = ref<Filtro>('')
const lista = ref<TransaccionClase[]>([])
const cargando = ref(false)
const errorCarga = ref('')
const aviso = ref('')

const dinero = (v: string | number) =>
  `CCS$ ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })

const NOMBRE_TIPO = { SALARIO: 'Salario', BONUS: 'Bonus', FINE: 'Fine' } as const

async function cargar() {
  const alumnoId = props.alumno?.id
  if (!alumnoId) return
  const f = filtro.value
  cargando.value = true
  errorCarga.value = ''
  try {
    const datos = await nominaService.transacciones(props.gradoId, f || undefined, alumnoId)
    // Si mientras tanto cambió el filtro o el alumno, esta respuesta ya no aplica.
    if (alumnoId === props.alumno?.id && f === filtro.value) lista.value = datos
  } catch (e) {
    errorCarga.value = mensajeDeError(e, 'No se pudieron cargar las transacciones.')
  } finally {
    cargando.value = false
  }
}

watch(abierto, (v) => {
  if (v) {
    filtro.value = ''
    aviso.value = ''
    lista.value = []
    if (!dialogo.value?.open) dialogo.value?.showModal()
    cargar()
  } else if (dialogo.value?.open) {
    dialogo.value.close()
  }
})

function etiquetaEstado(t: TransaccionClase) {
  if (t.estado === 'PENDIENTE') return { texto: 'Por cobrar', clase: 'pendiente' }
  if (t.estado === 'COBRADO') return { texto: 'Cobrado', clase: 'cobrado' }
  return { texto: 'Aplicado', clase: 'aplicado' }
}

// ───── Quitar ─────
const quitarAbierto = ref(false)
const porQuitar = ref<TransaccionClase | null>(null)
const quitando = ref(false)
const errorQuitar = ref('')

function pedirQuitar(t: TransaccionClase) {
  porQuitar.value = t
  errorQuitar.value = ''
  quitarAbierto.value = true
}

const lineasQuitar = computed(() => {
  const t = porQuitar.value
  if (!t) return []
  if (t.tipo === 'FINE') {
    return [
      `Se quitará el fine "${t.concepto}" de ${t.alumno}.`,
      `Se le devolverán ${dinero(t.monto)} al saldo de inmediato y el fine desaparecerá de su historial.`,
    ]
  }
  const que = t.tipo === 'SALARIO' ? 'salario' : 'bonus'
  const lineas = [
    `Se quitará el ${que} "${t.concepto}" de ${t.alumno}.`,
    t.estado === 'COBRADO'
      ? `Ya lo cobró: se le descontarán ${dinero(t.monto)} del saldo y desaparecerá de su historial. Si no le alcanza, su saldo quedará en negativo.`
      : `Aún no lo ha cobrado: dejará de aparecer en su cuenta y no recibirá ${dinero(t.monto)}.`,
  ]
  if (t.tipo === 'SALARIO') lineas.push('Su reporte de esa semana volverá a quedar por pagar, por si quieres pagarlo otra vez.')
  return lineas
})

async function quitar() {
  const t = porQuitar.value
  if (!t) return
  quitando.value = true
  errorQuitar.value = ''
  try {
    await nominaService.quitarMovimiento(t.id)
    aviso.value =
      t.tipo === 'FINE'
        ? 'Fine quitado: se devolvió el dinero al alumno.'
        : `${NOMBRE_TIPO[t.tipo]} quitado.`
    quitarAbierto.value = false
    await cargar()
    emit('cambio')
  } catch (e) {
    errorQuitar.value = mensajeDeError(e)
  } finally {
    quitando.value = false
  }
}
</script>

<template>
  <dialog
    ref="dialogo"
    class="dialogo transacciones"
    :aria-labelledby="idTitulo"
    @close="abierto = false"
  >
    <div class="forma">
      <div class="cab">
        <h2 :id="idTitulo" class="dialogo-titulo">Transacciones de {{ alumno?.nombre }}</h2>
        <button type="button" class="btn secundario chico" @click="abierto = false">Cerrar</button>
      </div>

      <div class="campo filtro">
        <label :for="`${idTitulo}-f`" class="etiqueta">Mostrar</label>
        <select :id="`${idTitulo}-f`" v-model="filtro" class="entrada" @change="cargar">
          <option v-for="f in filtros" :key="f.valor" :value="f.valor">{{ f.texto }}</option>
        </select>
      </div>

      <Alerta v-if="aviso" tipo="ok">{{ aviso }}</Alerta>
      <Alerta v-if="errorCarga" tipo="error">{{ errorCarga }}</Alerta>

      <p v-if="cargando && !lista.length" class="vacio" role="status">Cargando…</p>
      <p v-else-if="!lista.length && !errorCarga" class="vacio">No hay transacciones de este tipo para este alumno.</p>

      <div v-else-if="lista.length" class="tabla-caja desplazable" :aria-busy="cargando">
        <table class="tabla">
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Tipo</th>
              <th scope="col">Concepto</th>
              <th scope="col" class="num">Monto</th>
              <th scope="col">Estado</th>
              <th scope="col"><span class="solo-lector">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in lista" :key="t.id">
              <td class="nowrap">{{ fechaCorta(t.fecha) }}</td>
              <td>
                <span class="tipo" :class="t.tipo.toLowerCase()">{{ NOMBRE_TIPO[t.tipo] }}</span>
              </td>
              <td class="concepto">{{ t.concepto }}</td>
              <td class="num fuerte" :class="t.tipo === 'FINE' ? 'negativo' : 'positivo'">
                {{ t.tipo === 'FINE' ? '−' : '+' }}{{ dinero(t.monto) }}
              </td>
              <td>
                <span class="estado-chip" :class="etiquetaEstado(t).clase">{{ etiquetaEstado(t).texto }}</span>
              </td>
              <td class="acc">
                <button type="button" class="btn peligro chico" @click="pedirQuitar(t)">
                  Quitar<span class="solo-lector"> {{ NOMBRE_TIPO[t.tipo].toLowerCase() }} {{ t.concepto }}</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="lista.length" class="pie">
        {{ lista.length }} {{ lista.length === 1 ? 'transacción' : 'transacciones' }}
      </p>
    </div>
  </dialog>

  <ConfirmDialog
    v-model="quitarAbierto"
    :titulo="porQuitar?.tipo === 'FINE' ? '¿Quitar este fine?' : porQuitar?.tipo === 'SALARIO' ? '¿Quitar este salario?' : '¿Quitar este bonus?'"
    boton="Sí, quitar"
    cancelar="No, conservarlo"
    :lineas="lineasQuitar"
    :ejecutando="quitando"
    :error="errorQuitar"
    @confirmar="quitar"
  />
</template>

<style scoped>
.transacciones {
  width: min(980px, calc(100vw - 32px));
}

.cab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.filtro {
  max-width: 240px;
}

.desplazable {
  max-height: min(55vh, 480px);
  overflow: auto;
}

.vacio {
  margin: 0;
  padding: 24px 0;
  text-align: center;
  color: var(--color-texto-suave);
}

.nowrap {
  white-space: nowrap;
}

.concepto {
  max-width: 260px;
}

.acc {
  text-align: right;
  white-space: nowrap;
}

.positivo {
  color: var(--ok-texto);
}

.negativo {
  color: var(--peligro-texto);
}

.fuerte {
  font-weight: 700;
}

.tipo,
.estado-chip {
  display: inline-block;
  padding: 2px 10px;
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: 999px;
  white-space: nowrap;
}

.tipo.salario {
  color: var(--color-azul-2);
  background: var(--color-fondo);
}

.tipo.bonus,
.estado-chip.cobrado {
  color: var(--ok-texto);
  background: var(--ok-fondo);
}

.tipo.fine,
.estado-chip.aplicado {
  color: var(--peligro-texto);
  background: var(--peligro-fondo);
}

.estado-chip.pendiente {
  color: var(--aviso-texto);
  background: var(--aviso-fondo);
}

.pie {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-texto-suave);
}
</style>
