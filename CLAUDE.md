# CCS Bank — Contexto del proyecto

> Este archivo da contexto a Claude Code. **No implementes nada por iniciativa propia**: espera instrucciones explícitas para cada tarea y pregunta si algo no está claro.

## Qué es

**CCS Bank** es una aplicación web para el **Calvary Christian School** (Guatemala, est. 2016). Maneja la economía del aula: los alumnos tienen trabajos en clase, entregan un reporte semanal, cobran salario, reciben bonus y fines, y al final de cada unidad compran premios en una tienda. La moneda interna se muestra como **CCS$**.

## Roles

| Rol | Descripción |
| --- | --- |
| `ALUMNO` | Ve y cobra su dinero, sube reportes, compra en la tienda. |
| `MAESTRO` | Gestiona los alumnos de sus grados: revisa reportes, paga, emite bonus/fines. |
| `ADMIN` | Todo lo del maestro más gestión de usuarios, grados y configuración. |

No hay registro público: el admin crea las cuentas. Email y contraseña solo los cambia un maestro o admin.

## Pantallas

| Pantalla | Rol | Función |
| --- | --- | --- |
| Login | Todos | Inicio de sesión con carné/usuario y contraseña. |
| Principal | Todos | Resumen e instrucciones de uso. |
| Dashboard | Maestro / Admin | Resumen de cuentas de los estudiantes. |
| Grado | Maestro / Admin | Alumnos con total de dinero, bonus y fines. |
| Cuenta | Alumno | Ver y cobrar cuentas pendientes. |
| Estado de cuenta | Alumno | Historial de transacciones. |
| Trabajo | Alumno | Historial de trabajos y subida del reporte semanal en PDF. |
| Nómina | Maestro / Admin | Revisa reportes, paga salarios, descuentos, bonus y fines, autoriza préstamos, maneja la tienda y solicitudes de tarjetas. |
| Tienda | Alumno | Compra de premios al final de la unidad por transferencia o tarjeta NFC. |
| Perfil | Todos | Cambiar nombre y subir foto (no email ni contraseña). El CV (PDF) lo suben solo los alumnos. |

## Stack

**Frontend** (`ccs-bank-web/`)
- Vue 3 + Vite + TypeScript (`<script setup>`)
- Vue Router (guards por rol), Pinia (estado), Axios
- Deploy: Netlify (o Vercel). SPA con `public/_redirects` → `/* /index.html 200`

**Backend** (`ccs-bank-api/`)
- NestJS (TypeScript, Node 20+)
- Prisma ORM + Prisma Migrate
- Passport-JWT + bcrypt; guard de roles con decorador `@Roles()`
- class-validator / class-transformer en DTOs
- @nestjs/swagger para documentar la API
- Jest + Supertest para pruebas
- Deploy: Render o Railway con Docker

**Base de datos y archivos**
- **Supabase** usado **solo** como PostgreSQL y Storage (no se usa Supabase Auth ni RLS; la seguridad vive en NestJS).
- `DATABASE_URL` (pooler, puerto 6543, `pgbouncer=true`) para la app; `DIRECT_URL` (puerto 5432) para migraciones.
- Storage privado, accedido solo desde el backend con la service key: `reportes/`, `avatares/`, `cvs/`.
- Dos proyectos Supabase: `dev` y `prod`.

## Arquitectura

```
[ Vue 3 SPA ] ──HTTPS/JSON──> [ API NestJS ] ──Prisma──> [ Supabase PostgreSQL ]
  Netlify                       Render/Railway  └──────> [ Supabase Storage ]
```

### Módulos del backend (`src/modules/`)
`auth`, `usuarios`, `grados`, `banco`, `trabajos`, `nomina`, `tienda`, `tarjetas`, `archivos`, `auditoria`. Cada módulo: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`. Compartidos en `src/common/` (guards, decorators, filtros).

### Estructura del frontend (`src/`)
`lib/` (cliente HTTP), `router/`, `stores/`, `services/` (una por módulo), `layouts/` (AuthLayout, AppLayout), `views/` (`alumno/`, `docente/`, compartidas), `components/` (Base*), `assets/tokens.css`.

## Modelo de datos (entidades principales)

`Usuario` (carne, email, password, nombre, apellidos, rol, gradoId, fotoUrl, cvUrl) · `Grado` · `Cuenta` (saldo) · `Transaccion` (tipo, monto, concepto, creadoPor, fecha) · `CobroPendiente` (estado PENDIENTE/COBRADO) · `Trabajo` (nombre, descripcion, salarioSemanal) · `Asignacion` · `ReporteSemanal` (semana, archivoPath, estado PENDIENTE/APROBADO/RECHAZADO, comentario, revisadoPor) · `Prestamo` · `Producto` · `Compra` / `CompraItem` · `Tarjeta` (uidNfc, pinHash, estado) · `Auditoria`.

Enums: `Rol`, `TipoMovimiento` (SALARIO, BONUS, FINE, COMPRA, TRANSFERENCIA, PRESTAMO), `EstadoCobro`, `EstadoReporte`.

## Reglas de negocio clave

1. **El saldo nunca se edita a mano.** Todo movimiento crea una `Transaccion`; el saldo se actualiza dentro de `prisma.$transaction()` junto con ella.
2. Montos con `Decimal(12,2)`, nunca `float`.
3. Salarios y bonus se crean como `CobroPendiente`; el alumno los cobra en Cuenta. Los fines se descuentan.
4. Flujo semanal: alumno sube PDF → maestro aprueba/rechaza en Nómina → pago de salarios crea cobros pendientes → alumno cobra.
5. **Todos los trabajos entregan reporte semanal en PDF** con 4 partes: lo que hice, evidencias, dificultades, propuesta para la próxima semana.
6. Tienda: pago por transferencia (saldo) o tarjeta NFC (lector USB tipo teclado lee el UID + PIN del alumno). Validar saldo y stock.
7. Toda acción de dinero o aprobación se registra en `Auditoria`.
8. Los permisos se validan **siempre en el backend** (guards por rol y pertenencia al grado); el frontend solo oculta opciones.
9. Archivos: validar tipo (PDF/imagen) y tamaño; servir con URLs firmadas.

## Trabajos de la clase (13)

Presidente (Líder de Proyectos) · Vicepresidente (Coordinador de Ideas y Reconocimiento) · Asistente del Profesor · Secretario(a) (Gestor de Agenda) · Monitor de Asistencia (Analista de Asistencia) · Class Banker (Banquero de Clase CCS Bank) · Oficial de Disciplina (Oficial de Convivencia) · Tutor de Clase (Tutor de Apoyo Académico) · Encargado de la Pizarra (Diseñador Visual de Clase) · Coordinador de Celebraciones (Coordinador de Eventos) · Encargado de Materiales (Control de Inventario) · Material Deliverer (Logística de Materiales) · Timoteo (Líder Espiritual).

## Diseño

- Marca: escudo del colegio (azul marino `#1b2644` y dorado `#c9a877`).
- Tipografías: **Roboto Slab** (títulos) e **Inter** (interfaz).
- Login aprobado: "estilo portada" (nombre grande sobre fondo claro + tarjeta sobre bloques navy/dorado).
- Paleta final **pendiente de elegir por el cliente** entre:
  - **A · Institucional:** `#1b2644`, `#c9a877`, `#efe5d1`, fondo `#f7f5f0`
  - **B · Fresco:** `#1e4fa3`, `#e0a526`, `#dbe6f7`, fondo `#f2f5f9`
  - **C · Noche dorada (oscuro):** `#0d1324`, `#d4b27a`, `#161f38`
- Colores como variables CSS en `assets/tokens.css`. Texto con contraste mínimo 4.5:1.
- Idioma de la interfaz: español (trato de "tú").

## Fases

0. Análisis y diseño · 1. Configuración base y deploy · 2. Auth y usuarios · 3. Núcleo bancario · 4. Trabajos y reportes · 5. Nómina · 6. Tienda y NFC · 7. Dashboard y Grado · 8. Pruebas y piloto · 9. Lanzamiento.

**Estado actual:** inicio de la Fase 1.

## Convenciones

- Código, nombres de variables y commits en inglés o español de forma consistente por proyecto (definir al inicio); textos de UI en español.
- Variables sensibles solo en `.env` (nunca en el repo ni en el frontend): `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.
- Frontend solo conoce `VITE_API_URL`.
