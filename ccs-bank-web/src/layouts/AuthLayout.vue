<template>
  <main class="auth">
    <div class="formas" aria-hidden="true">
      <span class="forma f1" />
      <span class="forma f2" />
      <span class="forma f3" />
      <span class="forma f4" />
      <span class="forma f5" />
    </div>
    <div class="contenido">
      <slot />
    </div>
  </main>
</template>

<style scoped>
.auth {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 24px 16px;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 50% 40%, var(--color-azul-1) 0%, var(--color-azul-2) 45%, var(--color-azul-3) 100%);
}

.contenido {
  position: relative;
  z-index: 1;
  width: 100%;
  display: flex;
  justify-content: center;
}

/* Formas suaves de fondo (inspiradas en el diseño de referencia) */
.formas {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.forma {
  position: absolute;
  display: block;
  background: linear-gradient(135deg, rgba(239, 229, 209, 0.5), rgba(201, 168, 119, 0.1));
  filter: blur(1px);
}

.f1 {
  top: 8%;
  left: 12%;
  width: 150px;
  height: 150px;
  border: 28px solid rgba(201, 168, 119, 0.5);
  background: none;
  border-radius: 50%;
}

.f2 {
  bottom: 12%;
  left: 18%;
  width: 260px;
  height: 90px;
  border-radius: 999px;
  transform: rotate(-24deg);
}

.f3 {
  top: 22%;
  right: 14%;
  width: 90px;
  height: 260px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(8, 12, 28, 0.7), rgba(47, 63, 112, 0.1));
  transform: rotate(18deg);
}

.f4 {
  bottom: -60px;
  right: -40px;
  width: 360px;
  height: 160px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(201, 168, 119, 0.5), rgba(47, 63, 112, 0.1));
  transform: rotate(-8deg);
}

.f5 {
  top: 12%;
  right: 38%;
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(239, 229, 209, 0.7), rgba(201, 168, 119, 0.1));
}

@media (max-width: 640px) {
  .f1,
  .f3,
  .f5 {
    display: none;
  }
}
</style>
