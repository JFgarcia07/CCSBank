<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    nombre: string
    apellidos: string
    /** URL temporal de la foto; sin foto se muestran las iniciales. */
    foto?: string | null
    /** Diámetro en píxeles. */
    tamano?: number
  }>(),
  { foto: null, tamano: 34 },
)

const iniciales = computed(() => `${props.nombre.charAt(0)}${props.apellidos.charAt(0)}`.toUpperCase())
</script>

<template>
  <span class="avatar" :style="{ width: `${tamano}px`, height: `${tamano}px`, fontSize: `${tamano * 0.38}px` }">
    <img v-if="foto" :src="foto" alt="" class="foto" loading="lazy" />
    <template v-else>{{ iniciales }}</template>
  </span>
</template>

<style scoped>
.avatar {
  display: inline-grid;
  flex: none;
  place-items: center;
  overflow: hidden;
  font-weight: 600;
  line-height: 1;
  color: var(--color-azul-2);
  background: var(--color-crema);
  border: 1px solid #e6dcc4;
  border-radius: 50%;
}

.foto {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
