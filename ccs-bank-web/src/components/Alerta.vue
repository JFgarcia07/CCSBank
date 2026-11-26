<script setup lang="ts">
/** Mensaje en línea con icono: éxito, error, advertencia o información. */
withDefaults(defineProps<{ tipo?: 'ok' | 'error' | 'aviso' | 'info' }>(), { tipo: 'info' })

const ICONOS = {
  ok: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3',
  error: 'M12 8v4M12 16h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  aviso: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  info: 'M12 16v-4M12 8h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
} as const
</script>

<template>
  <div class="alerta" :class="tipo" :role="tipo === 'error' ? 'alert' : 'status'">
    <svg viewBox="0 0 24 24" class="alerta-icono" aria-hidden="true"><path :d="ICONOS[tipo]" /></svg>
    <div class="alerta-texto"><slot /></div>
  </div>
</template>

<style scoped>
.alerta {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  font-size: 0.9rem;
  line-height: 1.45;
  border: 1px solid;
  border-radius: var(--radio-sm);
}

.alerta-icono {
  flex: none;
  width: 20px;
  height: 20px;
  margin-top: 1px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.alerta-texto {
  min-width: 0;
  overflow-wrap: anywhere;
}

.ok {
  color: var(--ok-texto);
  background: var(--ok-fondo);
  border-color: var(--ok-borde);
}

.error {
  color: var(--peligro-texto);
  background: var(--peligro-fondo);
  border-color: var(--peligro-borde);
}

.aviso {
  color: var(--aviso-texto);
  background: var(--aviso-fondo);
  border-color: var(--aviso-borde);
}

.info {
  color: var(--info-texto);
  background: var(--info-fondo);
  border-color: var(--info-borde);
}
</style>
