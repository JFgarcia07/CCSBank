<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Alerta from '@/components/Alerta.vue'
import ClaseFormDialog from '@/components/ClaseFormDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { mensajeDeError } from '@/lib/errores'
import { gradosService } from '@/services/grados.service'
import type { Grado, Maestro } from '@/types/grado'

const grados = ref<Grado[]>([])
const maestros = ref<Maestro[]>([])
// Docentes que ya tienen una clase (id → nombre de la clase), sin contar la que se edita.
const ocupados = computed(() => {
  const mapa: Record<string, string> = {}
  for (const g of grados.value) {
    if (g.maestro && g.id !== edicion.value?.id) mapa[g.maestro.id] = g.nombre
  }
  return mapa
})
const cargando = ref(true)
const errorCarga = ref('')
const aviso = ref('')

// Formulario (crear / editar)
const formAbierto = ref(false)
const edicion = ref<Grado | null>(null)
const guardando = ref(false)
const errorForm = ref('')

// Confirmación de eliminación
const aEliminar = ref<Grado | null>(null)
const eliminando = ref(false)
const errorEliminar = ref('')

async function cargar() {
  cargando.value = true
  errorCarga.value = ''
  try {
    ;[grados.value, maestros.value] = await Promise.all([
      gradosService.listar(),
      gradosService.listarMaestros(),
    ])
  } catch (e) {
    errorCarga.value = mensajeDeError(e, 'No se pudieron cargar las clases.')
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)

function nueva() {
  edicion.value = null
  errorForm.value = ''
  formAbierto.value = true
}

function editar(g: Grado) {
  edicion.value = g
  errorForm.value = ''
  formAbierto.value = true
}

// Si el docente venía de otra clase, esa clase queda sin docente.
const quitarDeOtras = (maestroId: string | undefined, gradoId: string): Grado[] =>
  grados.value.map((g) => (maestroId && g.id !== gradoId && g.maestro?.id === maestroId ? { ...g, maestro: null } : g))

const ordenar = (lista: Grado[]) => [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

async function guardar(datos: { nombre: string; maestroId: string | null }) {
  guardando.value = true
  errorForm.value = ''
  try {
    const actual = edicion.value
    // Una sola petición; la lista se actualiza en memoria, sin volver a pedirla.
    if (!actual) {
      const nueva = await gradosService.crear(datos.nombre, datos.maestroId)
      grados.value = ordenar([...quitarDeOtras(nueva.maestro?.id, nueva.id), nueva])
      aviso.value = `Clase "${datos.nombre}" creada.`
    } else {
      const editada = await gradosService.actualizar(actual.id, datos)
      grados.value = ordenar(
        quitarDeOtras(editada.maestro?.id, editada.id).map((g) => (g.id === editada.id ? editada : g)),
      )
      aviso.value = `Clase "${datos.nombre}" actualizada.`
    }
    formAbierto.value = false
  } catch (e) {
    errorForm.value = mensajeDeError(e)
  } finally {
    guardando.value = false
  }
}

function pedirEliminar(g: Grado) {
  aEliminar.value = g
  errorEliminar.value = ''
}

async function confirmarEliminar() {
  const g = aEliminar.value
  if (!g) return
  eliminando.value = true
  errorEliminar.value = ''
  try {
    await gradosService.eliminar(g.id)
    aviso.value = `Clase "${g.nombre}" eliminada.`
    grados.value = grados.value.filter((x) => x.id !== g.id)
    aEliminar.value = null
  } catch (e) {
    errorEliminar.value = mensajeDeError(e)
  } finally {
    eliminando.value = false
  }
}
</script>

<template>
  <div class="pagina">
    <header class="cabecera">
      <div>
        <h1 class="titulo">Clases</h1>
        <p class="sub">Crea las clases y asigna el docente de cada una.</p>
      </div>
      <button type="button" class="btn primario" @click="nueva">
        <svg viewBox="0 0 24 24" class="icono" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        Nueva clase
      </button>
    </header>

    <Alerta v-if="aviso" tipo="ok">{{ aviso }}</Alerta>

    <p v-if="cargando" class="estado" role="status">Cargando clases…</p>

    <div v-else-if="errorCarga" class="estado error" role="alert">
      <p>{{ errorCarga }}</p>
      <button type="button" class="btn secundario" @click="cargar">Reintentar</button>
    </div>

    <div v-else-if="!grados.length" class="estado">
      <p><strong>Aún no hay clases.</strong></p>
      <p>Crea la primera para empezar a asignar su docente y sus alumnos.</p>
      <button type="button" class="btn primario" @click="nueva">Nueva clase</button>
    </div>

    <ul v-else class="lista">
      <li v-for="g in grados" :key="g.id" class="tarjeta">
        <div class="tarjeta-cab">
          <h2 class="tarjeta-titulo">{{ g.nombre }}</h2>
          <span class="chip neutro">{{ g.totalAlumnos }} {{ g.totalAlumnos === 1 ? 'alumno' : 'alumnos' }}</span>
        </div>

        <div class="docentes">
          <p class="docentes-titulo">Docente</p>
          <p v-if="g.maestro" class="docente">
            {{ g.maestro.nombre }} {{ g.maestro.apellidos }}
            <span v-if="!g.maestro.activo" class="inactivo">(inactivo)</span>
          </p>
          <p v-else class="sin-docente">Sin docente asignado</p>
        </div>

        <div class="tarjeta-acciones">
          <button type="button" class="btn secundario chico" @click="editar(g)">
            Editar<span class="solo-lector"> {{ g.nombre }}</span>
          </button>
          <button type="button" class="btn peligro chico" @click="pedirEliminar(g)">
            Eliminar<span class="solo-lector"> {{ g.nombre }}</span>
          </button>
        </div>
      </li>
    </ul>

    <ClaseFormDialog
      v-model="formAbierto"
      :grado="edicion"
      :maestros="maestros"
      :ocupados="ocupados"
      :cargando="guardando"
      :error="errorForm"
      @guardar="guardar"
    />

    <ConfirmDialog
      :model-value="!!aEliminar"
      titulo="¿Eliminar esta clase?"
      boton="Sí, eliminar clase"
      cancelar="No, conservarla"
      :ejecutando="eliminando"
      :deshabilitado="(aEliminar?.totalAlumnos ?? 0) > 0"
      :error="errorEliminar"
      @update:model-value="(v) => !v && (aEliminar = null)"
      @confirmar="confirmarEliminar"
    >
      <p>
        Se eliminará la clase <strong>{{ aEliminar?.nombre }}</strong> y su docente quedará libre para otra clase.
        Esta acción no se puede deshacer.
      </p>
      <Alerta v-if="aEliminar && aEliminar.totalAlumnos > 0" tipo="aviso">
        No se puede eliminar todavía: la clase tiene {{ aEliminar.totalAlumnos }}
        {{ aEliminar.totalAlumnos === 1 ? 'alumno' : 'alumnos' }}. Primero cámbialos de clase desde Cuentas.
      </Alerta>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.docentes {
  flex: 1;
}

.docentes-titulo {
  margin: 0 0 4px;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-texto-suave);
}

.docente {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
}

.inactivo,
.sin-docente {
  color: var(--color-texto-suave);
}

.sin-docente {
  margin: 0;
  font-size: 0.9rem;
  font-style: italic;
}
</style>
