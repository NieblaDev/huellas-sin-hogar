# Instrucciones de implementación — Mejoras del módulo de Caniles

> **Documento para Codex.** Implementa estos cambios en `huellas-sin-hogar`. No rediseñes módulos ajenos a Caniles, no cambies roles ni reglas de negocio fuera de lo indicado, y mantén el español de la interfaz, los tokens CSS y la estructura actual. Antes de tocar código, ejecuta `git status` y `git diff`: hay trabajo en curso en el repositorio y **no debes revertir cambios ajenos**.
>

---

## 1. Objetivo

Agregar seis funcionalidades al módulo de Caniles:

1. **Cuarentena con cuenta regresiva**: fecha de término, días restantes, estado vencido y acción para finalizar.
2. **Drag & drop** de animales entre caniles.
3. **Historial por canil**: residentes, movimientos, cuarentenas y duración de estadías.
4. **Días que lleva cada animal en su canil**, visibles en tarjeta, ficha y etiqueta QR.
5. **Caniles grupales** (camadas de cachorros), con capacidad mayor a 1 y validación de compatibilidad.
6. **Etiquetas QR imprimibles** que abran en el celular la ficha del canil mostrando el nombre del animal o animales que lo ocupan.

Resultado: un mapa de caniles más informativo e interactivo, sin romper asignaciones, traslados externos, aprobaciones, auditoría, reportes ni notificaciones.

---

## 2. Estado actual (leer antes de implementar)

### 2.1 Archivos y puntos de entrada

| Capa | Archivo | Rol |
|---|---|---|
| Frontend | `frontend/src/pages/CanilesPage.jsx` (~1687 líneas) | Mapa, filtros, sub-pestañas, modales y bitácoras |
| Frontend | `frontend/src/services/canil.service.js` | Cliente HTTP de caniles |
| Frontend | `frontend/src/schemas/canil.schema.js` | Esquemas Zod de formularios |
| Frontend | `frontend/src/App.jsx` | Rutas planas; `*` redirige a `/dashboard` |
| Frontend | `frontend/src/components/AnimalFormModal.jsx` | Selector de canil al crear/editar animal |
| Frontend | `frontend/src/hooks/useLecturasNotificaciones.js` | Avisos leídos por usuario (campanita) |
| Backend | `backend/src/services/canil.service.js` | Ocupación, asignación, traslados |
| Backend | `backend/src/controllers/canil.controller.js` | Controladores HTTP |
| Backend | `backend/src/routes/canil.routes.js` | Endpoints `/api/caniles` |
| Backend | `backend/src/schemas/canil.schema.js` | Validación Zod del backend |
| Backend | `backend/src/services/salud.service.js` | `registrarCuarentena` clínica |
| Datos | `backend/prisma/schema.prisma` | `Animal`, `Canil`, `Traslado`, `CuarentenaAnimal`, `LecturaNotificacion` |
| Migraciones | `backend/prisma/migrations/` | Se aplican con `npm run prisma:deploy` |

### 2.2 Modelo actual relevante

```prisma
model Animal {
  canilId Int? @unique        // ← IMPIDE más de un animal por canil
  canil   Canil? @relation(fields: [canilId], references: [id], onDelete: SetNull)
}

model Canil {
  id        Int    @id @default(autoincrement())
  codigo    String @unique
  nombre    String
  sector    String @default("General")
  tipo      String @default("Perro")  // existe, pero la UI no lo usa
  capacidad Int    @default(1)        // existe, pero la UI siempre crea 1
  estado    EstadoCanil @default(LIBRE)
  animalAlojado Animal?               // relación 1:1 derivada del @unique
}

model CuarentenaAnimal {
  id               Int      @id @default(autoincrement())
  animalId         Int
  motivo           String
  canilAislamiento String?  // texto libre, NO es FK
  fechaInicio      DateTime @default(now())
  fechaFinEstimada DateTime
  fechaFinReal     DateTime?
  estado           EstadoCuarentena @default(ACTIVA) // ACTIVA | FINALIZADA | INTERRUMPIDA
  observaciones    String?
}
```

`Traslado` ya guarda movimientos internos (`tipo = INTERNO_CANIL`, `canilOrigenId`, `canilDestinoId`, `motivo`, `responsableId`, `fechaRegistro`) y externos (`PROTECTORA_ALIADA`, `HOGAR_TEMPORAL`). **No crear un modelo nuevo de historial**: usar `Traslado` y `CuarentenaAnimal`.

### 2.3 Comportamiento actual que hay que preservar

- `GET /api/caniles` devuelve `{ resumen, caniles }`. El resumen alimenta la campanita y la alerta de sobrecupo > 90%.
- `POST /api/caniles/asignar` asigna, reubica, libera y pone en cuarentena; el motivo solo es obligatorio para `CUARENTENA`.
- Al asignar se crea un `Traslado INTERNO_CANIL` con estado `COMPLETADO`.
- `DELETE /api/caniles/:id` solo elimina caniles sin animal.
- La cuarentena desde Caniles **hoy solo cambia `Canil.estado`**; no crea `CuarentenaAnimal`.
- La cuarentena clínica de `salud.service.js` sí crea `CuarentenaAnimal`, pero sin `canilId` y solo actualiza el canil del animal.
- Los traslados externos se aprueban por `DIRECCION`. **El envío de correo fue retirado**: `destinoEmail` se guarda como dato, pero no hay servicio de correo ni `nodemailer` que mantener.
- `frontend/src/components/AnimalFormModal.jsx` solo ofrece caniles con `estado === 'LIBRE'`.
- La campanita usa `useLecturasNotificaciones(claves)`: consulta `POST /api/lecturas-notificaciones/consultar`, marca con `PUT /api/lecturas-notificaciones`, y las claves deben cumplir `^(animales|caniles):[a-z0-9:-]+$` (minúsculas, máx. 100 caracteres; máximo 60 claves por consulta).
- Existe `frontend/tests/caniles-bitacoras.test.jsx`, que exige los botones **“Movimientos de Caniles”** y **“Traslados Externos”** y las tablas `Bitácora de Movimientos de Caniles` / `Bitácora de Traslados Externos`. No renombres esas sub-pestañas.
- Las rutas del backend se aplican en orden. **`GET /:id` debe declararse después de `GET /traslados`** (y de cualquier ruta estática) para que “traslados” no se interprete como id.
- Las migraciones se ejecutan con `cd backend && npm run prisma:deploy`; `prisma/migrate.js` hace dos pasadas para respetar dependencias históricas. La última migración existente es `20261125010000_lecturas_notificaciones`.

### 2.4 Impacto de quitar el 1:1

Revisa y adapta todos estos puntos (verifica rutas actuales con `rg "animalAlojado|canilId" backend/src frontend/src`):

- `backend/src/services/canil.service.js`: `getAllCaniles`, `asignarCanil` (incluye `animalAlojado`), liberación y `deleteCanil`.
- `backend/src/services/animal.service.js`: validación de canil al crear y al editar (~líneas 146-155 y ~330-350).
- `backend/src/services/devolucion.service.js`: asignación al devolver un animal y auditoría (`animalAlojadoId`).
- `backend/src/services/adopcionEtapa.service.js`: al adoptar pone `canilId: null` y el canil en `LIBRE` sin comprobar otros ocupantes.
- `backend/src/services/salud.service.js`: `registrarCuarentena` actualiza el canil a `CUARENTENA`.
- `frontend/src/pages/CanilesPage.jsx`: 14 referencias a `animalAlojado`.
- `frontend/src/components/AnimalFormModal.jsx`: filtro de caniles disponibles.
- `frontend/src/App.jsx`: pasa `canilesList` al modal de animal.

---

## 3. Decisiones obligatorias

1. **Canil grupal = `capacidad > 1`**. Sin modelo nuevo de grupo. `Canil.tipo` admite `Perro`, `Gato` o `Mixto`; se valida contra `Animal.especie`.
2. **Sin validación de edad**: `Animal.edad` es texto libre. Los grupos sirven para camadas; “Cachorros” se indica con el `sector`. No parsear edades.
3. **Cada animal sigue en un solo canil**. Solo se elimina el `@unique` de `Animal.canilId`; no se crea tabla intermedia.
4. **Compatibilidad obligatoria**: `canil.tipo === 'Mixto'` o igual a `animal.especie`. Canil en `MANTENIMIENTO` no recibe animales.
5. **Cuarentena individual**: solo `capacidad === 1` y un único ocupante. Un canil grupal no puede estar en cuarentena.
6. **Cuarentena = `CuarentenaAnimal`**. Agregar `canilId` (FK nullable) y mantener `canilAislamiento`. Unificar la lógica clínica y la de Caniles en un servicio compartido (sección 5.1).
7. **Días en canil** desde un campo nuevo `Animal.fechaIngresoCanil`. No calcular solo con `Traslado`: los animales que nunca se movieron quedarían sin fecha.
8. **Drag & drop** con `@dnd-kit/core`, no HTML5 nativo. Debe funcionar con mouse, teclado y touch.
9. **QR** generado en el frontend con el paquete `qrcode`; ruta nueva `/caniles/:canilId`. No crear endpoint de imágenes.
10. **Permisos**: cualquier persona autenticada puede ver, asignar, mover, crear y liberar. Finalizar cuarentena: `DIRECCION` y `PERSONAL_VETERINARIO`. Editar `capacidad` o `tipo`: `DIRECCION`. `requireRole` acepta varios roles como argumentos.
11. **Compatibilidad de API**: `GET /api/caniles` sigue devolviendo `animalAlojado` (primer ocupante) además de `animales`. No eliminar ese alias en esta entrega.
12. **Notificaciones**: reutilizar `useLecturasNotificaciones` y el backend de lecturas. No crear otro sistema de campanita ni una tabla nueva.
13. **Estilos**: reutilizar `portal-*`, `--portal-*`, `Button`, `Modal`, `Input`, `AnimalPhoto`, `AnimalSelect`. No agregar otra librería de UI.
14. **El código `C-01`, `C-02`, etc. es interno y NO debe verse en la interfaz de Caniles**. Se mantiene en la base de datos y puede seguir viniendo en la API por compatibilidad, pero está prohibido renderizarlo en tarjetas, modal de canil, historial, etiquetas QR, títulos, toasts, `aria-label`, textos de búsqueda o mensajes. Toda referencia visible al canil usa **nombre** (`Canil 5`) y **sector**. Los deep links y QR usan el `id` numérico, nunca el código.

---

## 4. Base de datos

### 4.1 Esquema propuesto

```prisma
model Animal {
  // ...
  canilId           Int?
  canil             Canil?    @relation(fields: [canilId], references: [id], onDelete: SetNull)
  fechaIngresoCanil DateTime?

  @@index([canilId])
}

model Canil {
  // ...
  tipo      String  @default("Mixto") // "Perro" | "Gato" | "Mixto"
  capacidad Int     @default(1)

  animales Animal[]
}

model CuarentenaAnimal {
  // ...
  canilId Int?
  canil   Canil? @relation(fields: [canilId], references: [id], onDelete: SetNull)

  @@index([animalId, estado])
  @@index([canilId, estado])
}
```

> Reemplaza `animalAlojado Animal?` por `animales Animal[]` en `Canil`. No dupliques la relación si Prisma ya la infiere.

### 4.2 Migración y backfill

Crear una migración nueva (nombre sugerido `caniles_grupales_cuarentena_historial`) con:

```bash
cd backend
npx prisma migrate dev --name caniles_grupales_cuarentena_historial
```

Verifica el SQL generado. Debe:

1. Quitar el índice único de `animales.canilId` (normalmente `animales_canilId_key`) y crear índice no único.
2. Agregar `animales.fechaIngresoCanil`, `cuarentenas_animales.canilId` y sus FKs/índices.
3. Cambiar el default de `caniles.tipo` a `Mixto` sin reescribir valores existentes.

Backfill (ajusta nombres si Prisma generó otros):

```sql
-- Tipo según el ocupante actual; queda Mixto si no hay ocupante.
UPDATE caniles c
SET tipo = a.especie
FROM animales a
WHERE a."canilId" = c.id AND a.especie IN ('Perro', 'Gato');

-- Fecha de ingreso: último traslado interno al canil actual o alta del animal.
UPDATE animales a
SET "fechaIngresoCanil" = COALESCE(
  (SELECT t."fechaRegistro"
   FROM traslados t
   WHERE t."animalId" = a.id
     AND t."canilDestinoId" = a."canilId"
     AND t.tipo = 'INTERNO_CANIL'
   ORDER BY t."fechaRegistro" DESC
   LIMIT 1),
  a."creadoEn"
)
WHERE a."canilId" IS NOT NULL;

-- Vincular cuarentenas activas al canil actual del animal (mejor esfuerzo).
UPDATE cuarentenas_animales q
SET "canilId" = a."canilId"
FROM animales a
WHERE q."animalId" = a.id
  AND q.estado = 'ACTIVA'
  AND q."canilId" IS NULL
  AND a."canilId" IS NOT NULL;
```

No edites migraciones ya publicadas. Prueba `migrate deploy` sobre una copia de la base sembrada y compara conteos antes/después.

### 4.3 Invariantes

- `animales_del_canil <= canil.capacidad`.
- Todas las especies del canil son compatibles con `canil.tipo`.
- `Canil.estado`:
  - `MANTENIMIENTO` solo manual; no se pisa automáticamente.
  - Con cuarentena activa vinculada → `CUARENTENA`.
  - Con ≥1 animal → `OCUPADO`.
  - Sin animales → `LIBRE`.
- Un animal no puede estar en dos caniles ni en dos cuarentenas `ACTIVA`.
- `fechaIngresoCanil` se actualiza solo al cambiar de canil; al quedar sin canil pasa a `null`.

---

## 5. Backend

### 5.1 Servicios compartidos

Crear `backend/src/services/canilOcupacion.js`:

```js
export const ocupacionDeCanil = (canil) => ({
  alojados: canil.animales.length,
  capacidad: canil.capacidad,
  libres: Math.max(0, canil.capacidad - canil.animales.length),
  porcentaje: canil.capacidad > 0 ? Math.round((canil.animales.length / canil.capacidad) * 100) : 0
});

export const validarIngresoAnimal = ({ animal, canil, animalesActuales }) => {
  // ErrorDominio(409, mensaje en español) para:
  // - mantenimiento
  // - capacidad llena
  // - especie incompatible
  // - animal adoptado/inactivo
  // - intento de cuarentena en canil grupal
};

export const sincronizarEstadoCanil = async (tx, canilId) => { /* ... */ };
export const contarAnimales = async (tx, canilId) => { /* ... */ };
```

Reglas de `sincronizarEstadoCanil`:

- Si está `MANTENIMIENTO`, no cambiar.
- Si hay `CuarentenaAnimal` con `estado = ACTIVA` y `canilId`, dejar `CUARENTENA`.
- Si hay animales, `OCUPADO`; si no, `LIBRE`.

Usar transacciones y `SELECT id FROM caniles WHERE id = ${id} FOR UPDATE` (patrón de `devolucion.service.js`) para evitar sobrecupo concurrente.

Crear `backend/src/services/cuarentena.service.js` con:

```js
export const iniciarCuarentena = async (tx, { animal, canil, motivo, fechaFinEstimada, observaciones, user }) => { ... };
export const finalizarCuarentena = async ({ canilId, animalId, observaciones, user, ip }) => { ... };
```

Debe usarlo **tanto** Caniles como `salud.service.js`, para que el flujo clínico y el operativo no diverjan. Al iniciar:

- Validar una sola cuarentena `ACTIVA` por animal.
- Validar canil individual.
- Crear `CuarentenaAnimal` con `canilId`.
- Poner el canil en `CUARENTENA`.
- Auditar.
- No cambiar automáticamente `Animal.estadoSalud` desde Caniles (la decisión clínica queda en Salud); en el flujo clínico conservar el comportamiento actual.

Al finalizar: `FINALIZADA`, `fechaFinReal`, observaciones; recalcular estado del canil; auditar.

Actualizar los consumidores del 1:1 (sección 2.4). Casos clave:

- **Alta de animal con canil**: validar cupo/especie; setear `fechaIngresoCanil`; sincronizar canil.
- **Edición de animal**: si cambia `canilId`, liberar/actualizar fecha solo si cambió de canil; al quitar canil, `fechaIngresoCanil = null`.
- **Devolución**: permitir canil grupal compatible; setear fecha; auditoría sin `animalAlojadoId`.
- **Adopción**: quitar `canilId` y `fechaIngresoCanil`; poner canil en `LIBRE` **solo** si no quedan animales; usar `sincronizarEstadoCanil`.
- **Baja de animal**: igual que adopción.
- **Traslado externo aprobado**: liberar canil solo si queda vacío; quitar `fechaIngresoCanil`.
- **Exportes**: revisar `backend/src/services/export.service.js`; si muestra “ocupados/libres”, adaptar a cupos o documentar la semántica.

### 5.2 `GET /api/caniles`

Mantener `resumen` y `caniles`, agregando campos:

```json
{
  "resumen": {
    "total": 12,
    "libres": 3,
    "ocupados": 8,
    "cuarentena": 1,
    "mantenimiento": 0,
    "porcentajeOcupacion": 78,
    "alertaSobrecupo": false,
    "capacidadTotal": 18,
    "animalesAlojados": 14,
    "cuposLibres": 4
  },
  "caniles": [
    {
      "id": 5,
      "codigo": "C-05",
      "nombre": "Canil 5",
      "sector": "Cachorros",
      "tipo": "Mixto",
      "capacidad": 4,
      "estado": "OCUPADO",
      "ocupacion": { "alojados": 3, "capacidad": 4, "libres": 1, "porcentaje": 75 },
      "animales": [
        {
          "id": 21,
          "nombre": "Mora",
          "especie": "Perro",
          "sexo": "Hembra",
          "edad": "2 meses",
          "raza": "Mestizo",
          "estadoSalud": "NORMAL",
          "fotoUrl": null,
          "fechaIngresoCanil": "2026-11-10T12:00:00.000Z",
          "diasEnCanil": 15
        }
      ],
      "animalAlojado": { "id": 21, "nombre": "Mora" },
      "cuarentena": {
        "id": 7,
        "fechaInicio": "2026-11-20T12:00:00.000Z",
        "fechaFinEstimada": "2026-12-04T12:00:00.000Z",
        "diasRestantes": 9,
        "vencida": false,
        "motivo": "Aislamiento respiratorio"
      }
    }
  ]
}
```

Semántica:

- `codigo`: se conserva en la respuesta por compatibilidad, pero el frontend **no lo renderiza**. El identificador visible es `nombre` + `sector`.
- `libres`, `ocupados`, `cuarentena`, `mantenimiento`: **cantidad de caniles** en ese estado (compatibilidad).
- `capacidadTotal`: suma de capacidades.
- `animalesAlojados`: suma de animales.
- `cuposLibres`: `capacidadTotal - animalesAlojados`.
- `porcentajeOcupacion`: `animalesAlojados / capacidadTotal` redondeado. Cambia respecto de la definición actual (caniles ocupados/total); actualiza dashboard/exportes si corresponde y documenta.
- `diasEnCanil`: días calendario UTC entre `fechaIngresoCanil` y ahora; nunca negativo; `null` si falta.
- `cuarentena`: la `ACTIVA` vinculada al canil, o `null`.

Helper de fechas en `backend/src/utils/fechas.js`:

```js
export const diasEntre = (desde, hasta = new Date()) => {
  if (!desde) return null;
  const a = Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate());
  const b = Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth(), hasta.getUTCDate());
  return Math.max(0, Math.floor((b - a) / 86400000));
};
```

### 5.3 Endpoints

Todos bajo `/api/caniles`, con `authenticateToken`, validación Zod y mensajes en español (`ErrorDominio`).

#### `POST /api/caniles/asignar` (modificar)

Body:

```json
{
  "canilId": 5,
  "animalId": 21,
  "motivo": "Reubicación por camada",
  "estado": "OCUPADO",
  "fechaFinEstimada": null,
  "observaciones": null,
  "confirmarLiberacionMultiple": false
}
```

Reglas:

- **Con `animalId`**: validar mantenimiento, capacidad, especie, adoptado y cuarentena. Actualizar `fechaIngresoCanil` solo si cambia de canil. Crear `Traslado INTERNO_CANIL` con origen/destino. Sincronizar canil anterior y destino dentro de una transacción.
- **Sin `animalId`**: liberar todos los animales. Si hay >1 y `confirmarLiberacionMultiple` no es `true` → 409 `"El canil tiene N animales. Confirma la liberación de todos."`. Si se confirma, quitar `canilId` y `fechaIngresoCanil` a todos, poner `LIBRE` y auditar.
- **`estado: "CUARENTENA"`**: exigir motivo ≥5, `fechaFinEstimada` futura, capacidad 1 y un solo ocupante; usar `iniciarCuarentena`; auditar. Devolver 409 claro si es grupal.
- Respuesta: `{ success, mensaje, canil, animales, cuarentena, alertaSobrecupo, porcentajeOcupacion }`.

#### `POST /api/caniles/:id/finalizar-cuarentena` (nuevo)

- Roles: `requireRole('DIRECCION', 'PERSONAL_VETERINARIO')`.
- Body: `{ "animalId": 21, "observaciones": "Sin síntomas" }`. `animalId` opcional si hay una sola cuarentena activa en el canil.
- Usa `finalizarCuarentena`; responde `{ success, mensaje, canil, cuarentena }`.
- Sin cuarentena activa → 404 `"No hay una cuarentena activa en este canil."`.

#### `GET /api/caniles/:id` (nuevo)

- Mismo formato que un elemento de `GET /api/caniles` (incluye `animales`, `ocupacion`, `cuarentena`, `diasEnCanil`).
- 404 `{ "error": "Canil no encontrado." }`.

#### `GET /api/caniles/:id/historial` (nuevo)

Query: `limit` (1–100, default 20) y `cursor` (id de traslado). Respuesta:

```json
{
  "canil": { "id": 5, "codigo": "C-05", "nombre": "Canil 5", "sector": "Cachorros", "capacidad": 4, "tipo": "Mixto" },
  "resumen": { "residentes": 7, "estadiasActuales": 3, "promedioDias": 18, "movimientos": 22 },
  "estadias": [
    {
      "animal": { "id": 21, "nombre": "Mora", "especie": "Perro", "fotoUrl": null },
      "desde": "2026-11-10T12:00:00.000Z",
      "hasta": null,
      "dias": 15,
      "actual": true
    }
  ],
  "movimientos": [
    {
      "id": 91,
      "fecha": "2026-11-10T12:00:00.000Z",
      "animal": { "id": 21, "nombre": "Mora" },
      "origen": "Canil 3",
      "destino": "Canil 5",
      "motivo": "Reubicación por camada",
      "responsable": { "id": 2, "nombre": "Ana Pérez", "rolEtiqueta": "Directora" }
    }
  ],
  "cuarentenas": [
    {
      "id": 7,
      "animal": { "id": 21, "nombre": "Mora" },
      "fechaInicio": "2026-11-20T12:00:00.000Z",
      "fechaFinEstimada": "2026-12-04T12:00:00.000Z",
      "fechaFinReal": null,
      "estado": "ACTIVA",
      "motivo": "Aislamiento respiratorio",
      "dias": 5
    }
  ],
  "paginacion": { "limit": 20, "nextCursor": null }
}
```

- Estadías: desde `Traslado INTERNO_CANIL` donde el canil sea origen o destino, ordenadas por fecha; cada estadía va del ingreso al siguiente movimiento de salida (`null` si sigue). Incluir ocupantes actuales sin traslado usando `fechaIngresoCanil`/`Animal.creadoEn`. Sin duplicados.
- Movimientos paginados por cursor descendente.
- Roles: cualquier usuario autenticado.

#### `PUT /api/caniles/:id` (nuevo)

- Roles: `DIRECCION`.
- Body parcial: `sector`, `tipo` (`Perro|Gato|Mixto`) y `capacidad` (1–20).
- No reducir capacidad bajo la ocupación actual → 409 `"No puedes reducir la capacidad por debajo de los N animales alojados."`.
- No cambiar tipo si hay animales incompatibles → 409.
- Auditar anterior/nuevo.

#### `POST /api/caniles` (modificar)

- Aceptar `tipo` (`Perro|Gato|Mixto`, default `Mixto`) y `capacidad` (1–20, default 1).
- Mantener la generación automática de `codigo`/`nombre` en el frontend, pero el `codigo` es interno y **no debe mostrarse en la UI**.

#### `DELETE /api/caniles/:id` (modificar)

- Solo si `animales.length === 0`; reemplazar la comprobación de `animalAlojado`.

#### Orden de rutas

Declarar rutas estáticas antes de las paramétricas:

```js
router.get('/traslados', ...);
router.get('/:id/historial', ...);
router.get('/:id', ...); // siempre al final de los GET
```

#### Zod

`backend/src/schemas/canil.schema.js`:

- `asignarCanilSchema`: agregar `fechaFinEstimada` (datetime nullable), `observaciones`, `confirmarLiberacionMultiple`; refinar cuarentena (motivo ≥5, fecha obligatoria).
- `crearCanilSchema`: `tipo` enum y `capacidad` 1–20.
- `actualizarCanilSchema`, `finalizarCuarentenaSchema`, `historialCanilSchema`.

Mantener el formato `{ error: "..." }` y los códigos de `ErrorDominio`.

### 5.4 Auditoría

Registrar con `registrarAuditoria`:

- Movimiento entre caniles (ampliar con canil anterior/nuevo y días).
- Liberación múltiple.
- Inicio y fin de cuarentena (`CuarentenaAnimal`).
- Cambio de capacidad/tipo (`Canil`, `MODIFICACION`).
- Eliminación de canil (ya existe).

No auditar escaneos de QR.

---

## 6. Frontend

### 6.1 Estructura

Extraer de `CanilesPage.jsx` sin reescribirlo de golpe:

```text
frontend/src/components/caniles/
├── CanilCard.jsx
├── CanilDetalleModal.jsx      // pestañas Resumen / Animales / Historial
├── HistorialCanil.jsx
├── CuarentenaBadge.jsx
├── CuarentenaPanel.jsx
├── MoverAnimalDialog.jsx
├── QrEtiquetasModal.jsx
└── CanilGrupoAvatarStack.jsx

frontend/src/hooks/useCanilesDragAndDrop.js
frontend/src/utils/dias.js
frontend/src/utils/qr.js
```

Integrar de forma incremental y conservar los modales/flujos actuales hasta que cada reemplazo esté probado.

### 6.2 Tarjetas

Cada `CanilCard`:

- Nombre, sector y estado. **No renderizar `codigo`** (ni `C-01`, ni `C-05`, ni similares) en la tarjeta, el `aria-label` ni ningún texto visible. Usar solo `nombre` y `sector`.
- Ocupación `3 / 4` con barra/puntos; en capacidad 1 mantener el diseño actual.
- Grupal: pila de hasta 3 avatares + `+N`, y `"3 animales"` o `"Libre"`.
- Por animal (o el primero si es individual): nombre y días:
  - `Ingresó hoy`, `1 día`, `N días`.
- Badge **Estadía prolongada** a los `>= 30` días (constante `DIAS_ESTADIA_PROLONGADA = 30`), con `title`.
- Badge de cuarentena con contador.
- Especie/tipo en tooltip.
- `aria-label` resumen: canil, ocupación, animales y cuarentena.
- Agregar filtro **Mantenimiento** a los chips y orden por nombre/sector, **más días ocupado** y **ocupación**.

### 6.3 Cuarentena con cuenta regresiva

En el modal de canil:

- Al activar “En cuarentena”, pedir **Motivo** (≥5) y **Duración/fecha de término** (7/14/21/30 días + `type="date"`; default 14).
- Si el canil es grupal: aviso `"La cuarentena requiere un canil individual. Mueve a los animales a caniles individuales para continuar."` y deshabilitar guardado.
- Guardar con `asignarCanil({ estado: 'CUARENTENA', motivo, fechaFinEstimada, observaciones })`.

`CuarentenaBadge` según `diasRestantes`:

- `> 1`: `"Cuarentena · quedan N días"`.
- `1`: `"Cuarentena · vence mañana"`.
- `0`: `"Cuarentena · vence hoy"`.
- `< 0`: `"Cuarentena vencida hace N días"` (rojo fuerte + alerta).

`diasRestantes` = diferencia de días calendario entre hoy y `fechaFinEstimada` (0 = hoy, negativo = vencida). Recalcular al cargar y al abrir el modal; opcional intervalo de 60 s solo con el modal visible.

Finalizar:

- Botón visible para `DIRECCION`/`PERSONAL_VETERINARIO` cuando hay cuarentena activa.
- Confirmación con observaciones; llamar `finalizarCuarentena(id, { animalId, observaciones })`.
- Toast `"Cuarentena finalizada."` y recarga.

Avisos (campanita):

- Agregar objetos con la forma actual `{ tipo, titulo, clave, mensaje, tab }` y opcional `canilId`.
- Cuarentenas vencidas y por vencer (≤1 día), usando claves que cumplan el regex del backend, por ejemplo `caniles:cuarentena:vencida:<id>` y `caniles:cuarentena:porvencer:<id>` (minúsculas).
- Al hacer clic: marcar como leída con `lecturas.marcar(clave)`, abrir el canil (usar `canilId` si existe) y mantener `tab` como fallback.
- No duplicar avisos ni claves inestables.

### 6.4 Historial por canil

`CanilDetalleModal` con pestañas:

1. **Resumen**: estado, sector, capacidad, cuarentena, acciones.
2. **Animales**: ocupantes actuales con foto, nombre, especie, edad, salud y días; botón “Ver ficha” (navegar a `/animales` o reutilizar el modal existente).
3. **Historial**: `HistorialCanil`.

`HistorialCanil`:

- Cargar `GET /caniles/:id/historial` al abrir la pestaña (lazy) con skeleton.
- Resumen: residentes históricos, movimientos, promedio de días.
- Timeline: fecha, animal, origen → destino, motivo, responsable.
- Secciones “Cuarentenas” y “Estadías” (animal, desde/hasta/días).
- “Cargar más” si `nextCursor`.
- Vacío: `"Este canil todavía no tiene movimientos registrados."`
- No exponer datos clínicos más allá de motivo/observaciones de cuarentena.

### 6.5 Días en canil

Helper `formatearDiasEnCanil(dias)`:

- `null` → `"—"`.
- `0` → `"Ingresó hoy"`.
- `1` → `"1 día"`.
- `n` → `"N días"`.

Mostrar en tarjeta, pestaña Animales y etiqueta QR. En grupales: `"Más antiguo: N días"` si hay varios. Agregar orden por días.

### 6.6 Caniles grupales (UI)

Alta de canil:

- Sector actual (con opción de crear).
- Tipo: `Perro`, `Gato`, `Mixto` (default `Mixto`).
- Capacidad 1–20 (default 1). Ayuda: `"Usa capacidad mayor a 1 para camadas o grupos compatibles."`
- Mantener la generación automática de nombre (`Canil N`) y de `codigo` (`C-NN`) por requisito de unicidad en la base de datos, pero **el código no se muestra en pantalla**. Solo se ve el nombre y el sector.

Asignación:

- Mostrar caniles con `ocupacion.libres > 0` y compatibles, no solo `estado === 'LIBRE'`.
- En `AnimalFormModal`, cambiar el filtro a:
  ```js
  c.estado !== 'MANTENIMIENTO' &&
  (c.ocupacion?.libres > 0 || Number(c.id) === Number(canilActualId)) &&
  (c.tipo === 'Mixto' || c.tipo === especieDelAnimal)
  ```
- En el modal de canil, transformar “Animal en el canil” en **lista de animales**:
  - Cada ocupante con foto, nombre y días.
  - Selector que excluya animales ya alojados y valide compatibilidad.
  - `Liberar` por animal; `Liberar canil` solo con 1, o confirmación `"Se liberarán N animales. ¿Continuar?"`.
- Textos: `"Capacidad: N cupos · M ocupados"`.
- `MANTENIMIENTO`: control para bloquear/desbloquear; mientras esté activo, no asignar ni dropear.
- Un canil grupal no puede pasar a cuarentena.

### 6.7 Drag & drop

Instalar:

```bash
cd frontend
npm install @dnd-kit/core
```

Comportamiento:

- Arrastrables: tarjeta o bloque del animal en caniles ocupados, con `activationConstraint: { distance: 8 }` para no romper el clic que abre el modal.
- Destinos: todas las tarjetas, incluidos vacíos y grupales con cupo.
- `DragOverlay` con foto + nombre + origen.
- Válidos: resplandor verde; inválidos: rojo atenuado con tooltip:
  - `"Canil en mantenimiento"`, `"Sin cupos disponibles"`, `"Especie incompatible"`, `"Para cuarentena usa Gestionar canil"`.
- Al soltar en válido:
  - Movimiento normal: ejecutar directamente con `asignarCanil({ canilId, animalId, motivo: null })`.
  - Si requiere datos extra, abrir `MoverAnimalDialog`.
  - Optimista + rollback; toast con `"Deshacer"` durante 6 s que llama al movimiento inverso con motivo `"Deshacer movimiento"`.
  - Refrescar `GET /caniles` al terminar.
- Teclado: `KeyboardSensor`, Tab para enfocar, `Espacio` levantar/soltar, flechas para elegir, `Esc` cancelar; `aria-live="polite"`.
- Touch: `TouchSensor` con `delay: 200, tolerance: 8`; además botón `Mover` en el modal como alternativa accesible.
- Deshabilitar mientras se carga/guarda; no arrastrar adoptados/inactivos.
- En 409 por concurrencia: toast y recarga.

### 6.8 QR y deep link

Ruta en `frontend/src/App.jsx`, **antes del comodín**:

```jsx
<Route path="/caniles/:canilId" element={<CanilesPage user={user} />} />
```

`CanilesPage`:

- Leer `useParams()`.
- Al cargar, buscar el canil, abrir el detalle en Resumen y resaltar la tarjeta.
- Si no existe: banner `"El canil solicitado no existe o fue eliminado."` + enlace `Volver al mapa`.
- `activeTab` sigue siendo `caniles` por el primer segmento del path.
- El deep link requiere sesión. Tras el login debe permanecer en la misma URL, no redirigir a `/dashboard`. Verificar `AuthContext`.
- Mantener `/caniles` funcionando igual.

Generación:

```bash
cd frontend
npm install qrcode
```

`frontend/src/utils/qr.js`:

```js
const base = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '');
export const urlCanil = id => `${base}/caniles/${id}`;
// QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
```

Agregar a `frontend/.env.example`:

```env
# URL pública para los QR impresos (ej: https://huellas.facultad.edu)
# Si se omite, se usa window.location.origin.
VITE_PUBLIC_APP_URL=
```

Si `base` contiene `localhost`/`127.0.0.1`, mostrar: `"La URL del QR apunta a localhost; desde un celular no abrirá. Configura VITE_PUBLIC_APP_URL con el dominio público."`

`QrEtiquetasModal`:

- Botón `Etiquetas QR` en el encabezado (icono `QrCode` de lucide-react).
- Alcance: todos, sector actual, filtro actual.
- Opciones: incluir ocupantes (default sí), incluir días (default sí).
- Vista previa y `Imprimir` (`window.print()`).
- A4, 8 etiquetas por página (2×4), margen 10 mm, `break-inside: avoid`.
- Etiqueta: refugio, **`Canil 5 · Sector Cachorros`** (sin código `C-05`), tipo, `Capacidad: 4`, `Ocupa: Mora, Luna` o `Libre`, días si se activó, QR ~30 mm, texto `"Escanea para ver este canil"` y espacio para anotar.
- QR con `alt`/texto alternativo; contraste alto; no depender solo del color.
- `@media print` ocultando todo excepto `.qr-print-area`; `@page { size: A4; margin: 10mm; }`.
- Sin sidebar, toasts ni modal en la impresión.

La ficha abierta desde el QR debe mostrar prominentemente:

- Nombre, sector y estado (sin mostrar el código interno).
- **Nombres de todos los ocupantes** con foto y días.
- `"Canil libre"` si no hay animales.
- Cuarentena con cuenta regresiva si aplica.
- Sin botones de edición para usuarios sin permiso.

### 6.9 Accesibilidad y responsive

- Labels/`aria-label`, foco visible, `role="dialog"`, `aria-modal`, `Esc` (usar `Modal`).
- Alternativa de teclado y botón “Mover” para DnD.
- Estado con texto/icono, no solo color.
- Móvil: tarjetas a una columna, modal a pantalla completa, pestañas desplazables.
- No romper `portal-page-scroll-con-filtros` ni el header.

### 6.10 Servicios frontend

Ampliar `frontend/src/services/canil.service.js`:

```js
export const obtenerCanil = id => request(`/caniles/${id}`);
export const obtenerHistorialCanil = (id, { limit = 20, cursor } = {}) =>
  request(`/caniles/${id}/historial?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`);
export const finalizarCuarentena = (id, json) =>
  request(`/caniles/${id}/finalizar-cuarentena`, { method: 'POST', json });
export const actualizarCanil = (id, json) =>
  request(`/caniles/${id}`, { method: 'PUT', json });
```

Conservar los métodos existentes y sus firmas.

---

## 7. Pruebas

### 7.1 Backend

Seguir el patrón de `backend/tests/*.test.js` (Node test runner). Agregar:

- `caniles.grupales.test.js`
  - 2 animales compatibles en capacidad 2 → OK; tercero → 409.
  - Especie incompatible → 409; mantenimiento → 409.
  - Liberar un animal no libera a los demás; liberar todos sin flag → 409; con flag → OK.
  - Reducir capacidad bajo ocupación → 409.
  - Adopción de un ocupante mantiene `OCUPADO`; del último deja `LIBRE`.
- `caniles.cuarentena.test.js`
  - Sin motivo/fecha → 400; canil grupal → 409.
  - Inicio crea `CuarentenaAnimal` con `canilId` y canil `CUARENTENA`.
  - Finalizar con rol autorizado setea `fechaFinReal`/`FINALIZADA`; sin rol → 403.
  - Solo una `ACTIVA` por animal.
- `caniles.historial.test.js`
  - Estadías correctas y sin duplicados; paginación; canil inexistente → 404.
- `caniles.dias.test.js` o unitario de `diasEntre` (mismo día = 0, nunca negativo).

Comandos:

```bash
cd backend
npm run prisma:generate
npm run prisma:deploy
npm test
```

Las pruebas de integración requieren PostgreSQL/datos de prueba; si no hay base, documenta cuáles se omitieron y ejecuta al menos `npm run test:unit`.

### 7.2 Frontend

Con Vitest + Testing Library (`frontend/tests/setup.js`):

- `formatearDiasEnCanil` y `diasRestantesCuarentena`.
- `urlCanil` respeta `VITE_PUBLIC_APP_URL` y cae a `window.location.origin`.
- Validaciones de destinos DnD (mantenimiento, sin cupo, especie, cuarentena).
- `CanilCard` grupal muestra `3 / 4`, nombres y días.
- `QrEtiquetasModal` genera una etiqueta por canil y muestra `Ocupa: ...`.
- Mantener verde `frontend/tests/caniles-bitacoras.test.jsx` (sub-pestañas y tablas actuales).

```bash
cd frontend
npm install
npm run test:run
npm run build
```

---

## 8. QA manual

- [ ] Un canil libre acepta un animal y muestra `Ingresó hoy`.
- [ ] Mover un animal deja origen `LIBRE`, destino `OCUPADO` e historial con origen/destino/responsable.
- [ ] Canil de capacidad 3 acepta 3 compatibles y rechaza el cuarto.
- [ ] Mezclar perro/gato en canil no `Mixto` muestra error claro.
- [ ] Liberar canil con 3 animales pide confirmación y libera todos.
- [ ] `MANTENIMIENTO` bloquea asignación y DnD.
- [ ] DnD con mouse, teclado y móvil; “Deshacer” revierte.
- [ ] Cuarentena pide motivo y fecha; badge “quedan N días”.
- [ ] Al vencer: “vencida hace N días” + aviso en campanita; se puede marcar leída.
- [ ] Dirección/Veterinaria finaliza cuarentena; otro rol recibe 403.
- [ ] Canil grupal no permite cuarentena.
- [ ] Historial muestra residentes, movimientos, cuarentenas y estadías sin duplicados.
- [ ] `Etiquetas QR` imprime solo las etiquetas (8 por A4), sin sidebar/toasts.
- [ ] La etiqueta muestra el nombre de los ocupantes y días.
- [ ] El QR abre `/caniles/:id` en el celular, pide login si hace falta y muestra el canil.
- [ ] Un id inexistente muestra mensaje claro y no redirige al dashboard.
- [ ] Dashboard, reportes y exportaciones siguen coherentes.
- [ ] Traslados externos y aprobación de Dirección intactos.
- [ ] La campanita conserva “Marcar como leída”.

---

## 9. Orden de implementación

1. `feat(caniles): caniles grupales y fecha de ingreso`
   Migración + backfill, helper de ocupación, refactor de consumidores, tests.
2. `feat(caniles): cuarentena con fecha de término e historial`
   `CuarentenaAnimal.canilId`, servicio compartido, endpoints, badge/panel.
3. `feat(caniles): drag and drop de animales`
   `@dnd-kit/core`, validaciones, undo, accesibilidad.
4. `feat(caniles): detalle de canil con pestañas e historial`
   Modal, `HistorialCanil`, deep link.
5. `feat(caniles): etiquetas QR imprimibles`
   Ruta, `qrcode`, modal y estilos de impresión.
6. `test(caniles): cobertura de grupos, cuarentena, historial y QR`
   Completar pruebas y actualizar README si cambia la semántica de ocupación.

Mantén commits pequeños y verifica `git diff --stat` antes de cada uno para no incluir trabajo ajeno en curso.

---

## 10. Criterios de aceptación

**Cuarentena**: registrada en `CuarentenaAnimal` con `canilId`, motivo y fecha; cuenta regresiva y vencimiento visibles; finalización con permisos y auditoría; prohibida en grupales.

**Drag & drop**: mover con mouse/teclado/touch; valida capacidad, especie, mantenimiento y cuarentena; optimista con rollback y “Deshacer”; errores visibles.

**Historial**: residentes actuales y anteriores, movimientos, cuarentenas y estadías con desde/hasta/días; paginación; sin duplicados.

**Días en canil**: `fechaIngresoCanil` persistido y actualizado al mover; visible en tarjeta, ficha y QR; badge a los 30 días.

**Grupales**: `Animal.canilId` deja de ser único; alta/edición con tipo y capacidad; compatibilidad validada; estados correctos al adoptar, dar de baja o liberar.

**QR**: `/caniles/:id` abre el detalle (con login); etiqueta A4 con QR, nombre y sector del canil (sin el código `C-NN`), y ocupantes; URL configurable; al escanear se ven los nombres de los animales.

---

## 11. Fuera de alcance

- Coordenadas físicas de caniles (`posX`/`posY`).
- Estado de limpieza/aseo.
- QR públicos sin autenticación.
- WebSocket/tiempo real.
- Validación automática de edad/cachorros.
- Cambios de roles, adopciones o correo.
- Rediseño general o nueva librería de UI.
- Eliminar `animalAlojado` de la API en esta entrega.

---

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Consultas que asumían un ocupante | `rg "animalAlojado|canilId"`; helper central; alias `animalAlojado`. |
| Sobrecupo concurrente | Transacción + `SELECT ... FOR UPDATE`; validar dentro de la transacción. |
| Estado del canil inconsistente | Usar siempre `sincronizarEstadoCanil`; no escribir `estado` a mano salvo mantenimiento. |
| Cuarentenas duplicadas | Validar una `ACTIVA` por animal; 409. |
| QR con datos viejos | La etiqueta es una foto; el QR abre la ficha viva; reimprimir por sector. |
| QR con localhost | Advertencia en UI y `VITE_PUBLIC_APP_URL`; probar desde celular. |
| Impresión con sidebar/modal | `.qr-print-area` + `@media print`; probar Chrome/Edge. |
| Pérdida de datos en migración | Probar sobre copia sembrada; comparar conteos; no editar migraciones publicadas. |
| Rutas `/:id` capturando `/traslados` | Orden correcto: rutas estáticas primero, `GET /:id` al final. |
| Avisos de cuarentena rompen campanita | Claves válidas (`^(animales|caniles):[a-z0-9:-]+$`), usar hook y backend existentes. |
| Regresiones en reportes/exportaciones | Revisar `export.service.js` y `dashboard.service.js`; pruebas de resumen. |
| DnD inaccesible | Sensores teclado/touch + botón “Mover”. |
| Choque con trabajo en curso | `git status`/`git diff` antes de editar; no revertir archivos ajenos. |

---

## 13. Entregable final

Codex debe reportar:

1. Archivos creados/modificados.
2. Migración aplicada y cómo revertirla en desarrollo.
3. Comandos ejecutados y resultado de pruebas (backend y frontend).
4. Descripción del QA manual de los seis flujos.
5. Decisiones tomadas fuera de este documento, justificadas.
