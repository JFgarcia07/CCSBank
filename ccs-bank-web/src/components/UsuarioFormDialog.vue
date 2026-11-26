<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'
import Alerta from '@/components/Alerta.vue'
import type { Grado } from '@/types/grado'
import type { DatosAlumno, DatosDocente, DatosEdicion, UsuarioListado } from '@/types/usuario'

const abierto = defineModel<boolean>({ required: true })

const props = defineProps<{
  tipo: 'docente' | 'alumno' | 'admin'
  /** null = crear una cuenta nueva. */
  usuario: UsuarioListado | null
  grados: Grado[]
  cargando: boolean
  error: string
}>()

const emit = defineEmits<{
  guardar: [datos: DatosDocente | DatosAlumno | DatosEdicion]
}>()

const idTitulo = useId()
const dialogo = ref<HTMLDialogElement | null>(null)
const verPassword = ref(false)

const form = reactive({ nombre: '', apellidos: '', email: '', username: '', password: '', gradoId: '', activo: true })
const editando = computed(() => !!props.usuario)
const errores = reactive<Record<string, string>>({})

// Docentes y administradores comparten el formulario: correo y contraseña.
const esDocente = computed(() => props.tipo !== 'alumno')

watch(abierto, (v) => {
  if (v) {
    const u = props.usuario
    Object.assign(form, {
      nombre: u?.nombre ?? '',
      apellidos: u?.apellidos ?? '',
      email: u?.email ?? u?.carne ?? '',
      username: u?.carne ?? '',
      password: '',
      gradoId: u?.gradoId ?? '',
      activo: u?.activo ?? true,
    })
    for (const k of Object.keys(errores)) delete errores[k]
    verPassword.value = false
    if (!dialogo.value?.open) dialogo.value?.showModal()
  } else if (dialogo.value?.open) {
    dialogo.value.close()
  }
})

function validar(): boolean {
  for (const k of Object.keys(errores)) delete errores[k]
  if (!form.nombre.trim()) errores.nombre = 'Ingresa el nombre.'
  if (!form.apellidos.trim()) errores.apellidos = 'Ingresa los apellidos.'
  if (esDocente.value) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errores.email = 'Ingresa un correo válido.'
  } else if (!/^[a-zA-Z0-9._-]{3,30}$/.test(form.username.trim())) {
    errores.username = 'De 3 a 30 caracteres: letras, números, punto, guion o guion bajo.'
  }
  if ((!editando.value || form.password) && form.password.length < 8) errores.password = 'La contraseña debe tener al menos 8 caracteres.'
  return !Object.keys(errores).length
}

function enviar() {
  if (!validar()) return
  if (editando.value) {
    emit('guardar', {
      nombre: form.nombre.trim(),
      apellidos: form.apellidos.trim(),
      activo: form.activo,
      ...(esDocente.value ? { email: form.email.trim() } : { username: form.username.trim(), gradoId: form.gradoId || null }),
      ...(form.password ? { password: form.password } : {}),
    })
    return
  }
  const base = { nombre: form.nombre.trim(), apellidos: form.apellidos.trim(), password: form.password }
  if (esDocente.value) {
    emit('guardar', { ...base, email: form.email.trim() })
  } else {
    emit('guardar', {
      ...base,
      username: form.username.trim(),
      ...(form.gradoId ? { gradoId: form.gradoId } : {}),
    })
  }
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
      <h2 :id="idTitulo" class="dialogo-titulo">{{ editando ? 'Editar cuenta' : { docente: 'Nuevo docente', alumno: 'Nuevo alumno', admin: 'Nuevo administrador' }[tipo] }}</h2>
      <p class="dialogo-ayuda">
        {{
          editando
            ? 'Cambia los datos de la cuenta. La contraseña solo se modifica si escribes una nueva.'
            : tipo === 'admin'
            ? 'El administrador iniciará sesión con su correo y contraseña y tendrá acceso total.'
            : esDocente
            ? 'El docente iniciará sesión con su correo y contraseña.'
            : 'El alumno iniciará sesión con su nombre de usuario y contraseña.'
        }}
      </p>

      <div class="fila-doble">
        <div class="campo">
          <label :for="id('nombre')" class="etiqueta">Nombre</label>
          <input :id="id('nombre')" v-model="form.nombre" class="entrada" :class="{ 'con-error': errores.nombre }" maxlength="80" autocomplete="off" />
          <p v-if="errores.nombre" class="error" role="alert">{{ errores.nombre }}</p>
        </div>
        <div class="campo">
          <label :for="id('apellidos')" class="etiqueta">Apellidos</label>
          <input :id="id('apellidos')" v-model="form.apellidos" class="entrada" :class="{ 'con-error': errores.apellidos }" maxlength="80" autocomplete="off" />
          <p v-if="errores.apellidos" class="error" role="alert">{{ errores.apellidos }}</p>
        </div>
      </div>

      <div v-if="esDocente" class="campo">
        <label :for="id('email')" class="etiqueta">Correo electrónico</label>
        <input :id="id('email')" v-model="form.email" type="email" class="entrada" :class="{ 'con-error': errores.email }" maxlength="120" placeholder="nombre@calvary.edu.gt" autocomplete="off" />
        <p v-if="errores.email" class="error" role="alert">{{ errores.email }}</p>
      </div>

      <template v-else>
        <div class="campo">
          <label :for="id('username')" class="etiqueta">Nombre de usuario</label>
          <input :id="id('username')" v-model="form.username" class="entrada" :class="{ 'con-error': errores.username }" maxlength="30" placeholder="pedro.perez" autocomplete="off" autocapitalize="none" />
          <p v-if="errores.username" class="error" role="alert">{{ errores.username }}</p>
        </div>
        <div class="campo">
          <label :for="id('grado')" class="etiqueta">Clase</label>
          <select :id="id('grado')" v-model="form.gradoId" class="entrada">
            <option value="">Sin clase</option>
            <option v-for="g in grados" :key="g.id" :value="g.id">{{ g.nombre }}</option>
          </select>
        </div>
      </template>

      <div class="campo">
        <label :for="id('password')" class="etiqueta">{{ editando ? 'Nueva contraseña (opcional)' : 'Contraseña inicial' }}</label>
        <div class="caja">
          <input
            :id="id('password')"
            v-model="form.password"
            :type="verPassword ? 'text' : 'password'"
            class="entrada con-ojo"
            :class="{ 'con-error': errores.password }"
            maxlength="72"
            autocomplete="new-password"
          />
          <button type="button" class="ojo" @click="verPassword = !verPassword">
            {{ verPassword ? 'Ocultar' : 'Ver' }}
          </button>
        </div>
        <p v-if="errores.password" class="error" role="alert">{{ errores.password }}</p>
        <p v-else class="nota">
          {{ editando ? 'Déjala vacía para conservar la actual.' : 'Mínimo 8 caracteres. Compártela con la persona de forma segura.' }}
        </p>
      </div>

      <label v-if="editando" class="check">
        <input v-model="form.activo" type="checkbox" />
        <span>Cuenta activa (si la desactivas, no podrá iniciar sesión)</span>
      </label>

      <Alerta v-if="error" tipo="error">{{ error }}</Alerta>

      <div class="acciones">
        <button type="button" class="btn secundario" :disabled="cargando" @click="abierto = false">Cancelar</button>
        <button type="submit" class="btn primario" :disabled="cargando" :aria-busy="cargando">
          {{ cargando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear cuenta' }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.caja {
  position: relative;
}

.entrada.con-ojo {
  padding-right: 64px;
}

.ojo {
  position: absolute;
  top: 0;
  right: 0;
  height: 42px;
  padding: 0 14px;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-azul-2);
  background: none;
  border: 0;
  cursor: pointer;
}
</style>
