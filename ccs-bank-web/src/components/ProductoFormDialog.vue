<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'
import Alerta from '@/components/Alerta.vue'
import type { DatosProducto, Producto } from '@/types/tienda'

const abierto = defineModel<boolean>({ required: true })

const props = defineProps<{
  /** null = crear uno nuevo. */
  producto: Producto | null
  cargando: boolean
  error: string
}>()

const emit = defineEmits<{ guardar: [datos: DatosProducto] }>()

const idTitulo = useId()
const dialogo = ref<HTMLDialogElement | null>(null)
const form = reactive({ nombre: '', descripcion: '', precio: '', stock: '' })
const errores = reactive<Record<string, string>>({})
const editando = computed(() => !!props.producto)

watch(abierto, (v) => {
  if (v) {
    const p = props.producto
    Object.assign(form, {
      nombre: p?.nombre ?? '',
      descripcion: p?.descripcion ?? '',
      precio: p ? String(Number(p.precio)) : '',
      stock: p ? String(p.stock) : '',
    })
    for (const k of Object.keys(errores)) delete errores[k]
    if (!dialogo.value?.open) dialogo.value?.showModal()
  } else if (dialogo.value?.open) {
    dialogo.value.close()
  }
})

function enviar() {
  for (const k of Object.keys(errores)) delete errores[k]
  const precio = Number(form.precio.replace(',', '.'))
  const stock = Number(form.stock)
  if (!form.nombre.trim()) errores.nombre = 'Escribe el nombre del producto.'
  if (form.precio.trim() === '' || !Number.isFinite(precio) || precio <= 0) {
    errores.precio = 'Ingresa un precio mayor que 0.'
  } else if (Math.round(precio * 100) / 100 !== precio) {
    errores.precio = 'Máximo 2 decimales.'
  }
  if (form.stock.trim() === '' || !Number.isInteger(stock) || stock < 0) {
    errores.stock = 'Ingresa un número entero (0 o más).'
  }
  if (Object.keys(errores).length) return
  emit('guardar', {
    nombre: form.nombre.trim(),
    descripcion: form.descripcion.trim(),
    precio,
    stock,
  })
}

const id = (campo: string) => `${idTitulo}-${campo}`
</script>

<template>
  <dialog
    ref="dialogo"
    class="dialogo"
    :aria-labelledby="idTitulo"
    @close="abierto = false"
    @cancel="cargando && $event.preventDefault()"
  >
    <form class="forma" novalidate @submit.prevent="enviar">
      <h2 :id="idTitulo" class="dialogo-titulo">{{ editando ? 'Editar producto' : 'Nuevo producto' }}</h2>

      <div class="campo">
        <label :for="id('nombre')" class="etiqueta">Nombre</label>
        <input
          :id="id('nombre')"
          v-model="form.nombre"
          class="entrada"
          :class="{ 'con-error': errores.nombre }"
          maxlength="100"
          placeholder="Ej. Lápiz decorado"
          autocomplete="off"
        />
        <p v-if="errores.nombre" class="error" role="alert">{{ errores.nombre }}</p>
      </div>

      <div class="campo">
        <label :for="id('desc')" class="etiqueta">Descripción (opcional)</label>
        <input :id="id('desc')" v-model="form.descripcion" class="entrada" maxlength="300" autocomplete="off" />
      </div>

      <div class="campo">
        <label :for="id('precio')" class="etiqueta">Precio (CCS$)</label>
        <input
          :id="id('precio')"
          v-model="form.precio"
          class="entrada"
          :class="{ 'con-error': errores.precio }"
          inputmode="decimal"
          placeholder="0.00"
          autocomplete="off"
        />
        <p v-if="errores.precio" class="error" role="alert">{{ errores.precio }}</p>
      </div>

      <div class="campo">
        <label :for="id('stock')" class="etiqueta">Cantidad disponible</label>
        <input
          :id="id('stock')"
          v-model="form.stock"
          class="entrada"
          :class="{ 'con-error': errores.stock }"
          inputmode="numeric"
          placeholder="0"
          autocomplete="off"
        />
        <p v-if="errores.stock" class="error" role="alert">{{ errores.stock }}</p>
      </div>

      <Alerta v-if="editando" tipo="info">
        Cambiar el precio no afecta las compras ya hechas.
      </Alerta>
      <Alerta v-if="error" tipo="error">{{ error }}</Alerta>

      <div class="acciones">
        <button type="button" class="btn secundario" :disabled="cargando" @click="abierto = false">Cancelar</button>
        <button type="submit" class="btn primario" :disabled="cargando" :aria-busy="cargando">
          {{ cargando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear' }}
        </button>
      </div>
    </form>
  </dialog>
</template>
