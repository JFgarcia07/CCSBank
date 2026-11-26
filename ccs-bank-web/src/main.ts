import { createApp } from 'vue'
import { createPinia } from 'pinia'

import './assets/tokens.css'
import './assets/app.css'
import App from './App.vue'
import router from './router'
import { registrarSesionExpirada } from './lib/http'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Si la API responde 401 (token vencido o usuario desactivado), se cierra la sesión.
registrarSesionExpirada(() => {
  useAuthStore(pinia).cerrarSesion()
  void router.push({ name: 'login' })
})

app.mount('#app')
