<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'
import Alerta from '@/components/Alerta.vue'
import type { DatosTrabajo, TrabajoAula } from '@/types/aula'

const abierto = defineModel<boolean>({ required: true })

const props = defineProps<{
  /** null = crear un trabajo nuevo. */
  trabajo: TrabajoAula | null
  cargando: boolean
  error: string
}>()

const emit = defineEmits<{
  guardar: [datos: DatosTrabajo]
}>()

const idTitulo = useId()
const dialogo = ref<HTMLDialogElement | null>(null)
const form = reactive({ nombre: '', descripcion: '', salario: '', activo: true })
const errores = reactive<Record<string, string>>({})
const editando = computed(() => !!props.trabajo)

watch(abierto, (v) => {
  if (v) {
    const t = props.trabajo
    Object.assign(form, {
      nombre: t?.nombre ?? '',
      descripcion: t?.descripcion ?? '',
      salario: t ? String(Number(t.salarioSemanal)) : '',
      activo: t?.activo ?? true,
    })
    for (const k of Object.keys(errores)) delete errores[k]
    if (!dialogo.value?.open) dialogo.value?.showModal()
  } else if (dialogo.value?.open) {
    dialogo.value.close()
  }
})

function enviar() {
  for (const k of Object.keys(errores)) delete errores[k]
  const salario = Number(form.salario.replace(',', '.'))
  if (!form.nombre.trim()) errores.nombre = 'Ingresa el nombre del trabajo.'
  if (form.salario.trim() === '' || !Number.isFinite(salario) || salario < 0) {
    errores.salario = 'Ingresa un salario válido (0 o más).'
  } else if (Math.round(salario * 100) / 100 !== salario) {
    errores.salario = 'Máximo 2 decimales.'
  }
  if (Object.keys(errores).length) return

  emit('guardar', {
    nombre: form.nombre.trim(),
    descripcion: form.descripcion.trim(),
    salarioSemanal: salario,
    ...(editando.value ? { activo: form.activo } : {}),
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
      <h2 :id="idTitulo" class="dialogo-titulo">{{ editando ? 'Editar trabajo' : 'Nuevo trabajo' }}</h2>

      <div class="campo">
        <label :for="id('nombre')" class="etiqueta">Nombre del trabajo</label>
        <input
          :id="id('nombre')"
          v-model="form.nombre"
          class="entrada"
          :class="{ 'con-error': errores.nombre }"
          maxlength="100"
          placeholder="Ej. Secretario(a) (Gestor de Agenda)"
          autocomplete="off"
        />
        <p v-if="errores.nombre" class="error" role="alert">{{ errores.nombre }}</p>
      </div>

      <div class="campo">
        <label :for="id('desc')" class="etiqueta">Responsabilidades</label>
        <textarea
          :id="id('desc')"
          v-model="form.descripcion"
          class="entrada area"
          maxlength="1500"
          rows="5"
          placeholder="Una responsabilidad por línea (opcional)"
        />
      </div>

      <div class="campo">
        <label :for="id('salario')" class="etiqueta">Salario semanal (CCS$)</label>
        <input
          :id="id('salario')"
          v-model="form.salario"
          class="entrada"
          :class="{ 'con-error': errores.salario }"
          inputmode="decimal"
          placeholder="0.00"
          autocomplete="off"
        />
        <p v-if="errores.salario" class="error" role="alert">{{ errores.salario }}</p>
      </div>

      <label v-if="editando" class="check">
        <input v-model="form.activo" type="checkbox" />
        <span>Trabajo activo (si lo desactivas, queda sin alumno asignado)</span>
      </label>

      <Alerta v-if="error" tipo="error">{{ error }}</Alerta>

      <div class="acciones">
        <button type="button" class="btn secundario" :disabled="cargando" @click="abierto = false">Cancelar</button>
        <button type="submit" class="btn primario" :disabled="cargando" :aria-busy="cargando">
          {{ cargando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear trabajo' }}
        </button>
      </div>
    </form>
  </dialog>
</template>
