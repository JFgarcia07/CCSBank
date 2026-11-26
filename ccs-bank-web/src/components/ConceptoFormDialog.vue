<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'
import Alerta from '@/components/Alerta.vue'
import type { ConceptoNomina, TipoMovimiento } from '@/types/nomina'

const abierto = defineModel<boolean>({ required: true })

const props = defineProps<{
  /** null = crear uno nuevo (del tipo indicado en `tipoNuevo`). */
  concepto: ConceptoNomina | null
  tipoNuevo: TipoMovimiento
  cargando: boolean
  error: string
}>()

const emit = defineEmits<{
  guardar: [datos: { nombre: string; monto: number }]
}>()

const idTitulo = useId()
const dialogo = ref<HTMLDialogElement | null>(null)
const form = reactive({ nombre: '', monto: '' })
const errores = reactive<Record<string, string>>({})
const editando = computed(() => !!props.concepto)
const tipo = computed<TipoMovimiento>(() => props.concepto?.tipo ?? props.tipoNuevo)
const esBonus = computed(() => tipo.value === 'BONUS')

watch(abierto, (v) => {
  if (v) {
    const c = props.concepto
    Object.assign(form, { nombre: c?.nombre ?? '', monto: c ? String(Number(c.monto)) : '' })
    for (const k of Object.keys(errores)) delete errores[k]
    if (!dialogo.value?.open) dialogo.value?.showModal()
  } else if (dialogo.value?.open) {
    dialogo.value.close()
  }
})

function enviar() {
  for (const k of Object.keys(errores)) delete errores[k]
  const monto = Number(form.monto.replace(',', '.'))
  if (!form.nombre.trim()) errores.nombre = 'Escribe el motivo.'
  if (form.monto.trim() === '' || !Number.isFinite(monto) || monto <= 0) {
    errores.monto = 'Ingresa un monto mayor que 0.'
  } else if (Math.round(monto * 100) / 100 !== monto) {
    errores.monto = 'Máximo 2 decimales.'
  }
  if (Object.keys(errores).length) return
  emit('guardar', { nombre: form.nombre.trim(), monto })
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
      <h2 :id="idTitulo" class="dialogo-titulo">
        {{ editando ? (esBonus ? 'Editar bonus' : 'Editar fine') : esBonus ? 'Nuevo bonus' : 'Nuevo fine' }}
      </h2>
      <p class="dialogo-ayuda">
        {{
          esBonus
            ? 'El motivo y el monto quedan guardados: después solo eliges el bonus y a quién dárselo.'
            : 'El motivo y el monto quedan guardados: después solo eliges el fine y a quién aplicárselo.'
        }}
      </p>

      <div class="campo">
        <label :for="id('nombre')" class="etiqueta">Motivo</label>
        <input
          :id="id('nombre')"
          v-model="form.nombre"
          class="entrada"
          :class="{ 'con-error': errores.nombre }"
          maxlength="200"
          :placeholder="esBonus ? 'Ej. Participación destacada' : 'Ej. Llegó tarde'"
          autocomplete="off"
        />
        <p v-if="errores.nombre" class="error" role="alert">{{ errores.nombre }}</p>
      </div>

      <div class="campo">
        <label :for="id('monto')" class="etiqueta">Monto (CCS$, a cada alumno)</label>
        <input
          :id="id('monto')"
          v-model="form.monto"
          class="entrada"
          :class="{ 'con-error': errores.monto }"
          inputmode="decimal"
          placeholder="0.00"
          autocomplete="off"
        />
        <p v-if="errores.monto" class="error" role="alert">{{ errores.monto }}</p>
      </div>

      <Alerta v-if="editando" tipo="info">
        Los cambios solo afectan lo que emitas desde ahora. Lo ya emitido no se modifica.
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
