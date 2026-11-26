<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import Alerta from '@/components/Alerta.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { mensajeDeError } from '@/lib/errores'
import { tiendaService } from '@/services/tienda.service'
import type { CatalogoTienda, CompraTienda } from '@/types/tienda'

const catalogo = ref<CatalogoTienda | null>(null)
const compras = ref<CompraTienda[]>([])
const cargando = ref(true)
const errorCarga = ref('')
const aviso = ref('')
const errorCompra = ref('')
const confirmando = ref(false)
const comprando = ref(false)
/** productoId → cantidad elegida. */
const carrito = reactive<Record<string, number>>({})

const dinero = (v: string | number) => {
  const n = Number(v)
  const texto = Math.abs(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${n < 0 ? '−' : ''}CCS$ ${texto}`
}
const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })

const MAX_POR_PRODUCTO = 20

async function cargar() {
  cargando.value = true
  errorCarga.value = ''
  try {
    const [c, m] = await Promise.all([tiendaService.catalogo(), tiendaService.misCompras()])
    catalogo.value = c
    compras.value = m
    // Quita del carrito lo que ya no está o supera el stock.
    for (const id of Object.keys(carrito)) {
      const p = c.productos.find((x) => x.id === id)
      if (!p) delete carrito[id]
      else carrito[id] = Math.min(carrito[id]!, p.stock, MAX_POR_PRODUCTO)
    }
  } catch (e) {
    errorCarga.value = mensajeDeError(e, 'No se pudo cargar la tienda.')
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)

const lineas = computed(() =>
  (catalogo.value?.productos ?? [])
    .filter((p) => (carrito[p.id] ?? 0) > 0)
    .map((p) => ({ p, cantidad: carrito[p.id]!, subtotal: Number(p.precio) * carrito[p.id]! })),
)
const total = computed(() => Math.round(lineas.value.reduce((s, l) => s + l.subtotal, 0) * 100) / 100)
const saldo = computed(() => Number(catalogo.value?.saldo ?? 0))
const faltante = computed(() => Math.round((total.value - saldo.value) * 100) / 100)
const alcanza = computed(() => faltante.value <= 0)

function cambiar(id: string, delta: number, stock: number) {
  const nueva = (carrito[id] ?? 0) + delta
  carrito[id] = Math.max(0, Math.min(nueva, stock, MAX_POR_PRODUCTO))
}

function revisar() {
  errorCompra.value = ''
  aviso.value = ''
  confirmando.value = true
}

async function comprar() {
  comprando.value = true
  errorCompra.value = ''
  try {
    const r = await tiendaService.comprar(lineas.value.map((l) => ({ productoId: l.p.id, cantidad: l.cantidad })))
    confirmando.value = false
    for (const id of Object.keys(carrito)) delete carrito[id]
    aviso.value = `Compra realizada por ${dinero(r.total)}. Tu saldo ahora es ${dinero(r.saldo)}. Tu maestro te entregará el premio.`
    await cargar()
  } catch (e) {
    errorCompra.value = mensajeDeError(e)
  } finally {
    comprando.value = false
  }
}
</script>

<template>
  <div class="pagina">
    <header class="cabecera">
      <div>
        <h1 class="titulo">Tienda</h1>
        <p class="sub">Canjea tu dinero por premios. Tu maestro te los entrega después de comprar.</p>
      </div>
    </header>

    <p v-if="cargando && !catalogo" class="estado" role="status">Cargando la tienda…</p>

    <div v-else-if="errorCarga" class="estado error" role="alert">
      <p>{{ errorCarga }}</p>
      <button type="button" class="btn secundario" @click="cargar">Reintentar</button>
    </div>

    <template v-else-if="catalogo">
      <Alerta v-if="aviso" tipo="ok">{{ aviso }}</Alerta>

      <section class="saldo" aria-label="Saldo">
        <span class="saldo-etiqueta">Tu saldo</span>
        <strong class="saldo-valor">{{ dinero(catalogo.saldo) }}</strong>
        <p v-if="saldo < 0" class="saldo-nota">
          Tienes una deuda, así que no puedes comprar hasta cubrirla. Cobra tus pagos en Cuenta.
        </p>
      </section>

      <div v-if="!catalogo.productos.length" class="estado">
        <p><strong>La tienda está vacía por ahora.</strong></p>
        <p>Tu maestro agregará los premios cuando se acerque el final de la unidad.</p>
      </div>

      <ul v-else class="productos">
        <li v-for="p in catalogo.productos" :key="p.id" class="producto" :class="{ elegido: (carrito[p.id] ?? 0) > 0 }">
          <div class="producto-info">
            <strong>{{ p.nombre }}</strong>
            <p v-if="p.descripcion" class="desc">{{ p.descripcion }}</p>
            <span class="precio">{{ dinero(p.precio) }}</span>
            <small class="stock" :class="{ poco: p.stock <= 3 }">
              {{ p.stock === 1 ? 'Queda 1' : `Quedan ${p.stock}` }}
            </small>
          </div>
          <div class="cantidad" role="group" :aria-label="`Cantidad de ${p.nombre}`">
            <button
              type="button"
              class="btn secundario chico"
              :disabled="(carrito[p.id] ?? 0) === 0"
              :aria-label="`Quitar uno de ${p.nombre}`"
              @click="cambiar(p.id, -1, p.stock)"
            >
              −
            </button>
            <output class="cant-valor" :aria-label="`${carrito[p.id] ?? 0} elegidos`">{{ carrito[p.id] ?? 0 }}</output>
            <button
              type="button"
              class="btn secundario chico"
              :disabled="(carrito[p.id] ?? 0) >= Math.min(p.stock, MAX_POR_PRODUCTO)"
              :aria-label="`Agregar uno de ${p.nombre}`"
              @click="cambiar(p.id, 1, p.stock)"
            >
              +
            </button>
          </div>
        </li>
      </ul>

      <section v-if="lineas.length" class="carrito" aria-labelledby="carro">
        <h2 id="carro" class="panel-titulo">Tu compra</h2>
        <ul class="carrito-lista">
          <li v-for="l in lineas" :key="l.p.id">
            <span>{{ l.cantidad }}× {{ l.p.nombre }}</span>
            <strong>{{ dinero(l.subtotal) }}</strong>
          </li>
        </ul>
        <div class="carrito-total">
          <span>Total</span>
          <strong>{{ dinero(total) }}</strong>
        </div>
        <Alerta v-if="!alcanza" tipo="aviso">
          Te faltan {{ dinero(faltante) }}. Quita algo del carrito o cobra tus pagos pendientes en Cuenta.
        </Alerta>
        <button type="button" class="btn primario" :disabled="!alcanza || saldo < 0" @click="revisar">
          Comprar
        </button>
      </section>

      <section class="panel" aria-labelledby="hist">
        <h2 id="hist" class="panel-titulo">Mis compras</h2>
        <p v-if="!compras.length" class="nota">Aún no has comprado nada.</p>
        <ul v-else class="compras">
          <li v-for="c in compras" :key="c.id" class="compra">
            <div class="compra-info">
              <strong>{{ c.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(', ') }}</strong>
              <small>{{ fecha(c.fecha) }} · {{ dinero(c.total) }}</small>
            </div>
            <span class="chip" :class="c.entregadaEn ? 'neutro' : ''">
              {{ c.entregadaEn ? 'Entregado' : 'Por entregar' }}
            </span>
          </li>
        </ul>
      </section>
    </template>

    <ConfirmDialog
      v-model="confirmando"
      titulo="¿Confirmar la compra?"
      :boton="`Pagar ${dinero(total)}`"
      tono="aviso"
      :ejecutando="comprando"
      :error="errorCompra"
      @confirmar="comprar"
    >
      <ul class="resumen">
        <li v-for="l in lineas" :key="l.p.id">{{ l.cantidad }}× {{ l.p.nombre }} — {{ dinero(l.subtotal) }}</li>
      </ul>
      <p>
        Se descontarán {{ dinero(total) }} de tu saldo y te quedarán
        <strong>{{ dinero(saldo - total) }}</strong
        >. Una compra no se puede deshacer.
      </p>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.saldo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 20px 24px;
  background: #fff;
  border: 1px solid var(--color-borde);
  border-left: 5px solid var(--ok-texto);
  border-radius: var(--radio-md);
  box-shadow: var(--sombra-sm);
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
  font-size: clamp(1.8rem, 5vw, 2.4rem);
  color: var(--color-azul-2);
}

.saldo-nota {
  margin: 0;
  font-size: 0.9rem;
  color: var(--peligro-texto);
}

.productos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.producto {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
  padding: 16px;
  background: #fff;
  border: 1px solid var(--color-borde);
  border-radius: var(--radio-md);
  box-shadow: var(--sombra-sm);
}

.producto.elegido {
  border-color: var(--color-azul-2);
}

.producto-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  overflow-wrap: anywhere;
}

.desc {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-texto-suave);
}

.precio {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--color-azul-2);
}

.stock {
  color: var(--color-texto-suave);
}

.stock.poco {
  color: var(--peligro-texto);
}

.cantidad {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cant-valor {
  min-width: 2ch;
  text-align: center;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.carrito,
.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  margin: 0;
  color: var(--color-texto-suave);
}

.carrito-lista,
.compras,
.resumen {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.carrito-lista li,
.carrito-total {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.carrito-total {
  padding-top: 10px;
  border-top: 1px solid var(--color-borde);
  font-size: 1.05rem;
}

.compra {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
}

.compra + .compra {
  border-top: 1px solid var(--color-borde);
}

.compra-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.compra-info small {
  color: var(--color-texto-suave);
}

@media (max-width: 520px) {
  .carrito .btn {
    width: 100%;
  }
}
</style>
