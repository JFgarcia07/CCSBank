<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import Alerta from '@/components/Alerta.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import SubirPdf from '@/components/SubirPdf.vue'
import { mensajeDeError } from '@/lib/errores'
import { perfilService } from '@/services/perfil.service'
import { useAuthStore } from '@/stores/auth'
import type { Perfil } from '@/types/perfil'

const MAX_MB = 2
const auth = useAuthStore()

const perfil = ref<Perfil | null>(null)
const cargando = ref(true)
const errorCarga = ref('')
const aviso = ref('')
const errorAviso = ref('')

const etiquetaRol = computed(
  () => ({ ALUMNO: 'Alumno', MAESTRO: 'Maestro', ADMIN: 'Administrador' })[perfil.value?.rol ?? 'ALUMNO'],
)
const iniciales = computed(() => {
  const p = perfil.value
  return p ? `${p.nombre.charAt(0)}${p.apellidos.charAt(0)}`.toUpperCase() : ''
})

/** Aplica la respuesta del servidor aquí y en el menú lateral. */
function aplicar(p: Perfil) {
  perfil.value = p
  auth.actualizarPerfil({ nombre: p.nombre, apellidos: p.apellidos, fotoUrl: p.fotoUrl })
}

async function cargar() {
  cargando.value = true
  errorCarga.value = ''
  try {
    const p = await perfilService.obtener()
    aplicar(p)
    form.nombre = p.nombre
    form.apellidos = p.apellidos
  } catch (e) {
    errorCarga.value = mensajeDeError(e, 'No se pudo cargar tu perfil.')
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)

function limpiarAvisos() {
  aviso.value = ''
  errorAviso.value = ''
}

// ───── Datos ─────
const form = reactive({ nombre: '', apellidos: '' })
const errores = reactive<{ nombre?: string; apellidos?: string }>({})
const guardando = ref(false)
const hayCambios = computed(
  () => !!perfil.value && (form.nombre.trim() !== perfil.value.nombre || form.apellidos.trim() !== perfil.value.apellidos),
)

async function guardarDatos() {
  limpiarAvisos()
  errores.nombre = form.nombre.trim() ? undefined : 'Escribe tu nombre.'
  errores.apellidos = form.apellidos.trim() ? undefined : 'Escribe tus apellidos.'
  if (errores.nombre || errores.apellidos) return
  guardando.value = true
  try {
    aplicar(await perfilService.actualizar({ nombre: form.nombre.trim(), apellidos: form.apellidos.trim() }))
    aviso.value = 'Listo: tus datos se guardaron.'
  } catch (e) {
    errorAviso.value = mensajeDeError(e, 'No se pudieron guardar los cambios.')
  } finally {
    guardando.value = false
  }
}

// ───── Foto ─────
const entradaFoto = ref<HTMLInputElement | null>(null)
const subiendoFoto = ref(false)
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp']

async function elegirFoto(e: Event) {
  const el = e.target as HTMLInputElement
  const f = el.files?.[0]
  el.value = ''
  limpiarAvisos()
  if (!f) return
  if (!TIPOS_FOTO.includes(f.type)) {
    errorAviso.value = 'La foto debe ser una imagen JPG, PNG o WEBP.'
    return
  }
  if (f.size > MAX_MB * 1024 * 1024) {
    errorAviso.value = `La foto pesa ${(f.size / 1024 / 1024).toFixed(1)} MB y el máximo es ${MAX_MB} MB.`
    return
  }
  subiendoFoto.value = true
  try {
    aplicar(await perfilService.subirFoto(f))
    aviso.value = 'Listo: tu foto se actualizó.'
  } catch (err) {
    errorAviso.value = mensajeDeError(err, 'No se pudo subir la foto.')
  } finally {
    subiendoFoto.value = false
  }
}

async function quitarFoto() {
  limpiarAvisos()
  subiendoFoto.value = true
  try {
    aplicar(await perfilService.quitarFoto())
    aviso.value = 'Quitaste tu foto.'
  } catch (err) {
    errorAviso.value = mensajeDeError(err, 'No se pudo quitar la foto.')
  } finally {
    subiendoFoto.value = false
  }
}

// ───── CV ─────
const cv = ref<File | null>(null)
const errorCv = ref('')
const subiendoCv = ref(false)

function elegirCv(f: File | null) {
  errorCv.value = ''
  cv.value = null
  if (!f) return
  if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
    errorCv.value = 'El archivo debe ser un PDF.'
  } else if (f.size > MAX_MB * 1024 * 1024) {
    errorCv.value = `Pesa ${(f.size / 1024 / 1024).toFixed(1)} MB y el máximo es ${MAX_MB} MB. Reduce el tamaño del documento.`
  } else {
    cv.value = f
  }
}

async function subirCv() {
  if (!cv.value) {
    errorCv.value = 'Elige el PDF de tu CV.'
    return
  }
  limpiarAvisos()
  subiendoCv.value = true
  try {
    aplicar(await perfilService.subirCv(cv.value))
    cv.value = null
    aviso.value = 'Listo: tu CV se guardó.'
  } catch (e) {
    errorAviso.value = mensajeDeError(e, 'No se pudo subir el CV.')
  } finally {
    subiendoCv.value = false
  }
}

async function verCv() {
  limpiarAvisos()
  // La pestaña se abre antes de pedir la URL para que el navegador no la bloquee.
  const ventana = window.open('about:blank', '_blank')
  try {
    const url = await perfilService.urlDelCv()
    if (ventana) ventana.location.href = url
    else window.location.href = url
  } catch (e) {
    ventana?.close()
    errorAviso.value = mensajeDeError(e, 'No se pudo abrir tu CV.')
  }
}

const quitarCvAbierto = ref(false)
const quitandoCv = ref(false)
const errorQuitarCv = ref('')

async function quitarCv() {
  quitandoCv.value = true
  errorQuitarCv.value = ''
  try {
    aplicar(await perfilService.quitarCv())
    quitarCvAbierto.value = false
    aviso.value = 'Quitaste tu CV.'
  } catch (e) {
    errorQuitarCv.value = mensajeDeError(e)
  } finally {
    quitandoCv.value = false
  }
}
</script>

<template>
  <div class="pagina">
    <header class="cabecera">
      <div>
        <h1 class="titulo">Mi perfil</h1>
        <p class="sub">{{ perfil?.rol === 'ALUMNO' ? 'Cambia tu nombre, tu foto y sube tu CV.' : 'Cambia tu nombre y tu foto.' }}</p>
      </div>
    </header>

    <p v-if="cargando" class="estado" role="status">Cargando tu perfil…</p>

    <div v-else-if="errorCarga" class="estado error" role="alert">
      <p>{{ errorCarga }}</p>
      <button type="button" class="btn secundario" @click="cargar">Reintentar</button>
    </div>

    <template v-else-if="perfil">
      <Alerta v-if="aviso" tipo="ok">{{ aviso }}</Alerta>
      <Alerta v-if="errorAviso" tipo="error">{{ errorAviso }}</Alerta>

      <!-- Foto y datos fijos -->
      <section class="panel tarjeta-perfil" aria-label="Mi foto">
        <div class="avatar-caja" :class="{ ocupado: subiendoFoto }">
          <img v-if="perfil.fotoUrl" :src="perfil.fotoUrl" alt="Mi foto de perfil" class="avatar-img" />
          <span v-else class="avatar-iniciales" aria-hidden="true">{{ iniciales }}</span>
          <span v-if="subiendoFoto" class="avatar-girando" aria-hidden="true"></span>
        </div>

        <div class="identidad">
          <h2 class="nombre">{{ perfil.nombre }} {{ perfil.apellidos }}</h2>
          <p class="meta">
            <span class="chip neutro">{{ etiquetaRol }}</span>
            <span>Usuario: <strong>{{ perfil.carne }}</strong></span>
          </p>
          <p v-if="perfil.email" class="meta">Correo: {{ perfil.email }}</p>
          <p v-if="perfil.clases.length" class="meta">
            {{ perfil.rol === 'ALUMNO' ? 'Clase' : 'Clases' }}:
            {{ perfil.clases.map((c) => c.nombre).join(', ') }}
          </p>

          <div class="acciones-foto">
            <input
              ref="entradaFoto"
              type="file"
              class="oculto"
              accept="image/jpeg,image/png,image/webp"
              tabindex="-1"
              aria-hidden="true"
              @change="elegirFoto"
            />
            <button type="button" class="btn secundario chico" :disabled="subiendoFoto" @click="entradaFoto?.click()">
              {{ perfil.fotoUrl ? 'Cambiar foto' : 'Subir foto' }}
            </button>
            <button
              v-if="perfil.fotoUrl"
              type="button"
              class="btn peligro chico"
              :disabled="subiendoFoto"
              @click="quitarFoto"
            >
              Quitar foto
            </button>
          </div>
          <p class="nota">JPG, PNG o WEBP, máximo {{ MAX_MB }} MB.</p>
        </div>
      </section>

      <!-- Datos editables -->
      <form class="panel" novalidate aria-labelledby="datos" @submit.prevent="guardarDatos">
        <h2 id="datos" class="panel-titulo">Mis datos</h2>
        <div class="fila-doble">
          <div class="campo">
            <label for="nombre" class="etiqueta">Nombre</label>
            <input
              id="nombre"
              v-model="form.nombre"
              class="entrada"
              :class="{ 'con-error': errores.nombre }"
              maxlength="80"
              autocomplete="given-name"
            />
            <p v-if="errores.nombre" class="error" role="alert">{{ errores.nombre }}</p>
          </div>
          <div class="campo">
            <label for="apellidos" class="etiqueta">Apellidos</label>
            <input
              id="apellidos"
              v-model="form.apellidos"
              class="entrada"
              :class="{ 'con-error': errores.apellidos }"
              maxlength="80"
              autocomplete="family-name"
            />
            <p v-if="errores.apellidos" class="error" role="alert">{{ errores.apellidos }}</p>
          </div>
        </div>
        <Alerta tipo="info">
          Tu usuario, tu correo y tu contraseña no se cambian aquí: si necesitas cambiarlos, pídeselo a tu maestro o al
          administrador.
        </Alerta>
        <div>
          <button type="submit" class="btn primario" :disabled="guardando || !hayCambios" :aria-busy="guardando">
            {{ guardando ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </div>
      </form>

      <!-- CV -->
      <section v-if="perfil.rol === 'ALUMNO'" class="panel" aria-labelledby="cv-titulo">
        <h2 id="cv-titulo" class="panel-titulo">Mi CV</h2>

        <div v-if="perfil.tieneCv" class="cv-actual">
          <span class="chip est-ok">CV subido</span>
          <button type="button" class="btn secundario chico" @click="verCv">Ver mi CV</button>
          <button type="button" class="btn peligro chico" @click="((errorQuitarCv = ''), (quitarCvAbierto = true))">
            Quitar CV
          </button>
        </div>
        <p v-else class="nota">Aún no has subido tu CV.</p>

        <form class="forma-cv" novalidate @submit.prevent="subirCv">
          <span class="etiqueta">{{ perfil.tieneCv ? 'Reemplazar mi CV (PDF)' : 'Subir mi CV (PDF)' }}</span>
          <SubirPdf
            nombre="CV"
            :archivo="cv"
            :subiendo="subiendoCv"
            :error="errorCv"
            :max-mb="MAX_MB"
            @elegir="elegirCv"
          />
          <button type="submit" class="btn primario" :disabled="subiendoCv || !cv" :aria-busy="subiendoCv">
            {{ subiendoCv ? 'Subiendo…' : perfil.tieneCv ? 'Reemplazar CV' : 'Guardar CV' }}
          </button>
        </form>
      </section>
    </template>

    <ConfirmDialog
      v-model="quitarCvAbierto"
      tono="peligro"
      titulo="¿Quitar tu CV?"
      boton="Sí, quitar CV"
      cancelar="No, conservar"
      :lineas="['Se borrará el PDF que subiste.', 'Después puedes subir otro cuando quieras.']"
      :ejecutando="quitandoCv"
      :error="errorQuitarCv"
      @confirmar="quitarCv"
    />
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  font-size: 0.88rem;
  color: var(--color-texto-suave);
}

.oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

/* ───── Foto ───── */
.tarjeta-perfil {
  flex-direction: row;
  align-items: center;
  gap: 24px;
}

.avatar-caja {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  width: 112px;
  height: 112px;
  overflow: hidden;
  background: var(--color-azul-2);
  border: 3px solid #fff;
  border-radius: 50%;
  box-shadow:
    0 0 0 1px var(--color-borde),
    var(--sombra-sm);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation: aparece 0.4s ease;
}

.avatar-iniciales {
  font-family: var(--fuente-titulo);
  font-size: 2.2rem;
  font-weight: 700;
  color: #fff;
}

.avatar-caja.ocupado .avatar-img,
.avatar-caja.ocupado .avatar-iniciales {
  opacity: 0.4;
}

.avatar-girando {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 30px;
  height: 30px;
  border: 3px solid rgba(255, 255, 255, 0.5);
  border-top-color: #fff;
  border-radius: 50%;
  animation: girar 0.8s linear infinite;
}

.identidad {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.nombre {
  margin: 0;
  overflow-wrap: anywhere;
  font-family: var(--fuente-titulo);
  font-size: 1.3rem;
  color: var(--color-azul-2);
}

.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 0.92rem;
  color: var(--color-texto-suave);
}

.acciones-foto {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}

/* ───── CV ───── */
.cv-actual {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.chip.est-ok {
  color: var(--ok-texto);
  background: var(--ok-fondo);
}

.forma-cv {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

@keyframes aparece {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes girar {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 560px) {
  .tarjeta-perfil {
    flex-direction: column;
    text-align: center;
  }

  .meta,
  .acciones-foto {
    justify-content: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .avatar-img {
    animation: none;
  }
}
</style>
