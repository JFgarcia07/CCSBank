<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Alerta from '@/components/Alerta.vue'
import SubirPdf from '@/components/SubirPdf.vue'
import { abrirReporte } from '@/lib/abrirReporte'
import { mensajeDeError } from '@/lib/errores'
import { semanaCorta } from '@/lib/semana'
import { reportesService } from '@/services/reportes.service'
import type { EstadoReporte, MiTrabajo } from '@/types/reportes'

const MAX_MB = 2

const datos = ref<MiTrabajo | null>(null)
const cargando = ref(true)
const errorCarga = ref('')
const aviso = ref('')
const errorAviso = ref('')
const subiendo = ref(false)
const archivo = ref<File | null>(null)
const errorArchivo = ref('')

const dinero = (v: string | number) =>
  `CCS$ ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const estadoTexto: Record<EstadoReporte, string> = {
  PENDIENTE: 'En revisión',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
}

async function cargar() {
  cargando.value = true
  errorCarga.value = ''
  try {
    datos.value = await reportesService.miTrabajo()
  } catch (e) {
    errorCarga.value = mensajeDeError(e, 'No se pudo cargar tu trabajo.')
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)

/** Reporte de la semana en curso, si ya lo enviaste. */
const deEstaSemana = computed(() => datos.value?.reportes.find((r) => r.semana === datos.value?.semanaActual) ?? null)
const bloqueado = computed(() => deEstaSemana.value?.estado === 'APROBADO')

function elegir(f: File | null) {
  errorArchivo.value = ''
  archivo.value = null
  if (!f) return
  if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
    errorArchivo.value = 'El archivo debe ser un PDF.'
  } else if (f.size > MAX_MB * 1024 * 1024) {
    errorArchivo.value = `Pesa ${(f.size / 1024 / 1024).toFixed(1)} MB y el máximo es ${MAX_MB} MB. Reduce el tamaño de las fotos del documento.`
  } else {
    archivo.value = f
  }
}

async function subir() {
  if (!archivo.value) {
    errorArchivo.value = 'Elige el PDF de tu reporte.'
    return
  }
  subiendo.value = true
  aviso.value = ''
  errorAviso.value = ''
  try {
    await reportesService.subir(archivo.value)
    aviso.value = 'Listo: tu reporte se envió y quedó en revisión.'
    archivo.value = null
    datos.value = await reportesService.miTrabajo()
  } catch (e) {
    errorAviso.value = mensajeDeError(e, 'No se pudo subir el reporte.')
  } finally {
    subiendo.value = false
  }
}

async function ver(id: string) {
  errorAviso.value = ''
  try {
    await abrirReporte(id)
  } catch (e) {
    errorAviso.value = mensajeDeError(e, 'No se pudo abrir el reporte.')
  }
}
</script>

<template>
  <div class="pagina">
    <header class="cabecera">
      <div>
        <h1 class="titulo">Mi trabajo</h1>
        <p class="sub">Tu trabajo en la clase y el reporte semanal que debes entregar.</p>
      </div>
    </header>

    <p v-if="cargando" class="estado" role="status">Cargando tu trabajo…</p>

    <div v-else-if="errorCarga" class="estado error" role="alert">
      <p>{{ errorCarga }}</p>
      <button type="button" class="btn secundario" @click="cargar">Reintentar</button>
    </div>

    <template v-else-if="datos">
      <Alerta v-if="aviso" tipo="ok">{{ aviso }}</Alerta>
      <Alerta v-if="errorAviso" tipo="error">{{ errorAviso }}</Alerta>

      <div v-if="!datos.trabajo" class="estado">
        <p><strong>Aún no tienes un trabajo asignado.</strong></p>
        <p>Cuando tu maestro te asigne uno, aparecerá aquí junto con sus responsabilidades.</p>
      </div>

      <template v-else>
        <section class="panel" aria-labelledby="mi-trabajo">
          <div class="panel-cab">
            <h2 id="mi-trabajo" class="panel-titulo">{{ datos.trabajo.nombre }}</h2>
            <span class="chip neutro">Salario semanal {{ dinero(datos.trabajo.salarioSemanal) }}</span>
          </div>
          <div v-if="datos.trabajo.descripcion" class="resp">
            <h3 class="etiqueta">Responsabilidades</h3>
            <p class="resp-texto">{{ datos.trabajo.descripcion }}</p>
          </div>
        </section>

        <section class="panel" aria-labelledby="reporte">
          <h2 id="reporte" class="panel-titulo">Reporte de esta semana (desde el {{ semanaCorta(datos.semanaActual) }})</h2>

          <Alerta tipo="info">
            Tu reporte debe ser un PDF de máximo {{ MAX_MB }} MB con 4 partes: <strong>lo que hice</strong>,
            <strong>evidencias</strong>, <strong>dificultades</strong> y <strong>propuesta para la próxima semana</strong>.
            Si pegas fotos, redúcelas antes para que no pese demasiado.
          </Alerta>

          <Alerta v-if="deEstaSemana?.estado === 'APROBADO'" tipo="ok">
            Tu reporte de esta semana está aprobado{{ deEstaSemana.pagado ? ' y tu salario ya fue pagado: cóbralo en Cuenta' : '' }}.
          </Alerta>
          <Alerta v-else-if="deEstaSemana?.estado === 'PENDIENTE'" tipo="aviso">
            Ya enviaste tu reporte y está en revisión. Si subes otro PDF, reemplaza al anterior.
          </Alerta>
          <Alerta v-else-if="deEstaSemana?.estado === 'RECHAZADO'" tipo="error">
            Tu maestro rechazó el reporte: «{{ deEstaSemana.comentario }}». Corrígelo y súbelo otra vez.
          </Alerta>

          <form v-if="!bloqueado" class="forma-subir" novalidate @submit.prevent="subir">
            <div class="campo">
              <span class="etiqueta">{{ deEstaSemana ? 'Reemplazar mi reporte (PDF)' : 'Mi reporte (PDF)' }}</span>
              <SubirPdf
                :archivo="archivo"
                :subiendo="subiendo"
                :error="errorArchivo"
                :max-mb="MAX_MB"
                @elegir="elegir"
              />
            </div>
            <button type="submit" class="btn primario" :disabled="subiendo || !archivo" :aria-busy="subiendo">
              {{ subiendo ? 'Subiendo…' : deEstaSemana ? 'Reemplazar reporte' : 'Enviar reporte' }}
            </button>
          </form>
        </section>
      </template>

      <section v-if="datos.reportes.length" class="panel" aria-labelledby="hist">
        <h2 id="hist" class="panel-titulo">Mis reportes</h2>
        <ul class="lista-rep">
          <li v-for="r in datos.reportes" :key="r.id" class="rep">
            <div class="rep-info">
              <strong>Semana del {{ semanaCorta(r.semana) }}</strong>
              <small>{{ r.trabajo }}</small>
              <small v-if="r.estado === 'RECHAZADO' && r.comentario" class="motivo">«{{ r.comentario }}»</small>
            </div>
            <div class="rep-der">
              <span class="chip" :class="`est-${r.estado.toLowerCase()}`">
                {{ estadoTexto[r.estado] }}<template v-if="r.pagado"> · pagado</template>
              </span>
              <button type="button" class="btn secundario chico" @click="ver(r.id)">
                Ver PDF<span class="solo-lector"> de la semana del {{ semanaCorta(r.semana) }}</span>
              </button>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: #fff;
  border: 1px solid var(--color-borde);
  border-radius: var(--radio-md);
  box-shadow: var(--sombra-sm);
}

.panel-cab {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.panel-titulo {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: 1.1rem;
  color: var(--color-azul-2);
}

.resp h3 {
  margin: 0 0 6px;
}

.resp-texto {
  margin: 0;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.forma-subir {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.forma-subir .campo {
  width: 100%;
  max-width: 520px;
  text-align: center;
}

.forma-subir :deep(.subir) {
  margin-inline: auto;
}

.lista-rep {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rep {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
}

.rep + .rep {
  border-top: 1px solid var(--color-borde);
}

.rep-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.rep-info small {
  color: var(--color-texto-suave);
}

.rep-info .motivo {
  color: var(--peligro-texto);
}

.rep-der {
  display: flex;
  flex: none;
  align-items: center;
  gap: 10px;
}

.chip.est-pendiente {
  color: var(--aviso-texto);
  background: var(--aviso-fondo);
}

.chip.est-aprobado {
  color: var(--ok-texto);
  background: var(--ok-fondo);
}

.chip.est-rechazado {
  color: var(--peligro-texto);
  background: var(--peligro-fondo);
}

@media (max-width: 560px) {
  .rep {
    flex-direction: column;
    align-items: stretch;
  }

  .rep-der {
    justify-content: space-between;
  }
}
</style>
