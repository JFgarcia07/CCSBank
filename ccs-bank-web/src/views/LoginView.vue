<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isAxiosError } from 'axios'
import { useAuthStore } from '@/stores/auth'
import AuthLayout from '@/layouts/AuthLayout.vue'
import BaseInput from '@/components/BaseInput.vue'
import BaseButton from '@/components/BaseButton.vue'
import logo from '@/assets/logo-ccs-600.webp'

const form = reactive({ usuario: '', password: '' })
const errores = reactive({ usuario: '', password: '' })
const cargando = ref(false)
const errorGeneral = ref('')

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

function mensajeDeError(error: unknown): string {
  if (isAxiosError(error)) {
    if (!error.response) return 'No se pudo conectar con el servidor. Inténtalo de nuevo.'
    if (error.response.status === 401) return 'Usuario o contraseña incorrectos.'
    if (error.response.status === 400) return 'Revisa los datos ingresados.'
  }
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.'
}

function validar(): boolean {
  errores.usuario = form.usuario.trim() ? '' : 'Ingresa tu carné o usuario.'
  errores.password = form.password ? '' : 'Ingresa tu contraseña.'
  return !errores.usuario && !errores.password
}

async function iniciarSesion() {
  errorGeneral.value = ''
  if (!validar()) return
  cargando.value = true
  try {
    await auth.iniciarSesion(form.usuario, form.password)
    const destino = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    // Solo rutas internas: evita redirigir a sitios externos desde un enlace manipulado.
    await router.replace(destino.startsWith('/') && !destino.startsWith('//') ? destino : { name: 'inicio' })
  } catch (error) {
    errorGeneral.value = mensajeDeError(error)
    form.password = ''
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <section class="tarjeta" aria-labelledby="titulo-login">
      <div class="insignia">
        <img :src="logo" alt="Calvary Christian School" class="logo" width="112" height="112" />
      </div>
      <p class="marca">CCS Bank</p>
      <h1 id="titulo-login" class="titulo">Iniciar sesión</h1>

      <form class="formulario" novalidate @submit.prevent="iniciarSesion">
        <BaseInput
          v-model="form.usuario"
          label="Usuario"
          placeholder="Carné o usuario"
          autocomplete="username"
          :error="errores.usuario"
        />
        <BaseInput
          v-model="form.password"
          label="Contraseña"
          type="password"
          placeholder="Tu contraseña"
          autocomplete="current-password"
          :error="errores.password"
        />
        <p v-if="errorGeneral" class="error-general" role="alert">{{ errorGeneral }}</p>
        <BaseButton type="submit" :cargando="cargando">Iniciar sesión</BaseButton>
      </form>
    </section>
  </AuthLayout>
</template>

<style scoped>
.tarjeta {
  width: 100%;
  max-width: 400px;
  padding: 36px 32px 40px;
  color: var(--color-texto-inverso);
  background: var(--cristal-fondo);
  border: 1px solid var(--cristal-borde);
  border-radius: var(--radio-lg);
  box-shadow: 0 24px 60px rgba(3, 20, 70, 0.35);
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
}

.insignia {
  width: 124px;
  height: 124px;
  margin: 0 auto 12px;
}

.logo {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.marca {
  margin: 0;
  text-align: center;
  font-family: var(--fuente-titulo);
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.titulo {
  margin: 28px 0 20px;
  text-align: center;
  color: #fff;
  font-family: var(--fuente-titulo);
  font-size: 1.5rem;
  font-weight: 600;
}

.formulario {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.formulario :deep(.boton) {
  margin-top: 8px;
}

.error-general {
  margin: 0;
  padding: 10px 12px;
  font-size: 0.85rem;
  color: var(--color-error);
  background: rgba(13, 19, 36, 0.45);
  border: 1px solid rgba(255, 180, 180, 0.5);
  border-radius: var(--radio-sm);
}

@media (max-width: 420px) {
  .tarjeta {
    padding: 28px 20px 32px;
  }
}
</style>
