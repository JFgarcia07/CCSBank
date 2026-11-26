import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authService } from '@/services/auth.service'
import { borrarToken, guardarToken, leerToken } from '@/lib/token'
import type { Rol, Usuario } from '@/types/auth'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(leerToken())
  const usuario = ref<Usuario | null>(null)
  /** URL temporal de la foto de perfil (se carga al entrar y cuando cambia). */
  const fotoUrl = ref<string | null>(null)

  const autenticado = computed(() => !!token.value)
  const rol = computed<Rol | null>(() => usuario.value?.rol ?? null)
  const esStaff = computed(() => rol.value === 'MAESTRO' || rol.value === 'ADMIN')

  async function iniciarSesion(carne: string, password: string) {
    const respuesta = await authService.login(carne.trim(), password)
    token.value = respuesta.accessToken
    usuario.value = respuesta.usuario
    guardarToken(respuesta.accessToken)
  }

  /** Recupera el usuario con el token guardado (al recargar la página). */
  async function restaurarSesion(): Promise<boolean> {
    if (!token.value) return false
    if (usuario.value) return true
    try {
      usuario.value = await authService.perfil()
      return true
    } catch {
      cerrarSesion()
      return false
    }
  }

  /** Refleja en el menú los cambios hechos en el perfil. */
  function actualizarPerfil(datos: { nombre: string; apellidos: string; fotoUrl: string | null }) {
    if (usuario.value) usuario.value = { ...usuario.value, nombre: datos.nombre, apellidos: datos.apellidos }
    fotoUrl.value = datos.fotoUrl
  }

  function cerrarSesion() {
    token.value = null
    usuario.value = null
    fotoUrl.value = null
    borrarToken()
  }

  return {
    token,
    usuario,
    fotoUrl,
    autenticado,
    rol,
    esStaff,
    iniciarSesion,
    restaurarSesion,
    actualizarPerfil,
    cerrarSesion,
  }
})
