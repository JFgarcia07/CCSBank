<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import Alerta from '@/components/Alerta.vue'
import type { Grado, Maestro } from '@/types/grado'

const abierto = defineModel<boolean>({ required: true })

const props = defineProps<{
  /** null = crear una clase nueva. */
  grado: Grado | null
  maestros: Maestro[]
  /** Docentes que hoy están en otra clase: id → nombre de esa clase. */
  ocupados: Record<string, string>
  cargando: boolean
  error: string
}>()

const emit = defineEmits<{
  guardar: [datos: { nombre: string; maestroId: string | null }]
}>()

const idTitulo = useId()
const idNombre = useId()
const dialogo = ref<HTMLDialogElement | null>(null)
const nombre = ref('')
const maestroId = ref('')
const errorNombre = ref('')

// Docente elegido que hoy está en otra clase (se moverá).
const movido = computed(() => {
  const m = lista.value.find((x) => x.id === maestroId.value)
  return m && props.ocupados[m.id] ? m : null
})

// Docentes disponibles + el actual si ya no está activo (para que se vea y se pueda cambiar).
const lista = computed(() => {
  const actual = props.grado?.maestro
  return actual && !props.maestros.some((m) => m.id === actual.id) ? [...props.maestros, actual] : props.maestros
})

watch(abierto, (v) => {
  if (v) {
    nombre.value = props.grado?.nombre ?? ''
    maestroId.value = props.grado?.maestro?.id ?? ''
    errorNombre.value = ''
    if (!dialogo.value?.open) dialogo.value?.showModal()
  } else if (dialogo.value?.open) {
    dialogo.value.close()
  }
})

function enviar() {
  const limpio = nombre.value.trim()
  if (!limpio) {
    errorNombre.value = 'Ingresa el nombre de la clase.'
    return
  }
  errorNombre.value = ''
  emit('guardar', { nombre: limpio, maestroId: maestroId.value || null })
}
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
      <h2 :id="idTitulo" class="dialogo-titulo">{{ grado ? 'Editar clase' : 'Nueva clase' }}</h2>

      <div class="campo">
        <label :for="idNombre" class="etiqueta">Nombre de la clase</label>
        <input
          :id="idNombre"
          v-model="nombre"
          class="entrada"
          :class="{ 'con-error': !!errorNombre }"
          type="text"
          maxlength="80"
          placeholder="Ej. 6to Primaria A"
          autocomplete="off"
          :aria-invalid="!!errorNombre"
          :aria-describedby="errorNombre ? `${idNombre}-error` : undefined"
        />
        <p v-if="errorNombre" :id="`${idNombre}-error`" class="error" role="alert">{{ errorNombre }}</p>
      </div>

      <fieldset class="docentes">
        <legend class="etiqueta">Docente</legend>
        <p v-if="!lista.length" class="nota">
          Aún no hay docentes registrados. Podrás asignarlo cuando existan cuentas con rol Maestro.
        </p>
        <ul v-else class="opciones">
          <li v-for="m in lista" :key="m.id">
            <label class="opcion">
              <input
                type="checkbox"
                :checked="maestroId === m.id"
                @change="maestroId = ($event.target as HTMLInputElement).checked ? m.id : ''"
              />
              <span>
                {{ m.nombre }} {{ m.apellidos }}
                <small>
                  {{ m.carne }}<template v-if="!m.activo"> · inactivo</template>
                  <template v-if="ocupados[m.id]"> · hoy en "{{ ocupados[m.id] }}"</template>
                </small>
              </span>
            </label>
          </li>
        </ul>
        <Alerta v-if="movido" tipo="aviso" class="mov">
          <strong>{{ movido.nombre }} {{ movido.apellidos }}</strong> ya tiene la clase "{{ ocupados[movido.id] }}".
          Si guardas, dejará esa clase (que quedará sin docente) y pasará a esta.
        </Alerta>
        <p class="nota">Cada clase tiene un solo docente y cada docente, una sola clase. Si eliges uno que ya tiene clase, se mueve a esta.</p>
      </fieldset>

      <Alerta v-if="error" tipo="error">{{ error }}</Alerta>

      <div class="acciones">
        <button type="button" class="btn secundario" :disabled="cargando" @click="abierto = false">
          Cancelar
        </button>
        <button type="submit" class="btn primario" :disabled="cargando" :aria-busy="cargando">
          {{ cargando ? 'Guardando…' : grado ? 'Guardar cambios' : 'Crear clase' }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.docentes {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.docentes legend {
  padding: 0;
  margin-bottom: 8px;
}

.opciones {
  max-height: 240px;
  margin: 0 0 8px;
  padding: 4px;
  overflow-y: auto;
  list-style: none;
  border: 1px solid var(--color-borde-fuerte);
  border-radius: var(--radio-sm);
}

.opcion {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  font-size: 0.92rem;
  border-radius: 6px;
  cursor: pointer;
}

.opcion:hover {
  background: var(--color-fondo);
}

.opcion small {
  display: block;
  color: var(--color-texto-suave);
}

.mov {
  margin-bottom: 8px;
}
</style>
