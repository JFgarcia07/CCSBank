<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Archivo ya aceptado por quien usa el componente (null = ninguno). */
    archivo: File | null
    /** Se bloquea mientras se sube. */
    subiendo?: boolean
    error?: string
    maxMb: number
    /** Cómo se llama lo que se sube: "Arrastra tu {nombre} aquí". */
    nombre?: string
  }>(),
  { nombre: 'reporte' },
)

const emit = defineEmits<{
  /** Llega el archivo elegido (o soltado); quien usa el componente lo valida. */
  elegir: [archivo: File | null]
}>()

const idAyuda = useId()
const entrada = ref<HTMLInputElement | null>(null)
const encima = ref(false)
/** Evita el parpadeo: dragenter/dragleave se disparan también al pasar sobre los hijos. */
let contador = 0

const tamano = computed(() => {
  const f = props.archivo
  if (!f) return ''
  return f.size < 1024 * 1024 ? `${Math.max(1, Math.round(f.size / 1024))} KB` : `${(f.size / 1024 / 1024).toFixed(1)} MB`
})

// Si quien usa el componente descarta el archivo, se limpia también el input.
watch(
  () => props.archivo,
  (f) => {
    if (!f && entrada.value) entrada.value.value = ''
  },
)

function abrir() {
  if (!props.subiendo) entrada.value?.click()
}

function alElegir(e: Event) {
  const el = e.target as HTMLInputElement
  emit('elegir', el.files?.[0] ?? null)
  el.value = '' // así se puede volver a elegir el mismo archivo
}

function entra() {
  contador += 1
  encima.value = true
}

function sale() {
  contador = Math.max(0, contador - 1)
  if (contador === 0) encima.value = false
}

function suelta(e: DragEvent) {
  contador = 0
  encima.value = false
  if (props.subiendo) return
  const f = e.dataTransfer?.files?.[0] ?? null
  if (f) emit('elegir', f)
}

function quitar() {
  emit('elegir', null)
}
</script>

<template>
  <div class="subir">
    <input
      ref="entrada"
      type="file"
      class="oculto"
      accept="application/pdf,.pdf"
      tabindex="-1"
      aria-hidden="true"
      @change="alElegir"
    />

    <!-- Zona para soltar -->
    <div
      v-if="!archivo"
      class="zona"
      :class="{ encima, 'con-error': error }"
      role="button"
      tabindex="0"
      :aria-describedby="idAyuda"
      @click="abrir"
      @keydown.enter.prevent="abrir"
      @keydown.space.prevent="abrir"
      @dragenter.prevent="entra"
      @dragover.prevent
      @dragleave.prevent="sale"
      @drop.prevent="suelta"
    >
      <span class="icono-caja" aria-hidden="true">
        <svg viewBox="0 0 24 24" class="icono-flecha">
          <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
        </svg>
      </span>
      <strong class="zona-titulo">{{ encima ? 'Suelta tu PDF aquí' : `Arrastra tu ${nombre} aquí` }}</strong>
      <span :id="idAyuda" class="zona-ayuda">
        o <span class="enlace">elige el archivo</span> · solo PDF, máximo {{ maxMb }} MB
      </span>
    </div>

    <!-- Archivo elegido -->
    <div v-else class="archivo" :class="{ subiendo }">
      <span class="pdf" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5" /></svg>
        <b>PDF</b>
      </span>
      <div class="archivo-info">
        <strong>{{ archivo.name }}</strong>
        <small>{{ subiendo ? `Subiendo tu ${nombre}…` : `${tamano} · listo para enviar` }}</small>
      </div>
      <button v-if="!subiendo" type="button" class="quitar" @click="quitar">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        <span class="solo-lector">Quitar el archivo</span>
      </button>
      <span v-if="subiendo" class="barra" aria-hidden="true"></span>
    </div>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.subir {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 520px;
}

.oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

/* ───── Zona ───── */
.zona {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 30px 20px;
  text-align: center;
  color: var(--color-texto);
  background: var(--color-fondo);
  border-radius: var(--radio-md);
  cursor: pointer;
  /* Borde punteado dibujado con gradientes para poder animarlo */
  background-image:
    repeating-linear-gradient(90deg, var(--color-borde-fuerte) 0 8px, transparent 8px 16px),
    repeating-linear-gradient(90deg, var(--color-borde-fuerte) 0 8px, transparent 8px 16px),
    repeating-linear-gradient(0deg, var(--color-borde-fuerte) 0 8px, transparent 8px 16px),
    repeating-linear-gradient(0deg, var(--color-borde-fuerte) 0 8px, transparent 8px 16px);
  background-size:
    100% 2px,
    100% 2px,
    2px 100%,
    2px 100%;
  background-position:
    0 0,
    0 100%,
    0 0,
    100% 0;
  background-repeat: no-repeat;
  transition:
    background-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.zona:hover {
  background-color: #fff;
  box-shadow: var(--sombra-sm);
}

.zona:focus-visible {
  outline: 3px solid rgba(47, 63, 112, 0.3);
  outline-offset: 3px;
}

.zona.con-error {
  background-color: var(--peligro-fondo);
}

/* Al arrastrar encima: el borde "corre", la zona crece un poco y el icono salta */
.zona.encima {
  background-color: var(--info-fondo, #eef4ff);
  background-image:
    repeating-linear-gradient(90deg, var(--color-azul-2) 0 8px, transparent 8px 16px),
    repeating-linear-gradient(90deg, var(--color-azul-2) 0 8px, transparent 8px 16px),
    repeating-linear-gradient(0deg, var(--color-azul-2) 0 8px, transparent 8px 16px),
    repeating-linear-gradient(0deg, var(--color-azul-2) 0 8px, transparent 8px 16px);
  transform: scale(1.015);
  box-shadow: 0 8px 24px rgba(27, 38, 68, 0.12);
  animation: borde-corre 0.8s linear infinite;
}

.icono-caja {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  color: var(--color-azul-2);
  background: #fff;
  border-radius: 50%;
  box-shadow: var(--sombra-sm);
  transition:
    transform 0.25s ease,
    background-color 0.2s ease,
    color 0.2s ease;
}

.zona:hover .icono-caja {
  transform: translateY(-2px);
}

.zona.encima .icono-caja {
  color: #fff;
  background: var(--color-azul-2);
  animation: salto 0.7s ease-in-out infinite;
}

.icono-flecha,
.pdf svg,
.quitar svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.icono-flecha {
  width: 26px;
  height: 26px;
}

.zona-titulo {
  font-family: var(--fuente-titulo);
  color: var(--color-azul-2);
}

.zona-ayuda {
  font-size: 0.88rem;
  color: var(--color-texto-suave);
}

.enlace {
  font-weight: 600;
  color: var(--color-azul-2);
  text-decoration: underline;
}

/* ───── Archivo elegido ───── */
.archivo {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  overflow: hidden;
  background: #fff;
  border: 1.5px solid var(--ok-borde, #75e0a7);
  border-radius: var(--radio-md);
  box-shadow: var(--sombra-sm);
  animation: aparece 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}

.archivo.subiendo {
  border-color: var(--color-borde-fuerte);
}

.pdf {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  width: 42px;
  height: 48px;
  color: var(--peligro-texto);
  background: var(--peligro-fondo);
  border-radius: 8px;
}

.pdf svg {
  width: 36px;
  height: 36px;
  opacity: 0.35;
}

.pdf b {
  position: absolute;
  bottom: 6px;
  font-size: 0.62rem;
  letter-spacing: 0.04em;
}

.archivo-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.archivo-info strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.archivo-info small {
  color: var(--color-texto-suave);
}

.quitar {
  display: grid;
  flex: none;
  place-items: center;
  width: 34px;
  height: 34px;
  margin-left: auto;
  color: var(--color-texto-suave);
  background: transparent;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    transform 0.2s ease;
}

.quitar:hover {
  color: var(--peligro-texto);
  background: var(--peligro-fondo);
  transform: rotate(90deg);
}

.quitar:focus-visible {
  outline: 3px solid rgba(47, 63, 112, 0.3);
}

.quitar svg {
  width: 18px;
  height: 18px;
}

/* Barra de progreso indeterminada mientras se sube */
.barra {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 3px;
  overflow: hidden;
  background: var(--color-borde);
}

.barra::after {
  content: '';
  position: absolute;
  inset: 0;
  width: 40%;
  background: var(--color-azul-2);
  border-radius: 3px;
  animation: barra 1.1s ease-in-out infinite;
}

@keyframes borde-corre {
  to {
    background-position:
      16px 0,
      -16px 100%,
      0 -16px,
      100% 16px;
  }
}

@keyframes salto {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

@keyframes aparece {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes barra {
  from {
    left: -40%;
  }
  to {
    left: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .zona,
  .zona.encima,
  .zona.encima .icono-caja,
  .archivo,
  .barra::after,
  .quitar {
    animation: none;
    transition: none;
  }

  .zona.encima {
    transform: none;
  }

  .barra::after {
    left: 0;
    width: 100%;
  }
}
</style>
