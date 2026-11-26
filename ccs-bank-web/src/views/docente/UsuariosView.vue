<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Alerta from '@/components/Alerta.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import UsuarioFormDialog from '@/components/UsuarioFormDialog.vue'
import { mensajeDeError } from '@/lib/errores'
import { gradosService } from '@/services/grados.service'
import { usuariosService } from '@/services/usuarios.service'
import type { Grado } from '@/types/grado'
import type { DatosAlumno, DatosDocente, DatosEdicion, UsuarioListado } from '@/types/usuario'

type Tipo = 'docente' | 'alumno' | 'admin'

const NUEVO: Record<Tipo, string> = {
  docente: 'Nuevo docente',
  alumno: 'Nuevo alumno',
  admin: 'Nuevo administrador',
}
const PLURAL: Record<Tipo, string> = { docente: 'docentes', alumno: 'alumnos', admin: 'administradores' }

const tipo = ref<Tipo>('docente')
const docentes = ref<UsuarioListado[]>([])
const alumnos = ref<UsuarioListado[]>([])
const admins = ref<UsuarioListado[]>([])
const grados = ref<Grado[]>([])
const cargando = ref(true)
const errorCarga = ref('')
const aviso = ref('')

const edicion = ref<UsuarioListado | null>(null)
const formAbierto = ref(false)
const guardando = ref(false)
const errorForm = ref('')

const lista = computed(() => ({ docente: docentes.value, alumno: alumnos.value, admin: admins.value })[tipo.value])

async function cargar() {
  cargando.value = true
  errorCarga.value = ''
  try {
    ;[docentes.value, alumnos.value, admins.value, grados.value] = await Promise.all([
      usuariosService.listarDocentes(),
      usuariosService.listarAlumnos(),
      usuariosService.listarAdmins(),
      gradosService.listar(),
    ])
  } catch (e) {
    errorCarga.value = mensajeDeError(e, 'No se pudieron cargar las cuentas.')
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)

function nuevo() {
  edicion.value = null
  errorForm.value = ''
  formAbierto.value = true
}

function editar(u: UsuarioListado) {
  edicion.value = u
  errorForm.value = ''
  formAbierto.value = true
}

async function recargarLista(t: Tipo) {
  // Solo se vuelve a pedir la lista afectada.
  if (t === 'docente') docentes.value = await usuariosService.listarDocentes()
  else if (t === 'admin') admins.value = await usuariosService.listarAdmins()
  else alumnos.value = await usuariosService.listarAlumnos()
}

async function guardar(datos: DatosDocente | DatosAlumno | DatosEdicion) {
  guardando.value = true
  errorForm.value = ''
  try {
    const actual = edicion.value
    if (actual) {
      const editado = await usuariosService.actualizar(actual.id, datos as DatosEdicion)
      aviso.value = `Cuenta de ${editado.nombre} ${editado.apellidos} actualizada.`
    } else {
      const creado =
        tipo.value === 'docente'
          ? await usuariosService.crearDocente(datos as DatosDocente)
          : tipo.value === 'admin'
            ? await usuariosService.crearAdmin(datos as DatosDocente)
            : await usuariosService.crearAlumno(datos as DatosAlumno)
      aviso.value = `Cuenta de ${creado.nombre} ${creado.apellidos} creada (${creado.carne}).`
    }
    formAbierto.value = false
    await recargarLista(tipo.value)
  } catch (e) {
    errorForm.value = mensajeDeError(e)
  } finally {
    guardando.value = false
  }
}

// Confirmación de eliminación
const aEliminar = ref<UsuarioListado | null>(null)
const eliminando = ref(false)
const errorEliminar = ref('')

function pedirEliminar(u: UsuarioListado) {
  aEliminar.value = u
  errorEliminar.value = ''
}

async function confirmarEliminar() {
  const u = aEliminar.value
  if (!u) return
  eliminando.value = true
  errorEliminar.value = ''
  try {
    await usuariosService.eliminar(u.id)
    aviso.value = `Cuenta de ${u.nombre} ${u.apellidos} eliminada.`
    aEliminar.value = null
    await recargarLista(tipo.value)
  } catch (e) {
    errorEliminar.value = mensajeDeError(e)
  } finally {
    eliminando.value = false
  }
}

function cambiar(t: Tipo) {
  tipo.value = t
  aviso.value = ''
}
</script>

<template>
  <div class="pagina">
    <header class="cabecera">
      <div>
        <h1 class="titulo">Cuentas</h1>
        <p class="sub">Crea cuentas de docentes y administradores (correo) y de alumnos (usuario).</p>
      </div>
      <button type="button" class="btn primario" @click="nuevo">
        <svg viewBox="0 0 24 24" class="icono" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        {{ NUEVO[tipo] }}
      </button>
    </header>

    <div class="pestanas" role="tablist" aria-label="Tipo de cuenta">
      <button
        type="button"
        role="tab"
        class="pestana"
        :aria-selected="tipo === 'docente'"
        :class="{ activa: tipo === 'docente' }"
        @click="cambiar('docente')"
      >
        Docentes <span class="cuenta">{{ docentes.length }}</span>
      </button>
      <button
        type="button"
        role="tab"
        class="pestana"
        :aria-selected="tipo === 'alumno'"
        :class="{ activa: tipo === 'alumno' }"
        @click="cambiar('alumno')"
      >
        Alumnos <span class="cuenta">{{ alumnos.length }}</span>
      </button>
      <button
        type="button"
        role="tab"
        class="pestana"
        :aria-selected="tipo === 'admin'"
        :class="{ activa: tipo === 'admin' }"
        @click="cambiar('admin')"
      >
        Administradores <span class="cuenta">{{ admins.length }}</span>
      </button>
    </div>

    <Alerta v-if="aviso" tipo="ok">{{ aviso }}</Alerta>
    <p v-if="cargando" class="estado" role="status">Cargando cuentas…</p>

    <div v-else-if="errorCarga" class="estado error" role="alert">
      <p>{{ errorCarga }}</p>
      <button type="button" class="btn secundario" @click="cargar">Reintentar</button>
    </div>

    <div v-else-if="!lista.length" class="estado">
      <p>
        <strong>Aún no hay {{ PLURAL[tipo] }}.</strong>
      </p>
      <button type="button" class="btn primario" @click="nuevo">
        {{ NUEVO[tipo] }}
      </button>
    </div>

    <div v-else class="tabla-caja">
      <table class="tabla">
        <thead>
          <tr>
            <th scope="col">Nombre</th>
            <th scope="col">{{ tipo === 'alumno' ? 'Usuario' : 'Correo' }}</th>
            <th v-if="tipo === 'alumno'" scope="col">Clase</th>
            <th scope="col">Estado</th>
            <th scope="col"><span class="solo-lector">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in lista" :key="u.id">
            <td>{{ u.nombre }} {{ u.apellidos }}</td>
            <td>{{ tipo === 'alumno' ? u.carne : (u.email ?? u.carne) }}</td>
            <td v-if="tipo === 'alumno'">{{ u.grado?.nombre ?? '—' }}</td>
            <td>
              <span class="chip" :class="{ inactivo: !u.activo }">{{ u.activo ? 'Activo' : 'Inactivo' }}</span>
            </td>
            <td class="celda-acciones">
              <button type="button" class="btn secundario chico" @click="editar(u)">
                Editar<span class="solo-lector"> {{ u.nombre }} {{ u.apellidos }}</span>
              </button>
              <button type="button" class="btn peligro chico" @click="pedirEliminar(u)">
                Eliminar<span class="solo-lector"> {{ u.nombre }} {{ u.apellidos }}</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UsuarioFormDialog
      v-model="formAbierto"
      :tipo="tipo"
      :usuario="edicion"
      :grados="grados"
      :cargando="guardando"
      :error="errorForm"
      @guardar="guardar"
    />

    <ConfirmDialog
      :model-value="!!aEliminar"
      titulo="¿Eliminar esta cuenta?"
      boton="Sí, eliminar cuenta"
      cancelar="No, conservarla"
      :ejecutando="eliminando"
      :error="errorEliminar"
      @update:model-value="(v) => !v && (aEliminar = null)"
      @confirmar="confirmarEliminar"
    >
      <p>
        Se eliminará la cuenta de <strong>{{ aEliminar?.nombre }} {{ aEliminar?.apellidos }}</strong>
        ({{ aEliminar?.carne }}). Esta acción no se puede deshacer.
      </p>
      <Alerta tipo="info">
        Si la persona ya tiene movimientos o registros, no se podrá eliminar. En ese caso usa Editar y
        desmarca "Cuenta activa": no podrá iniciar sesión, pero su historial se conserva.
      </Alerta>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.celda-acciones {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
