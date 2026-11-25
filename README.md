# 🐾 Huellas Sin Hogar — Portal del Staff

[![Stack](https://img.shields.io/badge/Stack-PERN-2b5c3b?style=for-the-badge)](https://github.com/NieblaDev/huellas-sin-hogar)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

**Huellas Sin Hogar** es una plataforma integral de gestión operativa y médica para refugios de animales y centros de rescate. Diseñada bajo una arquitectura cliente-servidor basada en el stack **PERN** *(PostgreSQL, Express, React, Node.js)* con **Prisma ORM** y validación estricta de esquemas mediante **Zod**.

El sistema centraliza el control de ingresos, ocupación de caniles, expedientes clínicos, adopciones, rondas de cuidado, gestión de insumos, matriz de voluntariado y trazabilidad inmutable mediante bitácora de auditoría.

---

## 📑 Tabla de Contenidos

- [Módulos del Sistema](#-módulos-del-sistema)
- [Sistema de Navegación y Diseño Armonizado](#-sistema-de-navegación-y-diseño-armonizado)
- [Control de Acceso y Roles (RBAC)](#-control-de-acceso-y-roles-rbac)
- [Cuentas de Acceso Preconfiguradas](#-cuentas-de-acceso-preconfiguradas-seed)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Puesta en Marcha y Configuración](#-puesta-en-marcha-y-configuración)
  - [Prerrequisitos](#prerrequisitos)
  - [1. Backend](#1-backend)
  - [2. Frontend](#2-frontend)
- [Seguridad y Reglas de Negocio](#-seguridad-y-reglas-de-negocio)

---

## 🧩 Módulos del Sistema

### 1. 📊 Inicio (Dashboard Operativo en Tiempo Real)
- **Indicadores Clave (KPIs):** Conteo de animales albergados, caniles ocupados/libres, porcentaje de ocupación, insumos en stock crítico y turnos descubiertos.
- **Alertas Prioritarias:** Avisos automáticos ante sobrecupo (>90%), medicamentos por vencer y solicitudes pendientes.
- **Tendencias y Distribución:** Gráficas de solo lectura con desglose por especie (perros / gatos) y clasificación clínica (Normal, Condición Especial, Crítico).
- **Notificaciones del Staff:** Campana con listado desplegable de eventos prioritarios en vivo.

### 2. 🐶 Registro de Ingreso, Fichas de Animales y Reportes
- **Catálogo de Animales:** Buscador por nombre/microchip, filtros por especie, sexo, estado de salud y canil asignado.
- **Formulario de Ingreso:** Alta con fotografía, datos biométricos, causal de ingreso (Rescate, Abandono, Decomiso) y asignación automática de canil libre.
- **Ficha Médica y Expediente Individual:** Descarga instantánea de la ficha del animal en formato PDF o CSV.
- **Módulo de Reportes Consolidados (Exclusivo Dirección):** Generación y exportación de informes globales con filtros por rango de fechas, condición médica y formato.
- **Novedades del Equipo:** Bandeja de notificaciones internas de ingresos y altas recientes.

### 3. 🚪 Caniles y Traslados
- **Mapa Visual Interactivo:** Cuadrícula de caniles con código de color según estado (`LIBRE`, `OCUPADO`, `CUARENTENA`, `MANTENIMIENTO`).
- **Asignación y Reubicación Interna:** Movimiento seguro de animales validando capacidad máxima y registrando motivo obligatorio y responsable.
- **Alerta de Sobrecupo:** Banner rojo preventivo cuando la ocupación total supera el 90%.
- **Traslados Externos:** Solicitud de derivación a protectoras aliadas u hogares temporales con flujo de aprobación restringido a la **Dirección**.

### 4. 🏡 Gestión de Adopciones y Post-Adopción
- **Flujo Integral de Solicitudes:** Registro y evaluación de adoptantes a través de etapas ordenadas (Recepción, Entrevista, Visita, Aprobación/Rechazo).
- **Seguimiento Post-Adopción:** Matriz de control periódica (7 días, 1 mes, 3 meses, 6 meses, 1 año) con alertas de reprogramación o pérdida de contacto.
- **Protocolo de Devoluciones:** Proceso formal con registro de causal, reintegro a canil y actualización automática del estado del animal.

### 5. 📋 Rondas y Cuidados Diarios
- **Panel de Tareas del Turno:** Lista de verificación de necesidades diarias por turno (mañana, tarde, noche) para alimentación, medicación y paseos.
- **Historial de Cuidados por Animal:** Bitácora operativa con registros históricos de alimentación especial, limpiezas y observaciones de comportamiento.
- **Indicaciones Médicas Operativas:** Publicación de pautas de cuidado por parte del equipo veterinario.

### 6. 🩺 Salud y Vacunación
- **Alertas Sanitarias:** Monitor de vacunas vencidas, desparasitaciones pendientes y tratamientos en curso.
- **Historial Clínico Centralizado:** Registro de diagnósticos, cirugías, tratamientos farmacológicos y evolución de peso.
- **Atención y Vacunación:** Registro de aplicaciones con validación de lotes y fechas de refuerzo recomendadas.

### 7. 📦 Inventario de Insumos
- **Control de Existencias:** Monitoreo en tiempo real de alimentos, insumos de limpieza y medicamentos.
- **Gestión Segura de Fármacos:** Control estricto con acceso restringido para personal médico veterinario.
- **Alertas de Stock Mínimo y Vencimiento:** Detección de agotamiento inminente y productos próximos a caducar (<30 días).
- **Movimientos Clasificados:** Entradas (donaciones, compras) y Salidas (consumo regular, tratamientos) con prohibición estricta de saldos negativos.

### 8. 🤝 Voluntarios y Matriz de Turnos
- **Matriz Semanal Interactiva:** Cuadrícula de horarios (Lunes a Domingo / Mañana, Tarde, Noche) con conteo de cupos disponibles y cubiertos.
- **Autogestión de Inscripciones:** Inscripción y baja de turnos según el nivel de habilitación del voluntario.
- **Permutas de Turnos:** Sistema de intercambio entre voluntarios con aceptación bilateral obligatoria.
- **Bitácora y Directorio:** Historial de servicio comunitario y directorio del personal con sus roles y vías de contacto.

### 9. 🛡️ Auditoría y Trazabilidad Inmutable
- **Bitácora Histórica Automática:** Registro permanente de toda creación (`CREACION`), modificación (`MODIFICACION`) y baja lógica (`BAJA_LOGICA`) sobre entidades sensibles.
- **Inmutabilidad Garantizada:** Módulo de solo lectura (`GET`); la API bloquea modificaciones o eliminaciones de los registros de auditoría.
- **Visor de Diferencias (Diff):** Modal interactivo para contrastar el valor previo (`valorAnterior`) y el nuevo valor (`valorNuevo`) de cada cambio.
- **Filtros Avanzados:** Búsqueda por usuario responsable, entidad afectada y rango temporal.

---

## 🎨 Sistema de Navegación y Diseño Armonizado

La interfaz cuenta con un sistema de diseño propio y centralizado ([`portal-controls.css`](file:///c:/Users/nbla/dev/huellas-sin-hogar/frontend/src/styles/portal-controls.css)):
- **Paleta Cromática Unificada:** Basada en tonos naturales con Verde Refugio (`--portal-primary: #3f6c52`), neutros suaves y códigos semánticos claros para estados de éxito, advertencia y peligro.
- **Contenedor Maestro de Página (`.portal-page-container`):** Estandarización a un ancho máximo común (`1200px`) y espaciados homogéneos que eliminan transiciones bruscas al cambiar de vista.
- **Subnavegación Estándar (`.portal-subtabs`):** Barra de pestañas secundarias estilo píldora presente en todas las vistas de gestión interna (Registro de Animales, Caniles, Adopciones, Cuidados, Salud, Inventario, Voluntarios y Auditoría).
- **Barra Lateral Reactiva (`.portal-nav-btn`):** Menú fijo con soporte de *hover*, estados activos delimitados y adaptación responsiva para pantallas móviles.

---

## 🔐 Control de Acceso y Roles (RBAC)

El acceso a las rutas del backend y los componentes del frontend está regulado mediante un sistema de Roles basado en JWT:

| Rol | Alcance y Capacidades Principales |
| :--- | :--- |
| **`DIRECCION`** | Control total. Gestiona la matriz semanal, asigna turnos a otras personas y resuelve permutas. Aprueba traslados externos, genera reportes consolidados y consulta la auditoría. |
| **`PERSONAL_VETERINARIO`** | Fichas clínicas, registro de medicamentos/vacunas, manejo de fármacos en inventario y definición de pautas de cuidado. |
| **`PERSONAL_ADOPCIONES`** | Evaluación de postulantes, gestión del ciclo de adopciones, visitas, seguimientos y devoluciones. |
| **`VOLUNTARIO_AVANZADO`** | Registro de rondas de cuidado, movimientos de caniles, soporte en inventario y turnos de mayor responsabilidad. |
| **`VOLUNTARIO_NOVATO`** | Visualización de turnos, registro de asistencia, consulta de catálogo y realización de rondas básicas asignadas. |

El campo **Sexo** define cómo se muestra el nombre del rol. Dirección puede actualizarlo en **Usuarios y Perfiles**. En una base existente, ejecuta `npm run prisma:deploy` desde `backend/` para aplicar la migración, que asigna trato neutro a los perfiles existentes y reclasifica las antiguas cuentas de coordinación como `VOLUNTARIO_NOVATO`.

---

## 👥 Cuentas de Acceso Preconfiguradas (Seed)

El script de inicialización (`seed.js`) crea las siguientes cuentas de prueba listas para usar:

| Rol | Correo Electrónico | Contraseña |
| :--- | :--- | :--- |
| **Directora** | `directora@huellas.cl` | `admin123` |
| **Veterinaria** | `veterinaria@huellas.cl` | `admin123` |
| **Voluntario Avanzado** | `voluntario.avanzado@huellas.cl` | `admin123` |
| **Voluntario Novato** | `voluntario@huellas.cl` | `admin123` |

---

## 📂 Estructura del Proyecto

```text
huellas-sin-hogar/
├── backend/
│   ├── package.json                 # Dependencias y scripts del backend
│   ├── .env.example                 # Configuración local de la API
│   ├── ecosystem.config.cjs         # PM2, HTTP interno en el puerto 80
│   ├── prisma/
│   │   ├── schema.prisma            # Esquema relacional de la base de datos PostgreSQL
│   │   ├── migrations/              # Historial de migraciones de PostgreSQL
│   │   └── seed.js                  # Carga de datos iniciales (usuarios, caniles, animales, turnos)
│   ├── src/
│   │   ├── app.js                   # Configuración de Express y montaje de la API
│   │   ├── server.js                # Conexión a PostgreSQL y arranque HTTP
│   │   ├── config/                  # Cliente Prisma y configuraciones del entorno
│   │   ├── controllers/             # Manejadores de peticiones HTTP
│   │   ├── middlewares/             # Autenticación, validación Zod y errores HTTP
│   │   ├── routes/                  # Definición de endpoints REST organizados por módulo
│   │   ├── schemas/                 # Esquemas Zod para sanitización y validación de entrada
│   │   ├── services/                # Capa de lógica de negocio y persistencia
│   │   └── utils/                   # Funciones utilitarias auxiliares
│   └── uploads/                     # Almacenamiento local de fotografías de animales
│
└── frontend/
    ├── index.html                   # HTML base de la SPA
    ├── package.json                 # Dependencias y scripts de Vite / React
    ├── .env.example                 # URL base de la API
    ├── ecosystem.config.cjs         # PM2, Vite Preview en el puerto interno 443
    ├── vite.config.js               # Configuración de empaquetado Vite
    ├── public/                      # Recursos estáticos y logotipos
    └── src/
        ├── main.jsx                 # Bootstrap de la aplicación React
        ├── App.jsx                  # Tema, navegación y rutas del portal
        ├── pages/                   # Pantallas asociadas a rutas URL
        ├── components/              # Componentes de dominio y controles reutilizables
        │   └── ui/                  # Wrappers de Material UI
        ├── context/                 # Sesión y avisos compartidos
        ├── hooks/                   # Integración de React Hook Form y Zod
        ├── schemas/                 # Esquemas de formularios y pruebas Vitest
        ├── services/                # Cliente HTTP y operaciones por entidad
        ├── styles/                  # Estilos del portal y tokens de diseño
        └── utils/                   # Manejo de sesiones en LocalStorage
```

---

## 🚀 Puesta en Marcha y Configuración

### Prerrequisitos
- **Node.js** 24 LTS.
- **npm**.
- Servidor **PostgreSQL** activo y accesible.

---

### 1. Backend

1. Entrar a la carpeta del backend e instalar dependencias:
   ```bash
   cd backend
   npm ci
   ```

2. Copiar `backend/.env.example` a `backend/.env` y completar `DATABASE_URL` y `JWT_SECRET`. Si cambias el puerto local, ajusta `PORT` y `VITE_API_URL` en el frontend.

3. Generar el cliente de Prisma y ejecutar las migraciones:
   ```bash
   npx prisma generate
   npm run prisma:deploy
   ```

4. Poblar la base de datos con los datos iniciales de prueba:
   ```bash
   npm run prisma:seed
   ```

5. Iniciar el servidor en modo desarrollo:
   ```bash
   npm run dev
   ```
   El backend escucha en el puerto configurado en `backend/.env`.

---

### 2. Frontend

1. En una nueva terminal, ingresar al directorio de frontend e instalar dependencias:
   ```bash
   cd frontend
   npm ci
   ```

   Copiar `frontend/.env.example` a `frontend/.env` y confirmar que `VITE_API_URL` incluya el puerto del backend y el prefijo `/api`.

2. Iniciar el servidor de desarrollo Vite:
   ```bash
   npm run dev
   ```
   *El frontend quedará disponible en `http://localhost:5173`.*

3. Abre tu navegador en `http://localhost:5173` e inicia sesión con cualquiera de las cuentas de prueba.

### Pruebas

- En `frontend/`, ejecuta `npm run test:run` para comprobar los esquemas y los controles de interfaz.
- En `backend/`, ejecuta `npm run test:unit` para probar esquemas y middlewares. Para la suite completa, configura `TEST_DATABASE_URL` con una base PostgreSQL local cuyo nombre incluya `test`, agrega `psql` al `PATH` y ejecuta `npm test`.

### Correo a protectoras aliadas

Ejecuta `npm run prisma:deploy` y `npm run prisma:generate` en `backend/`. Configura `SMTP_HOST`, `SMTP_PORT` y `SMTP_FROM` en `backend/.env`, junto con `SMTP_USER` y `SMTP_PASS` si el servidor requiere autenticación. Reinicia el backend para que procese los correos pendientes. Usa el puerto 465 para TLS directo o 587 para STARTTLS.

Al solicitar un traslado a una protectora aliada, ingresa su correo en el formulario. El sistema registra el traslado pendiente de aprobación y programa el envío de la ficha externa en PDF. El detalle del traslado muestra el estado del correo. Si el servidor de correo falla, el backend hace hasta tres intentos. Las solicitudes registradas antes del cambio conservan sus datos y se pueden consultar desde el historial.

---

## 🛡️ Seguridad y Reglas de Negocio

- **Baja Lógica Generalizada:** Las entidades principales no son eliminadas físicamente de la base de datos; su estado pasa a inactivo (`activo = false`) preservando su histórico.
- **Integridad de Caniles:** Un animal solo puede ser reubicado en caniles con capacidad disponible y estado no bloqueante.
- **Invariabilidad de Saldos en Inventario:** Las salidas de stock se rechazan si la cantidad solicitada supera las existencias disponibles (cero saldos negativos).
- **Acceso Exclusivo a Bitácora:** La bitácora de auditoría no admite modificaciones manuales ni borrados mediante peticiones HTTP.
- **Trazabilidad de Fármacos:** La dispensación y registro de medicamentos veterinarios requiere credenciales de personal clínico autorizado.

---

## 📄 Licencia

Este proyecto está desarrollado para fines académicos y comunitarios bajo la licencia **MIT**.

---

## Ejecución con PM2

- En `backend/`, configura `.env`, ejecuta `npm run prisma:deploy` y arranca con `npm run start:prod`. La API escucha en el puerto `80`.
- En `frontend/`, configura `VITE_API_URL` con la URL de la API accesible desde el navegador, ejecuta `npm run build` y arranca con `npm run start:prod`. Vite Preview sirve la SPA por HTTP en el puerto interno `443`.
