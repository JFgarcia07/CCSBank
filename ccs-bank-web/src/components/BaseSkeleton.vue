<script setup lang="ts">
// Bloque "esqueleto" con brillo animado, para mostrar mientras se cargan datos.
withDefaults(
  defineProps<{
    ancho?: string
    alto?: string
    circulo?: boolean
    /** Para usarlo sobre fondos oscuros (p. ej. la barra lateral). */
    sobreOscuro?: boolean
  }>(),
  { ancho: '100%', alto: '1em', circulo: false, sobreOscuro: false },
)
</script>

<template>
  <span
    class="esqueleto"
    :class="{ circulo, 'sobre-oscuro': sobreOscuro }"
    :style="{ width: ancho, height: alto }"
    aria-hidden="true"
  />
</template>

<style scoped>
.esqueleto {
  --base: rgba(27, 38, 68, 0.08);
  --brillo: rgba(255, 255, 255, 0.7);
  display: block;
  background: linear-gradient(90deg, var(--base) 25%, var(--brillo) 50%, var(--base) 75%);
  background-size: 200% 100%;
  border-radius: var(--radio-sm);
  animation: brillo 1.4s ease-in-out infinite;
}

.sobre-oscuro {
  --base: rgba(239, 229, 209, 0.1);
  --brillo: rgba(239, 229, 209, 0.28);
}

.circulo {
  border-radius: 50%;
}

@keyframes brillo {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .esqueleto {
    animation: none;
  }
}
</style>
