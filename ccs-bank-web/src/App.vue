<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import PrincipalSkeleton from '@/components/PrincipalSkeleton.vue'

const router = useRouter()
const auth = useAuthStore()

// Mientras el router comprueba la sesión (al recargar con token guardado),
// se muestra el esqueleto en lugar de una pantalla en blanco.
const listo = ref(false)
void router.isReady().then(() => {
  listo.value = true
})
</script>

<template>
  <PrincipalSkeleton v-if="!listo && auth.autenticado" />
  <RouterView />
</template>
