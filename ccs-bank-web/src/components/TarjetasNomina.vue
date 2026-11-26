<script setup lang="ts">
import { onBeforeUnmount, ref, useId, watch } from 'vue'
import Alerta from '@/components/Alerta.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { mensajeDeError } from '@/lib/errores'
import { leerUid, nfcDisponible, normalizarUid } from '@/lib/nfc'
import { tiendaService } from '@/services/tienda.service'
import type { FilaTarjeta } from '@/types/tienda'

const props = defineProps<{ claseId: string }>()

const filas = ref<FilaTarjeta[]>([])
const cargando = ref(true)
const errorCarga = ref('')
const aviso = ref('')
const errorAccion = ref('')
const procesando = ref<string | null>(null)

// ── Diálogo para registrar la tarjeta ──
const idTitulo = useId()
const dialogo = ref<HTMLDialogElement | null>(null)
const abierto = ref(false)
const alumno = ref<FilaTarjeta | null>(null)
const uid = ref('')
const pin = ref('')
const leyendo = ref(false)
const guardando = ref(false)
const errorForm = ref('')
let cancelarLectura: AbortController | null = null

async function cargar() {
  const id = props.claseId
  cargando.value = true
  errorCarga.value = ''
  try {
    const d = await tiendaService.tarjetas(id)
    if (id === props.claseId) filas.value = d
  } catch (e) {
    errorCarga.value = mensajeDeError(e, 'No se pudieron cargar las tarjetas.')
  } finally {
    cargando.value = false
  }
}

watch(
  () => props.claseId,
  () => {
    aviso.value = ''
    errorAccion.value = ''
    cargar()
  },
  { immediate: true },
)

function abrir(f: FilaTarjeta) {
  alumno.value = f
  uid.value = ''
  pin.value = ''
  errorForm.value = ''
  abierto.value = true
  dialogo.value?.showModal()
}

function cerrar() {
  cancelarLectura?.abort()
  abierto.value = false
  if (dialogo.value?.open) dialogo.value.close()
}

onBeforeUnmount(() => cancelarLectura?.abort())

async function leer() {
  errorForm.value = ''
  cancelarLectura = new AbortController()
  leyendo.value = true
  try {
    uid.value = await leerUid(cancelarLectura.signal)
  } catch (e) {
    if (!cancelarLectura.signal.aborted) errorForm.value = e instanceof Error ? e.message : 'No se pudo leer.'
  } finally {
    leyendo.value = false
  }
}

async function guardar() {
  errorForm.value = ''
  if (normalizarUid(uid.value).length < 4) {
    errorForm.value = 'Lee la tarjeta o escribe su código.'
    return
  }
  if (!/^\d{4}$/.test(pin.value)) {
    errorForm.value = 'El PIN debe tener exactamente 4 números.'
    return
  }
  guardando.value = true
  try {
    await tiendaService.registrarTarjeta(alumno.value!.alumnoId, normalizarUid(uid.value), pin.value)
    aviso.value = `Tarjeta de ${alumno.value!.alumno} registrada. Dile su PIN al alumno y que no lo comparta.`
    cerrar()
    await cargar()
  } catch (e) {
    errorForm.value = mensajeDeError(e)
  } finally {
    guardando.value = false
  }
}

async function bloquear(f: FilaTarjeta, bloquear: boolean) {
  procesando.value = f.alumnoId
  errorAccion.value = ''
  aviso.value = ''
  try {
    await tiendaService.bloquearTarjeta(f.alumnoId, bloquear)
    await cargar()
  } catch (e) {
    errorAccion.value = mensajeDeError(e)
  } finally {
    procesando.value = null
  }
}

// ── Quitar tarjeta ──
const quitarAbierto = ref(false)
const porQuitar = ref<FilaTarjeta | null>(null)
const quitando = ref(false)
const errorQuitar = ref('')

function pedirQuitar(f: FilaTarjeta) {
  porQuitar.value = f
  errorQuitar.value = ''
  quitarAbierto.value = true
}

async function quitar() {
  if (!porQuitar.value) return
  quitando.value = true
  errorQuitar.value = ''
  try {
    await tiendaService.quitarTarjeta(porQuitar.value.alumnoId)
    quitarAbierto.value = false
    aviso.value = 'Tarjeta quitada.'
    await cargar()
  } catch (e) {
    errorQuitar.value = mensajeDeError(e)
  } finally {
    quitando.value = false
  }
}
</script>

<template>
  <p v-if="cargando && !filas.length" class="estado" role="status">Cargando tarjetas…</p>

  <div v-else-if="errorCarga" class="estado error" role="alert">
    <p>{{ errorCarga }}</p>
    <button type="button" class="btn secundario" @click="cargar">Reintentar</button>
  </div>

  <div v-else class="tarjetas">
    <Alerta v-if="aviso" tipo="ok">{{ aviso }}</Alerta>
    <Alerta v-if="errorAccion" tipo="error">{{ errorAccion }}</Alerta>

    <section class="panel" aria-labelledby="tj">
      <div>
        <h2 id="tj" class="panel-titulo">Tarjetas NFC de la clase</h2>
        <p class="nota">
          Registra la tarjeta de cada alumno acercándola a tu teléfono y define su PIN de 4 números. Con 5 PIN
          incorrectos seguidos la tarjeta se bloquea.
        </p>
      </div>

      <p v-if="!filas.length" class="vacio">Esta clase aún no tiene alumnos activos.</p>

      <ul v-else class="lista">
        <li v-for="f in filas" :key="f.alumnoId" class="fila">
          <div class="fila-info">
            <strong>{{ f.alumno }}</strong>
            <small v-if="f.terminacion">Tarjeta …{{ f.terminacion }}</small>
            <span v-if="!f.estado" class="chip">Sin tarjeta</span>
            <span v-else-if="f.estado === 'BLOQUEADA'" class="chip">Bloqueada</span>
            <span v-else class="chip neutro">Activa</span>
          </div>
          <div class="fila-acciones">
            <button type="button" class="btn primario chico" @click="abrir(f)">
              {{ f.estado ? 'Cambiar tarjeta' : 'Registrar tarjeta' }}
            </button>
            <template v-if="f.estado">
              <button
                type="button"
                class="btn secundario chico"
                :disabled="procesando === f.alumnoId"
                @click="bloquear(f, f.estado !== 'BLOQUEADA')"
              >
                {{ f.estado === 'BLOQUEADA' ? 'Reactivar' : 'Bloquear' }}
              </button>
              <button type="button" class="btn peligro chico" @click="pedirQuitar(f)">Quitar</button>
            </template>
          </div>
        </li>
      </ul>
    </section>

    <dialog ref="dialogo" class="dialogo" :aria-labelledby="idTitulo" @close="abierto = false" @cancel="guardando && $event.preventDefault()">
      <form class="forma" novalidate @submit.prevent="guardar">
        <h2 :id="idTitulo" class="dialogo-titulo">Tarjeta de {{ alumno?.alumno }}</h2>

        <div class="campo">
          <span class="etiqueta">Tarjeta</span>
          <button v-if="nfcDisponible()" type="button" class="btn secundario" :disabled="leyendo" :aria-busy="leyendo" @click="leer">
            {{ leyendo ? 'Acerca la tarjeta al teléfono…' : uid ? 'Leer otra vez' : 'Leer tarjeta' }}
          </button>
          <Alerta v-else tipo="aviso">
            Este navegador no lee NFC. Abre la página en Chrome desde un teléfono Android, o escribe el código de la
            tarjeta aquí abajo.
          </Alerta>
          <input v-model="uid" class="entrada" placeholder="Código de la tarjeta" autocomplete="off" aria-label="Código de la tarjeta" />
        </div>

        <div class="campo">
          <label :for="`${idTitulo}-pin`" class="etiqueta">PIN (4 números)</label>
          <input
            :id="`${idTitulo}-pin`"
            v-model="pin"
            class="entrada"
            inputmode="numeric"
            maxlength="4"
            placeholder="••••"
            autocomplete="off"
          />
        </div>

        <Alerta v-if="alumno?.estado" tipo="info">La tarjeta y el PIN anteriores dejarán de funcionar.</Alerta>
        <Alerta v-if="errorForm" tipo="error">{{ errorForm }}</Alerta>

        <div class="acciones">
          <button type="button" class="btn secundario" :disabled="guardando" @click="cerrar">Cancelar</button>
          <button type="submit" class="btn primario" :disabled="guardando" :aria-busy="guardando">
            {{ guardando ? 'Guardando…' : 'Guardar tarjeta' }}
          </button>
        </div>
      </form>
    </dialog>

    <ConfirmDialog
      v-model="quitarAbierto"
      titulo="¿Quitar la tarjeta?"
      boton="Quitar tarjeta"
      :ejecutando="quitando"
      :error="errorQuitar"
      @confirmar="quitar"
    >
      <p>
        {{ porQuitar?.alumno }} ya no podrá pagar con tarjeta hasta que registres una nueva. Su saldo no cambia.
      </p>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.tarjetas {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  background: #fff;
  border: 1px solid var(--color-borde);
  border-radius: var(--radio-md);
  box-shadow: var(--sombra-sm);
}

.panel-titulo {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: 1.1rem;
  color: var(--color-azul-2);
}

.nota {
  margin: 4px 0 0;
  font-size: 0.88rem;
  color: var(--color-texto-suave);
}

.vacio {
  margin: 0;
  padding: 24px 16px;
  text-align: center;
  color: var(--color-texto-suave);
  background: var(--color-fondo);
  border-radius: var(--radio-sm);
}

.lista {
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
  align-items: flex-start;
  gap: 3px;
  min-width: 0;
}

.fila-info small {
  color: var(--color-texto-suave);
}

.fila-acciones {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 640px) {
  .fila {
    flex-direction: column;
    align-items: stretch;
  }

  .fila-acciones {
    justify-content: flex-start;
  }
}
</style>
