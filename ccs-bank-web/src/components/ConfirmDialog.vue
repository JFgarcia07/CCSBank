<script setup lang="ts">
import { ref, useId, watch } from 'vue'
import Alerta from '@/components/Alerta.vue'

const abierto = defineModel<boolean>({ required: true })

withDefaults(
  defineProps<{
    titulo: string
    /** Texto del botón que confirma (di claramente qué va a pasar). */
    boton: string
    /** peligro = acción destructiva (rojo); aviso = cambio importante (naranja). */
    tono?: 'peligro' | 'aviso'
    cancelar?: string
    /** Párrafos que explican qué pasará. También se puede usar el slot. */
    lineas?: string[]
    ejecutando?: boolean
    deshabilitado?: boolean
    error?: string
  }>(),
  { tono: 'peligro', cancelar: 'Cancelar', lineas: () => [], ejecutando: false, deshabilitado: false, error: '' },
)

const emit = defineEmits<{
  confirmar: []
  /** Se emite siempre que el diálogo se cierra (confirmado, cancelado o con Esc). */
  cerrado: []
}>()

const idTitulo = useId()
const dialogo = ref<HTMLDialogElement | null>(null)

watch(abierto, (v) => {
  if (v) {
    if (!dialogo.value?.open) dialogo.value?.showModal()
  } else if (dialogo.value?.open) {
    dialogo.value.close()
  }
})

function alCerrar() {
  abierto.value = false
  emit('cerrado')
}
</script>

<template>
  <dialog
    ref="dialogo"
    class="dialogo confirmar"
    :aria-labelledby="idTitulo"
    @close="alCerrar"
    @cancel="ejecutando && $event.preventDefault()"
  >
    <div class="forma">
      <div class="cabecera-conf">
        <span class="medalla" :class="tono" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path
              d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"
            />
          </svg>
        </span>
        <h2 :id="idTitulo" class="dialogo-titulo">{{ titulo }}</h2>
      </div>

      <div class="cuerpo">
        <p v-for="(l, i) in lineas" :key="i" class="linea">{{ l }}</p>
        <slot />
      </div>

      <Alerta v-if="error" tipo="error">{{ error }}</Alerta>

      <div class="acciones">
        <button type="button" class="btn secundario" :disabled="ejecutando" @click="abierto = false">
          {{ cancelar }}
        </button>
        <button
          type="button"
          class="btn"
          :class="tono === 'peligro' ? 'peligro-solido' : 'aviso-solido'"
          :disabled="ejecutando || deshabilitado"
          :aria-busy="ejecutando"
          @click="emit('confirmar')"
        >
          {{ ejecutando ? 'Guardando…' : boton }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.confirmar {
  width: min(460px, calc(100vw - 32px));
}

.cabecera-conf {
  display: flex;
  align-items: center;
  gap: 14px;
}

.medalla {
  display: grid;
  flex: none;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
}

.medalla svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.medalla.peligro {
  color: var(--peligro-texto);
  background: var(--peligro-fondo);
}

.medalla.aviso {
  color: var(--aviso-texto);
  background: var(--aviso-fondo);
}

.cuerpo {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.linea {
  margin: 0;
  font-size: 0.94rem;
  line-height: 1.55;
  color: var(--color-texto);
}

.cuerpo :slotted(p) {
  margin: 0;
  font-size: 0.94rem;
  line-height: 1.55;
}
</style>
