<script setup lang="ts">
import BaseSkeleton from './BaseSkeleton.vue'
</script>

<template>
  <div class="sk-app" role="status" aria-busy="true" aria-label="Cargando">
    <aside class="sk-lateral">
      <div class="sk-marca">
        <BaseSkeleton circulo ancho="44px" alto="44px" />
        <div class="sk-marca-texto">
          <BaseSkeleton ancho="90px" alto="14px" />
          <BaseSkeleton ancho="130px" alto="10px" />
        </div>
      </div>
      <BaseSkeleton v-for="n in 6" :key="n" alto="38px" />
    </aside>

    <div class="sk-columna">
      <div class="sk-barra">
        <BaseSkeleton ancho="120px" alto="20px" />
        <span class="sk-usuario">
          <BaseSkeleton circulo ancho="38px" alto="38px" />
          <BaseSkeleton ancho="110px" alto="14px" />
        </span>
      </div>

      <div class="sk-contenido">
        <BaseSkeleton alto="420px" class="sk-hero" />
        <BaseSkeleton ancho="160px" alto="22px" />
        <div class="sk-tarjetas">
          <BaseSkeleton v-for="n in 4" :key="n" alto="130px" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sk-app {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--color-fondo);
}

.sk-lateral {
  display: flex;
  flex-direction: column;
  flex: 0 0 256px;
  gap: 10px;
  padding: 24px 14px;
  background: #fff;
  border-right: 1px solid var(--color-borde);
}

.sk-marca {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 20px;
}

.sk-marca-texto {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sk-columna {
  flex: 1;
  min-width: 0;
}

.sk-barra {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 68px;
  padding: 0 28px;
  background: #fff;
  border-bottom: 1px solid var(--color-borde);
}

.sk-usuario {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sk-contenido {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 1100px;
  margin: 0 auto;
  padding: 28px;
}

.sk-hero {
  border-radius: var(--radio-lg);
}

.sk-tarjetas {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

@media (max-width: 900px) {
  .sk-lateral {
    display: none;
  }

  .sk-barra,
  .sk-contenido {
    padding-inline: 16px;
  }

  .sk-tarjetas {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
