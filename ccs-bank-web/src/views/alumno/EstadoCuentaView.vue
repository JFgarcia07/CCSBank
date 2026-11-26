<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import Alerta from '@/components/Alerta.vue'
import { mensajeDeError } from '@/lib/errores'
import { cuentaService } from '@/services/cuenta.service'
import type { EstadoDeCuenta, TipoMovimientoCuenta } from '@/types/cuenta'

const estado = ref<EstadoDeCuenta | null>(null)
const cargando = ref(true)
const errorCarga = ref('')

const filtros = reactive<{ tipo: '' | TipoMovimientoCuenta; desde: string; hasta: string }>({
  tipo: '',
  desde: '',
  hasta: '',
})
const pagina = ref(1)

const TIPOS: { valor: '' | TipoMovimientoCuenta; texto: string }[] = [
  { valor: '', texto: 'Todos los movimientos' },
  { valor: 'SALARIO', texto: 'Salarios' },
  { valor: 'BONUS', texto: 'Bonus' },
  { valor: 'FINE', texto: 'Fines' },
  { valor: 'COMPRA', texto: 'Compras' },
  { valor: 'TRANSFERENCIA', texto: 'Transferencias' },
  { valor: 'PRESTAMO', texto: 'Préstamos' },
]
const NOMBRE_TIPO: Record<TipoMovimientoCuenta, string> = {
  SALARIO: 'Salario',
  BONUS: 'Bonus',
  FINE: 'Fine',
  COMPRA: 'Compra',
  TRANSFERENCIA: 'Transferencia',
  PRESTAMO: 'Préstamo',
}

const dinero = (v: string | number) => {
  const n = Number(v)
  const texto = Math.abs(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${n < 0 ? '−' : ''}CCS$ ${texto}`
}
const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })

const hayFiltros = computed(() => !!(filtros.tipo || filtros.desde || filtros.hasta))
const totalPaginas = computed(() => (estado.value ? Math.max(1, Math.ceil(estado.value.total / estado.value.porPagina)) : 1))

async function cargar() {
  cargando.value = true
  errorCarga.value = ''
  try {
    estado.value = await cuentaService.estadoDeCuenta({
      tipo: filtros.tipo || undefined,
      desde: filtros.desde,
      hasta: filtros.hasta,
      pagina: pagina.value,
    })
  } catch (e) {
    errorCarga.value = mensajeDeError(e, 'No se pudo cargar tu estado de cuenta.')
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)

function filtrar() {
  pagina.value = 1
  cargar()
}

function limpiar() {
  filtros.tipo = ''
  filtros.desde = ''
  filtros.hasta = ''
  filtrar()
}

function irPagina(delta: number) {
  pagina.value = Math.min(totalPaginas.value, Math.max(1, pagina.value + delta))
  cargar()
}
</script>

<template>
  <div class="pagina">
    <header class="cabecera">
      <div>
        <h1 class="titulo">Estado de cuenta</h1>
        <p class="sub">Todo lo que ha entrado y salido de tu cuenta, con tu saldo después de cada movimiento.</p>
      </div>
    </header>

    <p v-if="cargando && !estado" class="estado" role="status">Cargando tu estado de cuenta…</p>

    <div v-else-if="errorCarga && !estado" class="estado error" role="alert">
      <p>{{ errorCarga }}</p>
      <button type="button" class="btn secundario" @click="cargar">Reintentar</button>
    </div>

    <template v-else-if="estado">
      <Alerta v-if="errorCarga" tipo="error">{{ errorCarga }}</Alerta>

      <section class="resumen" aria-label="Resumen">
        <div class="stat">
          <span class="stat-etiqueta">Saldo actual</span>
          <strong class="stat-valor" :class="{ negativo: Number(estado.saldo) < 0 }">{{ dinero(estado.saldo) }}</strong>
        </div>
        <div class="stat">
          <span class="stat-etiqueta">Ingresos{{ hayFiltros ? ' (filtrados)' : '' }}</span>
          <strong class="stat-valor positivo">+{{ dinero(estado.totalIngresos) }}</strong>
        </div>
        <div class="stat">
          <span class="stat-etiqueta">Egresos{{ hayFiltros ? ' (filtrados)' : '' }}</span>
          <strong class="stat-valor negativo">−{{ dinero(estado.totalEgresos) }}</strong>
        </div>
      </section>

      <form class="filtros" @submit.prevent="filtrar">
        <div class="campo">
          <label for="f-tipo" class="etiqueta">Tipo</label>
          <select id="f-tipo" v-model="filtros.tipo" class="entrada" @change="filtrar">
            <option v-for="t in TIPOS" :key="t.valor" :value="t.valor">{{ t.texto }}</option>
          </select>
        </div>
        <div class="campo">
          <label for="f-desde" class="etiqueta">Desde</label>
          <input id="f-desde" v-model="filtros.desde" type="date" class="entrada" :max="filtros.hasta || undefined" @change="filtrar" />
        </div>
        <div class="campo">
          <label for="f-hasta" class="etiqueta">Hasta</label>
          <input id="f-hasta" v-model="filtros.hasta" type="date" class="entrada" :min="filtros.desde || undefined" @change="filtrar" />
        </div>
        <button v-if="hayFiltros" type="button" class="btn secundario" @click="limpiar">Quitar filtros</button>
      </form>

      <div v-if="!estado.movimientos.length" class="estado">
        <p v-if="hayFiltros"><strong>No hay movimientos con esos filtros.</strong></p>
        <template v-else>
          <p><strong>Aún no tienes movimientos.</strong></p>
          <p>Cuando cobres un salario o un bonus, aparecerá aquí.</p>
        </template>
      </div>

      <template v-else>
        <div class="tabla-caja" :aria-busy="cargando">
          <table class="tabla">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Tipo</th>
                <th scope="col">Concepto</th>
                <th scope="col" class="num">Monto</th>
                <th scope="col" class="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in estado.movimientos" :key="m.id">
                <td class="nowrap">
                  {{ fecha(m.fecha) }}
                  <small class="hora">{{ hora(m.fecha) }}</small>
                </td>
                <td>
                  <span class="tipo" :class="m.tipo.toLowerCase()">{{ NOMBRE_TIPO[m.tipo] }}</span>
                </td>
                <td class="concepto">{{ m.concepto }}</td>
                <td class="num fuerte" :class="Number(m.monto) < 0 ? 'negativo' : 'positivo'">
                  {{ Number(m.monto) < 0 ? '−' : '+' }}{{ dinero(Math.abs(Number(m.monto))) }}
                </td>
                <td class="num saldo-fila" :class="{ negativo: Number(m.saldoDespues) < 0 }">{{ dinero(m.saldoDespues) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <nav class="paginas" aria-label="Páginas del estado de cuenta">
          <span class="pie">
            {{ estado.total }} {{ estado.total === 1 ? 'movimiento' : 'movimientos' }} · página {{ estado.pagina }} de {{ totalPaginas }}
          </span>
          <div v-if="totalPaginas > 1" class="paginas-botones">
            <button type="button" class="btn info chico" :disabled="cargando || pagina <= 1" @click="irPagina(-1)">
              ← Anteriores
            </button>
            <button type="button" class="btn info chico" :disabled="cargando || pagina >= totalPaginas" @click="irPagina(1)">
              Siguientes →
            </button>
          </div>
        </nav>
      </template>
    </template>
  </div>
</template>

<style scoped>
.resumen {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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

.fuerte {
  font-weight: 700;
}

.filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
}

.nowrap {
  white-space: nowrap;
}

.hora {
  display: block;
  color: var(--color-texto-suave);
}

.concepto {
  min-width: 180px;
  overflow-wrap: anywhere;
}

.saldo-fila {
  font-variant-numeric: tabular-nums;
  color: var(--color-azul-2);
}

.saldo-fila.negativo {
  color: var(--peligro-texto);
}

.tipo {
  display: inline-block;
  padding: 2px 10px;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
  border-radius: 999px;
}

.tipo.salario,
.tipo.transferencia {
  color: var(--info-texto);
  background: var(--info-fondo);
}

.tipo.bonus,
.tipo.prestamo {
  color: var(--ok-texto);
  background: var(--ok-fondo);
}

.tipo.fine {
  color: var(--peligro-texto);
  background: var(--peligro-fondo);
}

.tipo.compra {
  color: var(--aviso-texto);
  background: var(--aviso-fondo);
}

.paginas {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.pie {
  font-size: 0.85rem;
  color: var(--color-texto-suave);
}

.paginas-botones {
  display: flex;
  gap: 8px;
}

@media (max-width: 700px) {
  .resumen {
    grid-template-columns: 1fr;
  }

  .filtros .campo,
  .filtros .btn {
    flex: 1 1 100%;
  }
}
</style>
