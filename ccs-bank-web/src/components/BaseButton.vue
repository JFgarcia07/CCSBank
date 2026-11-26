<script setup lang="ts">
withDefaults(
  defineProps<{
    type?: 'button' | 'submit'
    cargando?: boolean
  }>(),
  { type: 'button', cargando: false },
)
</script>

<template>
  <button :type="type" class="boton" :disabled="cargando" :aria-busy="cargando">
    <span v-if="cargando" class="spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
.boton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  height: 48px;
  padding: 0 20px;
  font: inherit;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-texto-boton);
  background: var(--color-primario);
  border: 0;
  border-radius: var(--radio-sm);
  cursor: pointer;
  transition: background 0.15s, transform 0.05s;
}

.boton:hover:not(:disabled) {
  background: var(--color-primario-hover);
}

.boton:active:not(:disabled) {
  transform: translateY(1px);
}

.boton:focus-visible {
  outline: 3px solid var(--color-acento);
  outline-offset: 2px;
}

.boton:disabled {
  opacity: 0.75;
  cursor: progress;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(27, 38, 68, 0.3);
  border-top-color: var(--color-texto-boton);
  border-radius: 50%;
  animation: girar 0.7s linear infinite;
}

@keyframes girar {
  to {
    transform: rotate(360deg);
  }
}
</style>
