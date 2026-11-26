<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import Alerta from '@/components/Alerta.vue'
import { mensajeDeError } from '@/lib/errores'
import { leerUid, nfcDisponible, normalizarUid } from '@/lib/nfc'
import { tiendaService } from '@/services/tienda.service'
import type { Producto } from '@/types/tienda'

const props = defineProps<{ claseId: string; productos: Producto[] }>()
const emit = defineEmits<{ cobrado: [] }>()

const carrito = reactive<Record<string, number>>({})
const uid = ref('')
const alumno = ref('')
const bloqueada = ref(false)
const pin = ref('')
const leyendo = ref(false)
const cobrando = ref(false)
const error = ref('')
const exito = ref('')
let cancelar: AbortController | null = null

const MAX = 20
const dinero = (v: string | number) =>
  `CCS$ ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const disponibles = computed(() => props.productos.filter((p) => p.activo && p.stock > 0))
const lineas = computed(() =>
  disponibles.value
    .filter((p) => (carrito[p.id] ?? 0) > 0)
    .map((p) => ({ p, cantidad: carrito[p.id]!, subtotal: Number(p.precio) * carrito[p.id]! })),
)
const total = computed(() => Math.round(lineas.value.reduce((s, l) => s + l.subtotal, 0) * 100) / 100)

function cambiar(p: Producto, delta: number) {
  carrito[p.id] = Math.max(0, Math.min((carrito[p.id] ?? 0) + delta, p.stock, MAX))
  exito.value = ''
}

function reiniciarTarjeta() {
  uid.value = ''
  alumno.value = ''
  bloqueada.value = false
  pin.value = ''
}

onBeforeUnmount(() => cancelar?.abort())

/** Identifica la tarjeta (con NFC o con el código escrito a mano) y dice de quién es. */
async function identificar(codigo: string) {
  const u = normalizarUid(codigo)
  const r = await tiendaService.consultarTarjeta(props.claseId, u)
  uid.value = u
  alumno.value = r.alumno
  bloqueada.value = r.bloqueada
  pin.value = ''
}

async function leer() {
  error.value = ''
  exito.value = ''
  reiniciarTarjeta()
  cancelar = new AbortController()
  leyendo.value = true
  try {
    await identificar(await leerUid(cancelar.signal))
  } catch (e) {
    if (!cancelar.signal.aborted) error.value = mensajeDeError(e, e instanceof Error ? e.message : 'No se pudo leer.')
  } finally {
    leyendo.value = false
  }
}

const manual = ref('')
async function usarCodigo() {
  error.value = ''
  exito.value = ''
  reiniciarTarjeta()
  try {
    await identificar(manual.value)
  } catch (e) {
    error.value = mensajeDeError(e)
  }
}

async function cobrar() {
  error.value = ''
  if (!/^\d{4}$/.test(pin.value)) {
    error.value = 'El PIN son 4 números.'
    return
  }
  cobrando.value = true
  try {
    const r = await tiendaService.cobrarConTarjeta(props.claseId, {
      uid: uid.value,
      pin: pin.value,
      items: lineas.value.map((l) => ({ productoId: l.p.id, cantidad: l.cantidad })),
    })
    exito.value = `Cobro de ${dinero(r.total)} a ${r.alumno}. Saldo restante: ${dinero(r.saldo)}. Entrega el premio.`
    for (const id of Object.keys(carrito)) delete carrito[id]
    reiniciarTarjeta()
    emit('cobrado')
  } catch (e) {
    error.value = mensajeDeError(e)
    pin.value = ''
  } finally {
    cobrando.value = false
  }
}
</script>

<template>
  <section class="panel" aria-labelledby="ct">
    <div>
      <h2 id="ct" class="panel-titulo">Cobrar con tarjeta</h2>
      <p class="nota">Elige los productos, acerca la tarjeta del alumno a tu teléfono y pídele que escriba su PIN.</p>
    </div>

    <Alerta v-if="exito" tipo="ok">{{ exito }}</Alerta>

    <p v-if="!disponibles.length" class="vacio">No hay productos con stock para vender.</p>

    <template v-else>
      <ul class="prods">
        <li v-for="p in disponibles" :key="p.id" class="prod">
          <div class="prod-info">
            <strong>{{ p.nombre }}</strong>
            <small>{{ dinero(p.precio) }} · quedan {{ p.stock }}</small>
          </div>
          <div class="cantidad" role="group" :aria-label="`Cantidad de ${p.nombre}`">
            <button type="button" class="btn secundario chico" :disabled="!(carrito[p.id] ?? 0)" :aria-label="`Quitar uno de ${p.nombre}`" @click="cambiar(p, -1)">−</button>
            <output class="cant-valor">{{ carrito[p.id] ?? 0 }}</output>
            <button type="button" class="btn secundario chico" :disabled="(carrito[p.id] ?? 0) >= Math.min(p.stock, MAX)" :aria-label="`Agregar uno de ${p.nombre}`" @click="cambiar(p, 1)">+</button>
          </div>
        </li>
      </ul>

      <div v-if="lineas.length" class="total">
        <span>{{ lineas.map((l) => `${l.cantidad}× ${l.p.nombre}`).join(', ') }}</span>
        <strong>{{ dinero(total) }}</strong>
      </div>

      <template v-if="lineas.length">
        <div v-if="!alumno" class="leer">
          <button v-if="nfcDisponible()" type="button" class="btn primario" :disabled="leyendo" :aria-busy="leyendo" @click="leer">
            {{ leyendo ? 'Acerca la tarjeta al teléfono…' : 'Leer tarjeta' }}
          </button>
          <Alerta v-else tipo="aviso">
            Este navegador no lee NFC (usa Chrome en Android). Puedes escribir el código de la tarjeta:
          </Alerta>
          <form v-if="!nfcDisponible()" class="manual" @submit.prevent="usarCodigo">
            <input v-model="manual" class="entrada" placeholder="Código de la tarjeta" autocomplete="off" aria-label="Código de la tarjeta" />
            <button type="submit" class="btn secundario">Buscar</button>
          </form>
        </div>

        <form v-else class="pin" @submit.prevent="cobrar">
          <p class="quien">
            Tarjeta de <strong>{{ alumno }}</strong>
          </p>
          <Alerta v-if="bloqueada" tipo="error">Esta tarjeta está bloqueada. Reactívala en la pestaña Tarjetas.</Alerta>
          <template v-else>
            <label for="pin-cobro" class="etiqueta">PIN del alumno</label>
            <input
              id="pin-cobro"
              v-model="pin"
              class="entrada"
              type="password"
              inputmode="numeric"
              maxlength="4"
              autocomplete="off"
              placeholder="••••"
            />
            <div class="acciones">
              <button type="button" class="btn secundario" :disabled="cobrando" @click="reiniciarTarjeta">Otra tarjeta</button>
              <button type="submit" class="btn primario" :disabled="cobrando" :aria-busy="cobrando">
                {{ cobrando ? 'Cobrando…' : `Cobrar ${dinero(total)}` }}
              </button>
            </div>
          </template>
        </form>
      </template>

      <Alerta v-if="error" tipo="error">{{ error }}</Alerta>
    </template>
  </section>
</template>

<style scoped>
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
  padding: 20px 16px;
  text-align: center;
  color: var(--color-texto-suave);
  background: var(--color-fondo);
  border-radius: var(--radio-sm);
}

.prods {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.prod {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
}

.prod + .prod {
  border-top: 1px solid var(--color-borde);
}

.prod-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.prod-info small {
  color: var(--color-texto-suave);
}

.cantidad {
  display: flex;
  flex: none;
  align-items: center;
  gap: 12px;
}

.cant-valor {
  min-width: 2ch;
  text-align: center;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.total {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--color-borde);
}

.leer,
.pin {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.manual {
  display: flex;
  gap: 8px;
}

.manual .entrada {
  flex: 1;
}

.quien {
  margin: 0;
}

.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
