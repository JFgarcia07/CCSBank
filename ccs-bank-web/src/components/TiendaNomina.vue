<script setup lang="ts">
import { ref, watch } from 'vue'
import Alerta from '@/components/Alerta.vue'
import CobroTarjeta from '@/components/CobroTarjeta.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ProductoFormDialog from '@/components/ProductoFormDialog.vue'
import { mensajeDeError } from '@/lib/errores'
import { tiendaService } from '@/services/tienda.service'
import type { DatosProducto, GestionTienda, Producto } from '@/types/tienda'

const props = defineProps<{ claseId: string }>()

const datos = ref<GestionTienda | null>(null)
const cargando = ref(true)
const errorCarga = ref('')
const aviso = ref('')
const errorAccion = ref('')

const formAbierto = ref(false)
const editando = ref<Producto | null>(null)
const guardando = ref(false)
const errorForm = ref('')

const borrarAbierto = ref(false)
const porBorrar = ref<Producto | null>(null)
const borrando = ref(false)
const errorBorrar = ref('')

/** id de la compra o del producto con una acción en curso. */
const procesando = ref<string | null>(null)

const dinero = (v: string | number) =>
  `CCS$ ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })

async function cargar() {
  const id = props.claseId
  cargando.value = true
  errorCarga.value = ''
  try {
    const d = await tiendaService.gestion(id)
    if (id === props.claseId) datos.value = d
  } catch (e) {
    errorCarga.value = mensajeDeError(e, 'No se pudo cargar la tienda.')
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

function nuevo() {
  editando.value = null
  errorForm.value = ''
  formAbierto.value = true
}

function editar(p: Producto) {
  editando.value = p
  errorForm.value = ''
  formAbierto.value = true
}

async function guardar(d: DatosProducto) {
  guardando.value = true
  errorForm.value = ''
  try {
    if (editando.value) {
      await tiendaService.actualizarProducto(editando.value.id, d)
      aviso.value = 'Producto actualizado.'
    } else {
      await tiendaService.crearProducto(props.claseId, d)
      aviso.value = 'Producto creado.'
    }
    formAbierto.value = false
    datos.value = await tiendaService.gestion(props.claseId)
  } catch (e) {
    errorForm.value = mensajeDeError(e)
  } finally {
    guardando.value = false
  }
}

async function alternarActivo(p: Producto) {
  procesando.value = p.id
  errorAccion.value = ''
  aviso.value = ''
  try {
    await tiendaService.actualizarProducto(p.id, { activo: !p.activo })
    datos.value = await tiendaService.gestion(props.claseId)
  } catch (e) {
    errorAccion.value = mensajeDeError(e)
  } finally {
    procesando.value = null
  }
}

function pedirBorrar(p: Producto) {
  porBorrar.value = p
  errorBorrar.value = ''
  borrarAbierto.value = true
}

async function borrar() {
  if (!porBorrar.value) return
  borrando.value = true
  errorBorrar.value = ''
  try {
    await tiendaService.eliminarProducto(porBorrar.value.id)
    borrarAbierto.value = false
    aviso.value = 'Producto eliminado.'
    datos.value = await tiendaService.gestion(props.claseId)
  } catch (e) {
    errorBorrar.value = mensajeDeError(e)
  } finally {
    borrando.value = false
  }
}

async function entrega(id: string, entregada: boolean) {
  procesando.value = id
  errorAccion.value = ''
  aviso.value = ''
  try {
    await tiendaService.marcarEntrega(id, entregada)
    datos.value = await tiendaService.gestion(props.claseId)
  } catch (e) {
    errorAccion.value = mensajeDeError(e)
  } finally {
    procesando.value = null
  }
}
</script>

<template>
  <p v-if="cargando && !datos" class="estado" role="status">Cargando la tienda…</p>

  <div v-else-if="errorCarga" class="estado error" role="alert">
    <p>{{ errorCarga }}</p>
    <button type="button" class="btn secundario" @click="cargar">Reintentar</button>
  </div>

  <div v-else-if="datos" class="tienda-nomina">
    <Alerta v-if="aviso" tipo="ok">{{ aviso }}</Alerta>
    <Alerta v-if="errorAccion" tipo="error">{{ errorAccion }}</Alerta>

    <CobroTarjeta
      :clase-id="claseId"
      :productos="datos.productos"
      @cobrado="tiendaService.gestion(claseId).then((d) => (datos = d))"
    />

    <section class="panel" aria-labelledby="prods">
      <div class="panel-cab">
        <div>
          <h2 id="prods" class="panel-titulo">Productos</h2>
          <p class="nota">Los alumnos de esta clase compran con su saldo. Nunca quedan en deuda por una compra.</p>
        </div>
        <button type="button" class="btn primario" @click="nuevo">Nuevo producto</button>
      </div>

      <p v-if="!datos.productos.length" class="vacio">Aún no hay productos. Crea el primero.</p>

      <ul v-else class="lista">
        <li v-for="p in datos.productos" :key="p.id" class="fila">
          <div class="fila-info">
            <strong>{{ p.nombre }}</strong>
            <small>
              {{ dinero(p.precio) }} · {{ p.stock === 1 ? '1 disponible' : `${p.stock} disponibles` }}
              <template v-if="p.descripcion"> · {{ p.descripcion }}</template>
            </small>
            <span v-if="!p.activo" class="chip">Oculto</span>
            <span v-else-if="p.stock === 0" class="chip">Agotado</span>
          </div>
          <div class="fila-acciones">
            <button type="button" class="btn secundario chico" @click="editar(p)">Editar</button>
            <button
              type="button"
              class="btn secundario chico"
              :disabled="procesando === p.id"
              @click="alternarActivo(p)"
            >
              {{ p.activo ? 'Ocultar' : 'Mostrar' }}
            </button>
            <button type="button" class="btn peligro chico" @click="pedirBorrar(p)">Eliminar</button>
          </div>
        </li>
      </ul>
    </section>

    <section class="panel" aria-labelledby="comp">
      <h2 id="comp" class="panel-titulo">Compras recientes</h2>
      <p v-if="!datos.compras.length" class="vacio">Todavía no hay compras.</p>
      <ul v-else class="lista">
        <li v-for="c in datos.compras" :key="c.id" class="fila">
          <div class="fila-info">
            <strong>{{ c.alumno }}</strong>
            <span>{{ c.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(', ') }}</span>
            <small>{{ fecha(c.fecha) }} · {{ dinero(c.total) }}</small>
          </div>
          <div class="fila-acciones">
            <span class="chip" :class="c.entregadaEn ? 'neutro' : ''">
              {{ c.entregadaEn ? 'Entregado' : 'Por entregar' }}
            </span>
            <button
              type="button"
              class="btn chico"
              :class="c.entregadaEn ? 'secundario' : 'primario'"
              :disabled="procesando === c.id"
              @click="entrega(c.id, !c.entregadaEn)"
            >
              {{ c.entregadaEn ? 'Deshacer' : 'Marcar entregado' }}
            </button>
          </div>
        </li>
      </ul>
    </section>

    <ProductoFormDialog
      v-model="formAbierto"
      :producto="editando"
      :cargando="guardando"
      :error="errorForm"
      @guardar="guardar"
    />

    <ConfirmDialog
      v-model="borrarAbierto"
      titulo="¿Eliminar este producto?"
      boton="Eliminar producto"
      :ejecutando="borrando"
      :error="errorBorrar"
      @confirmar="borrar"
    >
      <p>
        Se eliminará <strong>{{ porBorrar?.nombre }}</strong> de la tienda. Si ya se compró alguna vez, no se podrá
        eliminar: ocúltalo en su lugar.
      </p>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.tienda-nomina {
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
  overflow-wrap: anywhere;
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
