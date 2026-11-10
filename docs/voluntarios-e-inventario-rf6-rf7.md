# 🐾 RF6 y RF7 — Módulos de Voluntarios/Turnos e Inventario de Insumos

Implementación completa e integral para el sistema **Huellas Sin Hogar**, correspondiente a los requisitos funcionales **RF6 (Módulo de voluntarios y turnos)** y **RF7 (Módulo de inventario de insumos)** asignados a Benjamín Jara.

---

## 📌 Requisitos Funcionales y Reglas de Negocio

### 📦 Requisito 7: Módulo de Inventario de Insumos (INV)

> *"El sistema debe permitir al staff, veterinaria y voluntarios avanzados controlar las existencias de insumos mediante el registro clasificado de entradas por donaciones o compras y salidas por consumo o vinculación a tratamientos médicos, restringiendo la consulta y edición de fármacos exclusivamente al personal autorizado y prohibiendo saldos negativos, logrando que el stock se actualice en tiempo real y emita alertas automáticas al alcanzar el stock mínimo o ante vencimientos próximos."*

1. **Control de Acceso y Roles:**
   - **Gestión general de inventario:** Autorizada para Staff (`DIRECTORA`, `COORDINADOR`, `ENCARGADA_ADOPCIONES`), Veterinaria (`VETERINARIA`) y Voluntarios Avanzados (`VOLUNTARIO_AVANZADO`). Los voluntarios novatos tienen denegada la modificación de existencias.
   - **Restricción estricta de Fármacos y Medicamentos:**
     - La consulta y edición de insumos clasificados como fármacos/medicamentos está restringida **exclusivamente al personal médico/autorizado** (`VETERINARIA` y `DIRECTORA`).
     - Al listar insumos, si el usuario no tiene rol clínico autorizado, los fármacos son filtrados y omitidos automáticamente en la consulta SQL.
     - Cualquier intento de creación, edición, movimiento o consulta directa por ID de un fármaco por parte de personal no autorizado es rechazado con **HTTP 403 Forbidden**.
2. **Registro Clasificado de Movimientos:**
   - **Entradas:** Clasificadas obligatoriamente en `DONACION` (con registro de donante/organización) o `COMPRA` (con registro de proveedor/distribuidora). Admite además lote y fecha de vencimiento.
   - **Salidas:** Clasificadas en `CONSUMO` (consumo interno del refugio en alimentación, aseo, etc.) o `TRATAMIENTO_MEDICO` (vinculación a la ficha de un animal albergado para suministrar su tratamiento clínico).
3. **Prohibición Estricta de Saldos Negativos y Stock en Tiempo Real:**
   - El sistema valida que ninguna salida supere el stock disponible del insumo. De intentarlo, la operación se rechaza con **HTTP 400 Bad Request** (*"Operación rechazada: Stock insuficiente. No se permiten saldos negativos"*).
   - Las operaciones de entrada y salida se ejecutan mediante transacciones atómicas (`prisma.$transaction`), actualizando el stock y la fecha de vencimiento en tiempo real e insertando el registro en `movimientos_inventario`.
4. **Alertas Automáticas en Tiempo Real:**
   - **Alerta de Stock Crítico:** Disparada cuando `stock <= stockMinimo` (con estado `CRITICO` o `AGOTADO` si `stock === 0`).
   - **Alerta de Vencimiento Próximo:** Disparada cuando `fechaVencimiento` se encuentra dentro de los próximos 30 días (`VENCIMIENTO_PROXIMO`) o si la fecha ya caducó (`VENCIDO`).
   - Alimentación en vivo tanto en el catálogo de inventario como en los indicadores del Dashboard Operativo.
5. **Auditoría Inmutable:**
   - Cada creación, modificación de stock, movimiento y baja lógica genera automáticamente una entrada en la bitácora inmutable de auditoría (`registrarAuditoria`).

---

### 🤝 Requisito 6: Módulo de Voluntarios y Turnos (VOL)

> *"El sistema debe permitir que cada voluntario gestione de forma individual su propia inscripción a los turnos, mientras que un usuario con rol de coordinador podrá administrar y modificar la matriz completa de todos los voluntarios. Esta gestión se realizará mediante una matriz interactiva por áreas y franjas horarias, restringiendo la inscripción previa obligatoria sin sobrecupos ni cruces de horarios, validando permutas aprobadas por ambas partes y reservando tareas críticas solo a personal avanzado, con el fin de dejar la planificación semanal confirmada, la bitácora habilitada y alertar automáticamente ante turnos descubiertos."*

1. **Autonomía Individual vs. Coordinación Centralizada:**
   - **Voluntarios individuales (`VOLUNTARIO_NOVATO`, `VOLUNTARIO_AVANZADO`):**
     - Gestionan su propia inscripción de forma autónoma (inscribirse individualmente o cancelar su inscripción a turnos futuros).
     - Proponen solicitudes de permuta de sus turnos a otros voluntarios.
     - Responden (aprueban o rechazan) permutas dirigidas a ellos.
     - Registran notas de asistencia y bitácora en turnos donde tengan inscripción previa obligatoria.
   - **Coordinador (`DIRECTORA`, `COORDINADOR`):**
     - Administra y modifica la matriz completa de todos los voluntarios.
     - Puede crear turnos, definir cupos máximos, marcar tareas críticas y asignar o desasignar a cualquier voluntario.
     - Confirma la planificación semanal (`estadoPlanificacion = 'CONFIRMADA'`).
2. **Matriz Interactiva Semanal:**
   - Distribuida por días de la semana (`Lunes` a `Domingo`), franjas horarias (`Mañana`: 08:00 - 13:00, `Tarde`: 14:00 - 19:00) y áreas funcionales (`Paseos`, `Limpieza`, `Alimentación`, `Atención Veterinaria`, etc.).
   - Visualización de aforo por turno (`X / Y cupos`), avatares de voluntarios inscritos y badges de estado.
3. **Inscripción Previa Obligatoria:**
   - Es requisito mandatorio estar previamente inscrito de forma confirmada en un turno para tener habilitado el registro en la bitácora.
4. **Sin Sobrecupos:**
   - Cada bloque de turno cuenta con un `cupoMaximo` estricto. Si las inscripciones activas alcanzan el aforo máximo, el sistema bloquea nuevas inscripciones con **HTTP 400 Bad Request** (*"Sobrecupo no permitido"*).
5. **Sin Cruces de Horarios:**
   - El sistema comprueba que el voluntario no posea otra inscripción activa en el mismo día y en la misma franja horaria. Si se detecta solapamiento, se deniega la inscripción con **HTTP 400** (*"Cruce de horarios detectado"*).
6. **Tareas Críticas Reservadas a Personal Avanzado:**
   - Aquellos turnos marcados con `esCritica: true` o pertenecientes a áreas clínicas/quirúrgicas/cuarentena están restringidos. Solo voluntarios con rol `VOLUNTARIO_AVANZADO`, `VETERINARIA`, `DIRECTORA` o `COORDINADOR` pueden ser asignados o auto-inscribirse. Los novatos son rechazados con **HTTP 403 Forbidden**.
7. **Permutas Validadas por Ambas Partes:**
   - Flujo de dos pasos: el solicitante genera la permuta (`aprobadoSolicitante = true`, estado `PENDIENTE`).
   - El voluntario destinatario evalúa la solicitud: al pulsar **Aprobar** (`aprobadoDestinatario = true`), el backend ejecuta un intercambio atómico de las inscripciones en los turnos respectivos y actualiza la matriz. Si rechaza, la permuta queda `RECHAZADA` y los turnos no se alteran.
8. **Planificación Semanal Confirmada, Bitácora Habilitada y Alertas de Turnos Descubiertos:**
   - El Coordinador puede fijar la semana mediante el botón **Confirmar Planificación Semanal**.
   - Se habilita la bitácora para registrar tareas completadas, incidentes y novedades del turno.
   - Se emite alerta automática en el panel y en el Dashboard ante **Turnos Descubiertos** (`inscritos === 0`).

---

## 🗄️ Modelo de Base de Datos y Migración

Se añadió la migración:
`backend/prisma/migrations/20261110000200_rf6_rf7_voluntarios_inventario/migration.sql`

### Nuevas Tablas y Relaciones:
- `insumos`: ampliada con `unidad`, `esFarmaco`, `fechaVencimiento`, `lote`, `ubicacion`, `actualizadoEn`.
- `movimientos_inventario`: registros clasificados de `ENTRADA` y `SALIDA`, con subtipos `DONACION`, `COMPRA`, `CONSUMO`, `TRATAMIENTO_MEDICO`, `MERMA`, `AJUSTE`, vinculación a `animales` y `usuarios`.
- `turnos`: ampliada con `esCritica`, `cupoMaximo`, `estadoPlanificacion`, `horaInicio`, `horaFin`, `observaciones`.
- `inscripciones_turnos`: asociación de voluntarios a turnos sin sobrecupos ni cruces de horarios.
- `permutas_turnos`: solicitudes de intercambio validadas por ambas partes.
- `bitacoras_turnos`: bitácoras operativas habilitadas con inscripción previa obligatoria.

---

## 🌐 Endpoints de la API REST

### Inventario (`/api/insumos`)
| Método | Ruta | Roles Permitidos | Descripción |
| --- | --- | --- | --- |
| `GET` | `/api/insumos` | Staff, Vet, Avanzado | Listar insumos (fármacos excluidos para no clínicos) |
| `GET` | `/api/insumos/alertas` | Staff, Vet, Avanzado | Alertas de stock crítico y vencimientos próximos |
| `GET` | `/api/insumos/:id` | Staff, Vet, Avanzado | Detalle de insumo (fármacos exigen rol clínico) |
| `POST` | `/api/insumos` | Staff, Vet, Avanzado | Crear insumo (fármacos exigen rol clínico) |
| `PUT` | `/api/insumos/:id` | Staff, Vet, Avanzado | Editar insumo |
| `DELETE` | `/api/insumos/:id` | Staff, Vet, Avanzado | Baja lógica del insumo |
| `POST` | `/api/insumos/:id/movimientos` | Staff, Vet, Avanzado | Registro clasificado de movimientos (saldo $\ge 0$) |
| `GET` | `/api/insumos/:id/movimientos` | Staff, Vet, Avanzado | Historial de movimientos del insumo |

### Turnos y Voluntarios (`/api/turnos`)
| Método | Ruta | Roles Permitidos | Descripción |
| --- | --- | --- | --- |
| `GET` | `/api/turnos/matriz` | Todos los roles activos | Matriz semanal interactiva por días y franjas |
| `GET` | `/api/turnos/alertas-descubiertos` | Todos los roles activos | Alertas de turnos sin voluntarios |
| `GET` | `/api/turnos/directorio` | Todos los roles activos | Directorio de voluntarios y turnos asignados |
| `POST` | `/api/turnos` | Coordinador / Directora | Crear turno en la matriz semanal |
| `PUT` | `/api/turnos/:id` | Coordinador / Directora | Modificar configuración del turno |
| `DELETE` | `/api/turnos/:id` | Coordinador / Directora | Eliminar turno de la matriz |
| `POST` | `/api/turnos/confirmar-planificacion` | Coordinador / Directora | Confirmar planificación semanal completa |
| `POST` | `/api/turnos/:id/inscribirse` | Voluntarios / Coordinador | Autogestión individual (valida cupo, cruce y criticidad) |
| `DELETE` | `/api/turnos/:id/desinscribirse` | Voluntarios / Coordinador | Cancelar inscripción a turno |
| `POST` | `/api/turnos/permutas` | Voluntarios | Solicitar permuta de turno a compañero |
| `GET` | `/api/turnos/permutas` | Voluntarios / Coordinador | Listar permutas enviadas y recibidas |
| `PUT` | `/api/turnos/permutas/:id/responder` | Destinatario / Coord. | Responder permuta (`APROBAR` o `RECHAZAR`) |
| `POST` | `/api/turnos/:id/bitacora` | Voluntario Inscrito | Registro en bitácora (inscripción previa obligatoria) |
| `GET` | `/api/turnos/:id/bitacoras` | Todos los roles activos | Ver bitácoras del turno |

---

## 🧪 Pruebas Automatizadas

Se crearon suites de validación y pruebas de integración:
- `backend/tests/insumo.schema.test.js`
- `backend/tests/insumo.integration.test.js`
- `backend/tests/turno.schema.test.js`
- `backend/tests/turno.integration.test.js`

Para ejecutar las pruebas con base local de pruebas PostgreSQL:
```sh
TEST_DATABASE_URL='postgresql://usuario@localhost:5432/huellas_test' node --test backend/tests/insumo.schema.test.js backend/tests/turno.schema.test.js backend/tests/insumo.integration.test.js backend/tests/turno.integration.test.js
```
