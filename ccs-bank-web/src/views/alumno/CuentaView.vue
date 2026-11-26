<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Alerta from '@/components/Alerta.vue'
import { mensajeDeError } from '@/lib/errores'
import { cuentaService } from '@/services/cuenta.service'
import type { ResumenCuenta } from '@/types/cuenta'

const cuenta = ref<ResumenCuenta | null>(null)
const cargando = ref(true)
const errorCarga = ref('')
const aviso = ref('')
const errorAviso = ref('')
/** id del pago que se está cobrando, o 'todo'. */
const cobrando = ref<string | null>(null)

const dinero = (v: string | number) => {
  const n = Number(v)
  const texto = Math.abs(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${n < 0 ? '−' : ''}CCS$ ${texto}`
}

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })

async function cargar() {
  cargando.value = true
  errorCarga.value = ''
  try {
    cuenta.value = await cuentaService.resumen()
  } catch (e) {
    errorCarga.value = mensajeDeError(e, 'No se pudo cargar tu cuenta.')
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)

async function cobrar(id: string | null) {
  cobrando.value = id ?? 'todo'
  aviso.value = ''
  errorAviso.value = ''
  try {
    const r = id ? await cuentaService.cobrar(id) : await cuentaService.cobrarTodo()
    aviso.value = `Cobraste ${dinero(r.total)}. Tu saldo ahora es ${dinero(r.saldo)}.`
    cuenta.value = await cuentaService.resumen()
  } catch (e) {
    errorAviso.value = mensajeDeError(e)
    // Si ya estaba cobrado (otra pestaña), refresca la lista para que quede al día.
    try {
      cuenta.value = await cuentaService.resumen()
    } catch {
      /* se conserva lo que ya se veía */
    }
  } finally {
    cobrando.value = null
  }
}
</script>

<template>
  <div class="pagina">
    <header class="cabecera">
      <div>
        <h1 class="titulo">Mi cuenta</h1>
        <p class="sub">Consulta tu saldo y cobra tus pagos pendientes.</p>
      </div>
    </header>

    <p v-if="cargando" class="estado" role="status">Cargando tu cuenta…</p>

    <div v-else-if="errorCarga" class="estado error" role="alert">
      <p>{{ errorCarga }}</p>
      <button type="button" class="btn secundario" @click="cargar">Reintentar</button>
    </div>

    <template v-else-if="cuenta">
      <Alerta v-if="aviso" tipo="ok">{{ aviso }}</Alerta>
      <Alerta v-if="errorAviso" tipo="error">{{ errorAviso }}</Alerta>

      <section class="saldo" :class="{ deuda: cuenta.enDeuda }" aria-label="Saldo">
        <span class="saldo-etiqueta">{{ cuenta.enDeuda ? 'Tu deuda' : 'Tu saldo' }}</span>
        <strong class="saldo-valor">{{ dinero(cuenta.enDeuda ? cuenta.saldo.replace('-', '') : cuenta.saldo) }}</strong>
        <p v-if="cuenta.enDeuda" class="saldo-nota">
          Tu saldo es negativo por un fine. Lo que cobres abajo se suma a tu cuenta y reduce tu deuda.
        </p>
        <p v-else class="saldo-nota">Este es el dinero que tienes disponible hoy.</p>
      </section>

      <section class="panel" aria-labelledby="pend">
        <div class="panel-cab">
          <div>
            <h2 id="pend" class="panel-titulo">Pagos pendientes</h2>
            <p class="nota">
              <template v-if="cuenta.pendientes.length">
                Tienes {{ dinero(cuenta.totalPendiente) }} por cobrar en
                {{ cuenta.pendientes.length }} {{ cuenta.pendientes.length === 1 ? 'pago' : 'pagos' }}.
              </template>
              <template v-else>Nada por cobrar por ahora.</template>
            </p>
          </div>
          <button
            v-if="cuenta.pendientes.length > 1"
            type="button"
            class="btn primario"
            :disabled="cobrando !== null"
            :aria-busy="cobrando === 'todo'"
            @click="cobrar(null)"
          >
            {{ cobrando === 'todo' ? 'Cobrando…' : `Cobrar todo (${dinero(cuenta.totalPendiente)})` }}
          </button>
        </div>

        <div v-if="!cuenta.pendientes.length" class="vacio">
          Cuando tu maestro te pague un salario o te dé un bonus, aparecerá aquí para que lo cobres.
        </div>

        <ul v-else class="pagos">
          <li v-for="p in cuenta.pendientes" :key="p.id" class="pago">
            <div class="pago-info">
              <span class="chip" :class="p.tipo === 'BONUS' ? 'neutro' : ''">
                {{ p.tipo === 'BONUS' ? 'Bonus' : 'Salario' }}
              </span>
              <strong>{{ p.concepto }}</strong>
              <small>{{ fecha(p.creadoEn) }}</small>
            </div>
            <div class="pago-der">
              <span class="pago-monto">+{{ dinero(p.monto) }}</span>
              <button
                type="button"
                class="btn primario chico"
                :disabled="cobrando !== null"
                :aria-busy="cobrando === p.id"
                @click="cobrar(p.id)"
              >
                {{ cobrando === p.id ? 'Cobrando…' : 'Cobrar' }}<span class="solo-lector"> {{ p.concepto }}</span>
              </button>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.saldo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 24px;
  background: #fff;
  border: 1px solid var(--color-borde);
  border-left: 5px solid var(--ok-texto);
  border-radius: var(--radio-md);
  box-shadow: var(--sombra-sm);
}

.saldo.deuda {
  background: var(--peligro-fondo);
  border-color: var(--peligro-borde);
  border-left-color: var(--peligro-texto);
}

.saldo-etiqueta {
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-texto-suave);
}

.saldo-valor {
  font-family: var(--fuente-titulo);
  font-size: clamp(2rem, 6vw, 2.8rem);
  color: var(--color-azul-2);
}

.saldo.deuda .saldo-valor,
.saldo.deuda .saldo-etiqueta {
  color: var(--peligro-texto);
}

.saldo-nota {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-texto-suave);
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

.nota {
  margin: 4px 0 0;
  font-size: 0.88rem;
  color: var(--color-texto-suave);
}

.vacio {
  padding: 28px 16px;
  text-align: center;
  color: var(--color-texto-suave);
  background: var(--color-fondo);
  border-radius: var(--radio-sm);
}

.pagos {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pago {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
}

.pago + .pago {
  border-top: 1px solid var(--color-borde);
}

.pago-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.pago-info small {
  color: var(--color-texto-suave);
}

.pago-der {
  display: flex;
  flex: none;
  align-items: center;
  gap: 14px;
}

.pago-monto {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--ok-texto);
}

@media (max-width: 520px) {
  .pago {
    flex-direction: column;
    align-items: stretch;
  }

  .pago-der {
    justify-content: space-between;
  }

  .panel-cab .btn {
    width: 100%;
  }
}
</style>
