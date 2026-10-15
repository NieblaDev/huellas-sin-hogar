# 🐾 Huellas Sin Hogar — Implementación PERN Stack

Sistema integral de gestión de refugios animales basado en el stack **PERN (PostgreSQL, Express, React, Node.js)** con **Prisma ORM**, validaciones con **Zod** y diseño fiel a [Prototipo.html](file:///c:/Users/nbla/dev/huellas-sin-hogar/Prototipo.html).

---

## 📌 Requisitos Implementados

### 🏷️ Requisito 1: Módulo de Caniles y Traslados
* **Gestión Visual de Caniles:** Mapa visual interactivo con estados (`LIBRE`, `OCUPADO`, `CUARENTENA`, `MANTENIMIENTO`).
* **Reglas de Asignación y Capacidad:**
  * El miembro del staff autenticado (`DIRECTORA`, `VETERINARIA`, `VOLUNTARIO_AVANZADO`, `VOLUNTARIO_NOVATO`) asigna o reubica animales.
  * Validación estricta: solo se permite si el canil destino tiene capacidad libre.
  * **Motivo del movimiento** y **responsable** obligatorios para cada cambio.
  * Actualización en tiempo real de la ubicación en la ficha del animal.
* **Alerta Visual de Sobrecupo:**
  * Si la ocupación total supera el **90%**, el sistema despliega un banner de alerta crítica roja recomendando derivaciones.
* **Traslados Externos (Protectoras Aliadas u Hogares Temporales):**
  * Solicitud de traslado externo con datos de destino (contacto, dirección y motivo).
  * **Aprobación de la Directora:** Solo el rol `DIRECTORA` puede autorizar o rechazar solicitudes externas. Al aprobarse, se libera el canil de origen y se actualiza la ficha del animal.

### 📊 Requisito 2: Panel de Indicadores (Dashboard Operativo)
* **Indicadores Clave en Tiempo Real:**
  * Total de animales albergados.
  * Caniles libres y porcentaje de ocupación con aviso visual de sobrecupo.
  * Stock crítico de insumos (aquellos con cantidad $\le$ stock mínimo).
  * Turnos de voluntariado desatendidos / descubiertos de la semana.
* **Alertas Prioritarias en Tiempo Real:**
  * Alertas consolidadas según urgencias operativas (sobrecupo, insumos críticos, traslados pendientes, turnos sin cubrir).
* **Gráficas y Tendencias de Solo Lectura:**
  * Distribución por especie (perros / gatos).
  * Clasificación clínica (Normal, Condición Especial, Crítico).
  * **Restricción estricta:** No permite modificación directa de registros desde las gráficas.
* **Filtrado por Rol:**
  * El personal operativo (`VETERINARIA`, `VOLUNTARIO`) visualiza métricas operativas.
  * La `DIRECTORA` cuenta con acceso a aprobación de traslados pendientes y los últimos registros de auditoría.

### 🛡️ Requisito 3: Auditoría y Trazabilidad Inmutable
* **Registro Automático y Permanente:**
  * Cada creación (`CREACION`), modificación (`MODIFICACION`) y baja lógica (`BAJA_LOGICA`) realizada sobre datos sensibles (Fichas de Animales, Postulantes de Adopción, Inventario/Insumos, Caniles y Traslados) queda persistida inmediatamente.
  * Campos guardados: Fecha, Hora, Usuario responsable (ID, nombre, correo), Entidad afectada, Valor anterior (`JSON`) y Nuevo valor (`JSON`).
* **Baja Lógica:**
  * Los registros no se borran físicamente de la base de datos; se marcan con `activo = false` y se registra la baja en la bitácora.
* **Acceso y Restricciones Estrictas:**
  * Módulo exclusivo para el rol `DIRECTORA` (`requireRole('DIRECTORA')`).
  * **Bitácora de solo lectura:** Endpoints exclusivamente `GET`; la API bloquea y no expone métodos `PUT`, `POST` ni `DELETE` sobre las auditorías para garantizar inmutabilidad.
  * **Filtros Avanzados:** Por usuario responsable, entidad afectada y rango de fechas (desde / hasta).
  * **Visor de Diferencias (Diff):** Modal para comparar el valor previo y el nuevo valor del cambio registrado.

---

## 📂 Estructura de Carpetas

```text
huellas-sin-hogar/
├── backend/
│   ├── index.js                     # Servidor Express y middleware global
│   ├── package.json                 # Dependencias Node/Express/Prisma
│   ├── prisma/
│   │   ├── schema.prisma            # Modelos: Usuario, Animal, Canil, Traslado, Postulante, Insumo, Turno, Auditoria
│   │   └── seed.js                  # Carga inicial de usuarios, caniles, animales, turnos e insumos
│   └── src/
│       ├── config/
│       │   └── prisma.js            # Instancia de PrismaClient
│       ├── controllers/
│       │   ├── animal.controller.js
│       │   ├── audit.controller.js  # Solo lectura de auditoría
│       │   ├── auth.controller.js
│       │   ├── canil.controller.js   # Asignación de caniles y aprobación de traslados
│       │   ├── dashboard.controller.js
│       │   ├── insumo.controller.js
│       │   └── postulante.controller.js
│       ├── middlewares/
│       │   ├── auth.middleware.js   # JWT y control de roles (requireRole)
│       │   └── validate.middleware.js # Validación con Zod
│       ├── routes/
│       │   ├── animal.routes.js
│       │   ├── audit.routes.js
│       │   ├── auth.routes.js
│       │   ├── canil.routes.js
│       │   ├── dashboard.routes.js
│       │   ├── insumo.routes.js
│       │   ├── postulante.routes.js
│       │   └── index.js
│       ├── schemas/
│       │   ├── animal.schema.js
│       │   ├── auth.schema.js
│       │   └── canil.schema.js
│       └── services/
│           ├── animal.service.js
│           ├── audit.service.js     # Servicio central de bitácora
│           ├── auth.service.js
│           ├── canil.service.js     # Lógica de asignación, reubicación y traslados
│           ├── dashboard.service.js # Métricas y alertas consolidadas
│           ├── insumo.service.js
│           └── postulante.service.js
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx                  # Navegación principal (Sidebar con Inicio, Caniles, Registro, Auditoría)
        ├── api/
        │   └── config.js            # URL base y headers JWT
        └── components/
            ├── AnimalCatalogo.jsx   # Listado con canil asignado y baja lógica
            ├── AnimalFormModal.jsx  # Modal de nuevo animal con asignación de canil
            ├── AuditoriaModulo.jsx  # [Requisito 3] Bitácora inmutable con filtros y modal diff
            ├── CanilesModulo.jsx    # [Requisito 1] Mapa de caniles, reubicaciones y traslados
            ├── DashboardModulo.jsx  # [Requisito 2] KPIs, tendencias y alertas operativas
            └── Login.jsx            # Autenticación con soporte de roles
```

---

## 👥 Cuentas de Acceso Preconfiguradas (Seed)

| Rol | Correo | Contraseña | Capacidades |
|---|---|---|---|
| **Directora** | `directora@huellas.cl` o `staff@huellas.cl` | `admin123` | Control total, aprobación de traslados externos, panel gerencial y bitácora de auditoría inmutable. |
| **Veterinaria** | `veterinaria@huellas.cl` | `admin123` | Asignación y reubicación de caniles, registro médico, panel operativo. |
| **Voluntario** | `voluntario@huellas.cl` | `admin123` | Solicitud y registro de movimientos de canil, consulta de catálogo y panel operativo. |

---

## 🚀 Puesta en Marcha

### 1. Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init # o npx prisma db push
npm run prisma:seed
npm run dev
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
