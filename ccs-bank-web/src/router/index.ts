import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { Rol } from '@/types/auth'

declare module 'vue-router' {
  interface RouteMeta {
    titulo?: string
    /** Ruta accesible sin sesión (p. ej. el login). Por defecto exigen sesión. */
    publica?: boolean
    /** Si se indica, solo estos roles pueden entrar. El backend valida lo mismo. */
    roles?: Rol[]
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { titulo: 'Iniciar sesión', publica: true },
    },
    {
      // Todas las pantallas con sesión comparten el marco (sidebar + barra superior).
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        { path: '', redirect: { name: 'inicio' } },
        {
          path: 'inicio',
          name: 'inicio',
          component: () => import('@/views/PrincipalView.vue'),
          meta: { titulo: 'Inicio' },
        },
        {
          path: 'cuenta',
          name: 'cuenta',
          component: () => import('@/views/alumno/CuentaView.vue'),
          meta: { titulo: 'Cuenta', roles: ['ALUMNO'] },
        },
        {
          path: 'estado-de-cuenta',
          name: 'estado-de-cuenta',
          component: () => import('@/views/alumno/EstadoCuentaView.vue'),
          meta: { titulo: 'Estado de cuenta', roles: ['ALUMNO'] },
        },
        {
          path: 'perfil',
          name: 'perfil',
          component: () => import('@/views/PerfilView.vue'),
          meta: { titulo: 'Perfil' },
        },
        {
          path: 'trabajo',
          name: 'trabajo',
          component: () => import('@/views/alumno/TrabajoView.vue'),
          meta: { titulo: 'Trabajo', roles: ['ALUMNO'] },
        },
        {
          path: 'tienda',
          name: 'tienda',
          component: () => import('@/views/alumno/TiendaView.vue'),
          meta: { titulo: 'Tienda', roles: ['ALUMNO'] },
        },
        {
          path: 'grado',
          name: 'grado',
          component: () => import('@/views/docente/GradoView.vue'),
          meta: { titulo: 'Grado', roles: ['MAESTRO', 'ADMIN'] },
        },
        {
          path: 'nomina',
          name: 'nomina',
          component: () => import('@/views/docente/NominaView.vue'),
          meta: { titulo: 'Nómina', roles: ['MAESTRO', 'ADMIN'] },
        },
        {
          path: 'clases',
          name: 'clases',
          component: () => import('@/views/docente/ClasesView.vue'),
          meta: { titulo: 'Clases', roles: ['ADMIN'] },
        },
        {
          path: 'cuentas',
          name: 'cuentas',
          component: () => import('@/views/docente/UsuariosView.vue'),
          meta: { titulo: 'Cuentas', roles: ['ADMIN'] },
        },
      ],
    },
    { path: '/:ruta(.*)*', redirect: '/inicio' },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  const haySesion = await auth.restaurarSesion()

  if (to.meta.publica) {
    // Quien ya inició sesión no necesita ver el login.
    return haySesion && to.name === 'login' ? { name: 'inicio' } : true
  }

  if (!haySesion) {
    const volverA = to.fullPath === '/inicio' ? undefined : to.fullPath
    return { name: 'login', query: volverA ? { redirect: volverA } : undefined }
  }

  if (to.meta.roles && auth.rol && !to.meta.roles.includes(auth.rol)) {
    return { name: 'inicio' }
  }
  return true
})

router.afterEach((to) => {
  document.title = to.meta.titulo ? `${to.meta.titulo} · CCS Bank` : 'CCS Bank'
})

export default router
