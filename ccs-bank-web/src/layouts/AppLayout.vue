<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { itemsNavegacion } from '@/lib/navegacion'
import { perfilService } from '@/services/perfil.service'
import logo from '@/assets/logo-ccs-color-600.webp'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const items = computed(() => itemsNavegacion(auth.esStaff, auth.rol === 'ADMIN'))
const etiquetaRol = computed(
  () => ({ ALUMNO: 'Alumno', MAESTRO: 'Maestro', ADMIN: 'Administrador' })[auth.rol ?? 'ALUMNO'],
)
const iniciales = computed(() => {
  const u = auth.usuario
  return u ? `${u.nombre.charAt(0)}${u.apellidos.charAt(0)}`.toUpperCase() : ''
})

// Menú lateral en celulares (en escritorio siempre está visible).
const menuAbierto = ref(false)
const cerrarMenu = () => (menuAbierto.value = false)
watch(() => route.fullPath, cerrarMenu)

function alTeclear(e: KeyboardEvent) {
  if (e.key === 'Escape') cerrarMenu()
}
onMounted(() => {
  window.addEventListener('keydown', alTeclear)
  // La foto no viaja en el token: se pide una vez al entrar (si falla, se muestran las iniciales).
  if (!auth.fotoUrl) {
    perfilService
      .obtener()
      .then((p) => auth.actualizarPerfil({ nombre: p.nombre, apellidos: p.apellidos, fotoUrl: p.fotoUrl }))
      .catch(() => undefined)
  }
})
onBeforeUnmount(() => window.removeEventListener('keydown', alTeclear))

async function salir() {
  auth.cerrarSesion()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="app">
    <aside id="menu-lateral" class="lateral" :class="{ abierto: menuAbierto }" aria-label="Navegación principal">
      <div class="marca">
        <img :src="logo" alt="" class="marca-logo" width="44" height="44" />
        <div>
          <p class="marca-nombre">CCS Bank</p>
          <p class="marca-sub">Calvary Christian School</p>
        </div>
      </div>

      <nav class="menu">
        <template v-for="item in items" :key="item.id">
          <RouterLink v-if="item.ruta" :to="{ name: item.ruta }" class="item" active-class="activo">
            <svg viewBox="0 0 24 24" class="icono" aria-hidden="true"><path :d="item.icono" /></svg>
            {{ item.etiqueta }}
          </RouterLink>
          <span v-else class="item pendiente" aria-disabled="true" title="Próximamente">
            <svg viewBox="0 0 24 24" class="icono" aria-hidden="true"><path :d="item.icono" /></svg>
            {{ item.etiqueta }}
            <span class="pronto">Pronto</span>
          </span>
        </template>
      </nav>

      <button type="button" class="salir" @click="salir">
        <svg viewBox="0 0 24 24" class="icono" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
        Cerrar sesión
      </button>
    </aside>

    <div v-if="menuAbierto" class="velo" aria-hidden="true" @click="cerrarMenu" />

    <div class="columna">
      <header class="barra">
        <button
          type="button"
          class="hamburguesa"
          aria-label="Abrir menú"
          aria-controls="menu-lateral"
          :aria-expanded="menuAbierto"
          @click="menuAbierto = !menuAbierto"
        >
          <svg viewBox="0 0 24 24" class="icono" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
        <h2 class="barra-titulo">{{ route.meta.titulo }}</h2>

        <div class="usuario">
          <RouterLink :to="{ name: 'perfil' }" class="avatar" aria-label="Ir a mi perfil">
            <img v-if="auth.fotoUrl" :src="auth.fotoUrl" alt="" class="avatar-img" />
            <template v-else>{{ iniciales }}</template>
          </RouterLink>
          <div class="usuario-datos">
            <p class="usuario-nombre">{{ auth.usuario?.nombre }} {{ auth.usuario?.apellidos }}</p>
            <p class="usuario-rol">{{ etiquetaRol }}</p>
          </div>
        </div>
      </header>

      <main class="contenido">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--color-fondo);
}

/* ───── Barra lateral ───── */
.lateral {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  flex: 0 0 256px;
  width: 256px;
  height: 100vh;
  height: 100dvh;
  padding: 20px 14px;
  color: var(--color-texto);
  background: #fff;
  border-right: 1px solid var(--color-borde);
}

.marca {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px 22px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--color-borde);
}

.marca-logo {
  width: 44px;
  height: 44px;
  border-radius: 50%;
}

.marca-nombre {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-azul-2);
}

.marca-sub {
  margin: 0;
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  color: var(--color-texto-suave);
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  overflow-y: auto;
}

.item,
.salir {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 11px 12px;
  font: inherit;
  font-size: 0.92rem;
  font-weight: 500;
  color: #475467;
  text-decoration: none;
  text-align: left;
  background: none;
  border: 0;
  border-radius: var(--radio-sm);
}

.item:not(.pendiente):hover,
.salir:hover {
  color: var(--color-azul-2);
  background: #f4f5f7;
}

.item:focus-visible,
.salir:focus-visible {
  outline: 2px solid var(--color-azul-1);
  outline-offset: 1px;
}

.item.activo {
  font-weight: 600;
  color: var(--color-azul-2);
  background: var(--color-crema);
}

.item.activo::before {
  content: '';
  position: absolute;
  left: -14px;
  top: 8px;
  bottom: 8px;
  width: 4px;
  background: var(--color-acento);
  border-radius: 0 4px 4px 0;
}

.pendiente {
  opacity: 0.55;
  cursor: default;
}

.pronto {
  margin-left: auto;
  padding: 2px 7px;
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-texto-suave);
  border: 1px solid var(--color-borde-fuerte);
  border-radius: 999px;
}

.icono {
  flex: none;
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.salir {
  margin-top: 10px;
  cursor: pointer;
  border-top: 1px solid var(--color-borde);
  border-radius: 0 0 var(--radio-sm) var(--radio-sm);
  padding-top: 16px;
}

/* ───── Columna principal ───── */
.columna {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.barra {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 14px;
  height: 68px;
  padding: 0 28px;
  background: #fff;
  border-bottom: 1px solid var(--color-borde);
}

.barra-titulo {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: 1.25rem;
  font-weight: 600;
}

.usuario {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.avatar {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  overflow: hidden;
  text-decoration: none;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-azul-2);
  background: var(--color-crema);
  border: 1px solid #e6dcc4;
  border-radius: 50%;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.usuario-nombre,
.usuario-rol {
  margin: 0;
  line-height: 1.25;
}

.usuario-nombre {
  font-size: 0.88rem;
  font-weight: 600;
}

.usuario-rol {
  font-size: 0.74rem;
  color: var(--color-texto-suave);
}

.hamburguesa {
  display: none;
  place-items: center;
  width: 40px;
  height: 40px;
  color: var(--color-texto);
  background: none;
  border: 1px solid #d5dbe6;
  border-radius: var(--radio-sm);
  cursor: pointer;
}

.hamburguesa .icono {
  stroke-width: 2;
}

.contenido {
  flex: 1;
  padding: 28px;
}

.velo {
  position: fixed;
  inset: 0;
  z-index: 25;
  background: rgba(16, 24, 40, 0.45);
}

/* ───── Celulares y tabletas ───── */
@media (max-width: 900px) {
  .lateral {
    position: fixed;
    inset: 0 auto 0 0;
    transform: translateX(-100%);
    visibility: hidden; /* cerrado: sus enlaces no reciben foco con el teclado */
    transition: transform 0.25s ease, visibility 0.25s;
    box-shadow: 8px 0 30px rgba(16, 24, 40, 0.18);
  }

  .lateral.abierto {
    transform: none;
    visibility: visible;
  }

  .hamburguesa {
    display: grid;
  }

  .barra {
    padding: 0 16px;
  }

  .contenido {
    padding: 18px 16px 28px;
  }

  .usuario-datos {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lateral {
    transition: none;
  }
}
</style>
