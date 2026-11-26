<script setup lang="ts">
import { computed, ref, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    type?: 'text' | 'password'
    placeholder?: string
    autocomplete?: string
    error?: string
  }>(),
  { type: 'text', placeholder: '', autocomplete: 'off', error: '' },
)

const modelo = defineModel<string>({ default: '' })

const id = useId()
const visible = ref(false)
const esPassword = computed(() => props.type === 'password')
const tipoReal = computed(() => (esPassword.value && visible.value ? 'text' : props.type))
</script>

<template>
  <div class="campo">
    <label :for="id" class="etiqueta">{{ label }}</label>
    <div class="caja">
      <input
        :id="id"
        v-model="modelo"
        :type="tipoReal"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :aria-invalid="!!error"
        :aria-describedby="error ? `${id}-error` : undefined"
        class="entrada"
        :class="{ 'con-error': !!error, 'con-ojo': esPassword }"
      />
      <button
        v-if="esPassword"
        type="button"
        class="ojo"
        :aria-label="visible ? 'Ocultar contraseña' : 'Mostrar contraseña'"
        @click="visible = !visible"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <template v-if="!visible">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
          </template>
          <template v-else>
            <path d="M17.9 17.9A10.9 10.9 0 0 1 12 19c-6.4 0-10-7-10-7a18.5 18.5 0 0 1 5.1-5.9" />
            <path d="M9.9 5.2A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a18.6 18.6 0 0 1-2.2 3.2" />
            <path d="M1 1l22 22" />
          </template>
        </svg>
      </button>
    </div>
    <p v-if="error" :id="`${id}-error`" class="error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.campo {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.etiqueta {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-texto-inverso);
}

.caja {
  position: relative;
}

.entrada {
  width: 100%;
  height: 46px;
  padding: 0 14px;
  font: inherit;
  font-size: 0.95rem;
  color: var(--color-texto);
  background: var(--color-superficie);
  border: 2px solid transparent;
  border-radius: var(--radio-sm);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.entrada::placeholder {
  color: #7b869b;
}

.entrada:focus-visible {
  border-color: var(--color-acento);
  box-shadow: 0 0 0 3px rgba(201, 168, 119, 0.35);
}

.entrada.con-error {
  border-color: var(--color-error);
}

.entrada.con-ojo {
  padding-right: 44px;
}

.ojo {
  position: absolute;
  top: 0;
  right: 0;
  display: grid;
  place-items: center;
  width: 44px;
  height: 46px;
  color: var(--color-texto-suave);
  background: none;
  border: 0;
  border-radius: 0 var(--radio-sm) var(--radio-sm) 0;
  cursor: pointer;
}

.ojo:hover {
  color: var(--color-texto);
}

.ojo:focus-visible {
  outline: 2px solid var(--color-acento);
  outline-offset: -2px;
}

.error {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-error);
}
</style>
