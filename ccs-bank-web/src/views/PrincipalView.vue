<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import logo from '@/assets/logo-ccs-color-600.webp'

const auth = useAuthStore()

const etiquetaRol = computed(
  () => ({ ALUMNO: 'Alumno', MAESTRO: 'Maestro', ADMIN: 'Administrador' })[auth.rol ?? 'ALUMNO'],
)

const pasos = computed(() =>
  auth.esStaff
    ? [
        { titulo: 'Revisa', texto: 'Aprueba o rechaza los reportes semanales en PDF de tus alumnos.' },
        { titulo: 'Paga', texto: 'Genera los salarios y emite bonus o fines desde Nómina.' },
        { titulo: 'Autoriza', texto: 'Aprueba préstamos y solicitudes de tarjeta.' },
        { titulo: 'Gestiona', texto: 'Mantén la tienda con premios y existencias al día.' },
      ]
    : [
        { titulo: 'Trabaja', texto: 'Cumple las tareas de tu trabajo en el aula.' },
        { titulo: 'Reporta', texto: 'Sube cada semana tu reporte en PDF desde Trabajo.' },
        { titulo: 'Cobra', texto: 'Cuando tu maestro lo aprueba, cobra tu salario en Cuenta.' },
        { titulo: 'Compra', texto: 'Al final de la unidad canjea premios en la Tienda.' },
      ],
)

// ───── Vitrina: el logo queda fijo y gira mientras se hace scroll ─────
const INTRO = 0.12 // fracción inicial del recorrido que muestra la presentación
const BARRA = 68 // alto de la barra superior fija (px)

const sinMovimiento =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const vitrina = ref<HTMLElement | null>(null)
const escenario = ref<HTMLElement | null>(null)
const progreso = ref(0)
let cuadro = 0

function calcular() {
  cuadro = 0
  const v = vitrina.value
  const e = escenario.value
  if (!v || !e) return
  const recorrido = v.offsetHeight - e.offsetHeight
  const avance = BARRA - v.getBoundingClientRect().top
  progreso.value = recorrido > 0 ? Math.min(1, Math.max(0, avance / recorrido)) : 0
}

function alHacerScroll() {
  if (!cuadro) cuadro = requestAnimationFrame(calcular)
}

onMounted(() => {
  if (sinMovimiento) return
  window.addEventListener('scroll', alHacerScroll, { passive: true })
  window.addEventListener('resize', alHacerScroll)
  calcular()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', alHacerScroll)
  window.removeEventListener('resize', alHacerScroll)
  if (cuadro) cancelAnimationFrame(cuadro)
})

/** Paso resaltado: -1 durante la presentación, luego 0..3. */
const activo = computed(() => {
  if (sinMovimiento || progreso.value < INTRO) return -1
  const n = pasos.value.length
  return Math.min(n - 1, Math.floor(((progreso.value - INTRO) / (1 - INTRO)) * n))
})

const estiloLogo = computed(() =>
  sinMovimiento
    ? undefined
    : { transform: `rotateY(${-26 + progreso.value * 52}deg) scale(${0.94 + progreso.value * 0.1})` },
)
const estiloAro = computed(() =>
  sinMovimiento ? undefined : { transform: `rotate(${progreso.value * 240}deg)` },
)
const estiloIntro = computed(() =>
  sinMovimiento ? undefined : { opacity: Math.max(0, 1 - progreso.value / INTRO) },
)
</script>

<template>
  <div class="inicio">
    <!-- Vitrina del producto (el logo) -->
    <section ref="vitrina" class="vitrina" :class="{ estatica: sinMovimiento }" aria-labelledby="saludo">
      <div ref="escenario" class="escenario">
        <div class="intro" :style="estiloIntro">
          <p class="chip">{{ etiquetaRol }} · Carné {{ auth.usuario?.carne }}</p>
          <h1 id="saludo" class="saludo">Hola, {{ auth.usuario?.nombre }}</h1>
        </div>

        <div class="pieza">
          <span class="aro" :style="estiloAro" aria-hidden="true" />
          <div class="giro" :style="estiloLogo">
            <div class="flota">
              <img :src="logo" alt="Escudo de Calvary Christian School" class="logo" width="300" height="300" />
            </div>
          </div>
        </div>

        <div class="intro intro-pie" :style="estiloIntro">
          <p class="lema">
            La economía del aula de Calvary Christian School: trabajas, ganas y aprendes a
            administrar tu dinero.
          </p>
          <p v-if="!sinMovimiento" class="pista" aria-hidden="true">Desliza para conocer más <span>↓</span></p>
        </div>

        <ol class="pasos">
          <li
            v-for="(paso, i) in pasos"
            :key="paso.titulo"
            class="paso"
            :class="[i % 2 === 0 ? 'izq' : 'der', `fila-${Math.floor(i / 2) + 1}`, { activo: activo === i }]"
          >
            <span class="numero">{{ i + 1 }}</span>
            <h2 class="paso-titulo">{{ paso.titulo }}</h2>
            <p class="texto">{{ paso.texto }}</p>
          </li>
        </ol>
      </div>
    </section>
  </div>
</template>

<style scoped>
.inicio {
  display: flex;
  flex-direction: column;
  gap: 56px;
  max-width: 1100px;
  margin: 0 auto;
}

/* ───── Vitrina ───── */
.vitrina {
  /* Alto = una pantalla + recorrido de scroll durante el que el escenario queda fijo. */
  height: calc(100dvh - 68px + 260vh);
}

.escenario {
  position: sticky;
  top: 68px;
  display: grid;
  grid-template-columns: 1fr minmax(260px, 380px) 1fr;
  grid-template-rows: 1fr 1fr;
  align-items: center;
  gap: 0 24px;
  height: calc(100dvh - 68px);
  min-height: 520px;
  background: radial-gradient(ellipse at 50% 48%, #ffffff 0%, rgba(246, 241, 230, 0.7) 45%, transparent 72%);
}

.pieza {
  position: relative;
  grid-column: 2;
  grid-row: 1 / 3;
  display: grid;
  place-items: center;
  perspective: 1100px;
}

.aro {
  position: absolute;
  width: min(118%, 440px);
  aspect-ratio: 1;
  border: 1.5px dashed rgba(201, 168, 119, 0.85);
  border-radius: 50%;
}

/* Las dos cajas ocupan todo el ancho y centran al logo: si no, quedaría pegado a un lado. */
.giro,
.flota {
  display: grid;
  place-items: center;
  width: 100%;
}

.giro {
  transform-style: preserve-3d;
  will-change: transform;
}

.flota {
  animation: flotar 6s ease-in-out infinite alternate;
  will-change: transform;
}

.logo {
  display: block;
  width: min(100%, clamp(200px, 26vw, 320px));
  height: auto;
  aspect-ratio: 1;
  animation: aparecer 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

@keyframes aparecer {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.85);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes flotar {
  from {
    transform: translateY(-7px);
  }
  to {
    transform: translateY(7px);
  }
}

/* Presentación (se desvanece al empezar a bajar) */
.intro {
  position: absolute;
  inset: 3% 0 auto;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  pointer-events: none;
}

.intro-pie {
  inset: auto 0 3%;
}

.chip {
  margin: 0 0 8px;
  padding: 5px 14px;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-azul-2);
  background: var(--color-crema);
  border: 1px solid var(--color-acento);
  border-radius: 999px;
}

.saludo {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: clamp(2rem, 5vw, 3.6rem);
  line-height: 1.1;
  color: var(--color-azul-2);
}

.lema {
  max-width: 52ch;
  margin: 0;
  font-size: 1rem;
  line-height: 1.55;
  color: var(--color-texto-suave);
}

.pista {
  margin: 12px 0 0;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-texto-suave);
}

.pista span {
  display: inline-block;
  animation: rebotar 1.4s ease-in-out infinite;
}

@keyframes rebotar {
  50% {
    transform: translateY(4px);
  }
}

/* Pasos alrededor del producto */
.pasos {
  display: contents;
  margin: 0;
  padding: 0;
  list-style: none;
}

.paso {
  position: relative;
  max-width: 300px;
  opacity: 0;
  transition: opacity 0.45s ease, transform 0.45s ease;
}

.paso.izq {
  grid-column: 1;
  justify-self: end;
  text-align: right;
  transform: translateX(-16px);
}

.paso.der {
  grid-column: 3;
  justify-self: start;
  transform: translateX(16px);
}

.fila-1 {
  grid-row: 1;
}

.fila-2 {
  grid-row: 2;
}

.paso.activo {
  opacity: 1;
  transform: none;
}

.paso::after {
  content: '';
  position: absolute;
  top: 16px;
  width: clamp(24px, 4vw, 56px);
  height: 1px;
  background: var(--color-acento);
}

.izq::after {
  left: 100%;
  margin-left: 14px;
}

.der::after {
  right: 100%;
  margin-right: 14px;
}

.numero {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  margin-bottom: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-azul-2);
  background: var(--color-acento);
  border-radius: 50%;
}

.paso-titulo {
  margin: 0 0 4px;
  font-family: var(--fuente-titulo);
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--color-azul-2);
}

.texto {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--color-texto-suave);
}

/* ───── Celulares ───── */
@media (max-width: 700px) {
  .escenario {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0;
  }

  .pieza {
    margin-top: 40px;
  }

  .aro {
    width: min(92%, 340px);
  }

  .logo {
    width: clamp(170px, 56vw, 240px);
  }

  /* En celular solo se muestra el paso activo, debajo del logo. */
  .pasos {
    display: block;
  }

  .paso,
  .paso.izq,
  .paso.der {
    position: absolute;
    right: 8px;
    bottom: 3%;
    left: 8px;
    max-width: none;
    text-align: center;
    transform: translateY(10px);
  }

  .paso.activo {
    transform: none;
  }

  .paso::after {
    display: none;
  }
}

/* ───── Sin animaciones: todo visible, sin escenario fijo ───── */
.estatica {
  height: auto;
}

.estatica .escenario {
  position: static;
  height: auto;
  min-height: 0;
  padding: 24px 0;
  row-gap: 24px;
}

.estatica .intro {
  position: static;
  grid-column: 1 / -1;
  grid-row: auto;
}

.estatica .intro-pie {
  order: 3;
}

.estatica .pasos {
  display: contents;
}

.estatica .paso {
  position: static;
  opacity: 1;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .flota,
  .logo,
  .pista span {
    animation: none;
  }
}
</style>
