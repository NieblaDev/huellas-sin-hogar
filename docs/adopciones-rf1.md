# RF1 · Commit 1: solicitudes de adopción

Implementación para el backend Express/Prisma y el frontend React existentes.
Integrado en la copia principal `Documents/ProyectoISW/huellas-sin-hogar`, sobre la versión PERN con Inicio, Caniles, Animales y Auditoría. Adopciones aparece en la navegación lateral para el staff autorizado.

## Alcance y reglas

- Solo `DIRECTORA` y `ENCARGADA_ADOPCIONES` activos pueden crear y consultar solicitudes, antecedentes y animales disponibles. Se verifica el usuario actual en PostgreSQL después de autenticar el JWT.
- RUT chileno: normalización de puntos, espacios y guion, mayúsculas y validación de dígito verificador. Otros documentos: letras, números y guiones; espacios eliminados y letras en mayúsculas. Se reutiliza `Postulante.rut` como identificación existente (máximo 20 caracteres) y se añade su tipo. Un índice por identidad normalizada reconoce también los RUT con puntos y guion de registros anteriores, sin cambiar sus datos. La restricción única original sobre `rut` se conserva.
- Un postulante puede tener como máximo una solicitud activa, independientemente del animal. Estados activos: `RECIBIDA`, `EN_EVALUACION`, `VISITA_AGENDADA`, `VISITA_REALIZADA`, `APROBADA`. `RECHAZADA`, `ENTREGADA` y `CANCELADA` son terminales.
- Solicitud activa: alerta y rechazo HTTP 409. Devoluciones previas: alerta informativa al consultar y al crear; no impiden por sí mismas una nueva solicitud.
- El índice único parcial de PostgreSQL y las transacciones serializables impiden duplicados concurrentes. La consulta previa del navegador es orientativa; el servidor siempre vuelve a validar al crear.
- Una solicitud guarda una copia de los datos del postulante en `datosPostulante`. Sus datos de contacto actuales pueden actualizarse con una solicitud posterior sin alterar esa copia histórica.
- El responsable y el estado inicial se establecen en el servidor. No se aceptan desde el formulario.
- Las relaciones nuevas usan `onDelete: Restrict`. Se respetan las bajas lógicas existentes: los animales y postulantes inactivos no pueden generar solicitudes nuevas.
- Se reutiliza el modelo `Adopcion` existente y se añade la tabla `devoluciones` para antecedentes detallados. Los antecedentes previos con `devolucion=true` o etapa `Devuelto` también generan alertas; cuando no existe fecha de devolución, se muestra como no registrada. Sus operaciones, seguimiento, caniles y cambios de etapa quedan para los commits 2–4. No hay endpoints de escritura para esas tablas en este commit.
- No se importa automáticamente el contenido ficticio del prototipo HTML. Si hay antecedentes reales fuera de PostgreSQL, requieren una carga de datos revisada.

## Integración

Solo tres archivos preexistentes cambian: `backend/prisma/schema.prisma`, `backend/src/routes/index.js` y `frontend/src/App.jsx`. Los estilos comunes de controles se agregan en un archivo nuevo para unificar tipografía y altura sin reescribir los otros módulos. Las solicitudes y los datos de postulantes producen entradas de auditoría dentro de su transacción.

La pantalla de adopciones se abre desde el menú lateral, junto a los módulos existentes, al iniciar sesión con un rol autorizado. Los demás roles no ven el módulo; ocultarlo no reemplaza la autorización del backend.

## Migraciones

El repositorio original no tenía historial de migraciones. Se añaden:

1. `20261020000000_baseline_pern`: reproducción de la versión PERN de ProyectoISW, sin RF1.
2. `20261020000100_rf1_solicitudes`: tablas nuevas, restricciones y el índice parcial contra solicitudes activas duplicadas.

Con las dependencias del proyecto instaladas, ejecutar los comandos siguientes desde `backend`, con `DATABASE_URL` apuntando a la base elegida.

### Base vacía

```sh
npm exec -- prisma migrate deploy
npm exec -- prisma generate
```

### Base existente creada con el esquema original

Primero comprobar que su esquema coincide con la migración baseline y respaldar la base. Solo si ya contiene ese esquema sin historial de migraciones, marcar la baseline como aplicada y aplicar la ampliación:

```sh
npm exec -- prisma migrate resolve --applied 20261020000000_baseline_pern
npm exec -- prisma migrate deploy
npm exec -- prisma generate
```

No ejecutar la baseline sobre tablas existentes ni usar `migrate reset`. Si la base tiene cambios adicionales del equipo o migraciones previas no versionadas aquí, conciliar ese historial antes de aplicar esta secuencia.

**Usar migraciones, no solamente `prisma db push`:** Prisma 5 no representa el índice único parcial ni el índice por identificación normalizada del SQL. Omitir la migración perdería esas restricciones. Mantener el índice al modificar estados en commits posteriores.

## API

Todas las rutas requieren `Authorization: Bearer <token>` y staff autorizado.

| Método | Ruta bajo `/api/adopciones` | Resultado |
| --- | --- | --- |
| GET | `/antecedentes?tipoIdentificacion=RUT&identificacion=...` | Postulante, solicitudes activas, devoluciones y alertas |
| GET | `/animales-disponibles` | Animales sin adopción vigente |
| POST | `/solicitudes` | Solicitud creada y alertas; HTTP 201 |
| GET | `/solicitudes?search=...&estado=RECIBIDA&pagina=1&limite=20` | Listado y total; máximo 50 por página |
| GET | `/solicitudes/:id` | Detalle, copia del formulario y antecedentes actuales |

El cuerpo de creación contiene `postulante` (`tipoIdentificacion`, `identificacion`, `nombre`, `email`, `telefono`, `direccion`), `animalId` numérico y `motivacion`. No admite campos adicionales de control.

Errores: 400 validación, 401 sin sesión, 403 permisos/token inválido, 404 inexistente, 409 conflicto de negocio o concurrencia y 500 error interno sin información de la base.

## Verificación local

El frontend descarta sesiones guardadas corruptas o vencidas y verifica el token con el backend antes de restaurar el portal. Si la sesión no es válida, muestra el formulario de acceso. Las pruebas del frontend cubren esta recuperación y la conservación de datos de almacenamiento ajenos a la sesión.

Desde la raíz del repositorio, sin conectarse a GitHub:

```sh
node --test backend/tests/adopcion.schema.test.js
node --test frontend/tests/session.test.mjs
TEST_DATABASE_URL='postgresql://usuario:clave@127.0.0.1:5432/huellas_test' node --test backend/tests/adopcion.integration.test.js backend/tests/adopcion.migration.test.js
npm --prefix frontend run build
```

Las pruebas de integración requieren una base local cuyo nombre contenga `test` y permiso para crear esquemas. Cada ejecución crea, migra y elimina su propio esquema PostgreSQL; no modifica los datos de pruebas manuales, aunque se utilice el mismo RUT. La prueba de migración requiere `psql` y permiso para crear un esquema temporal; verifica que aplicar RF1 sobre la baseline conserve usuarios y fichas existentes. No usar datos productivos como base de pruebas.

Cobertura: roles autorizados y denegados, usuarios inactivos y JWT con rol desactualizado, normalización de identificación, duplicados, seis altas concurrentes, índice parcial, antecedentes de devolución, copias históricas, filtros/paginación, animales inexistentes o adoptados y protección del historial ante borrado.

## Prueba visual de la integración

Para esta revisión se usa una base separada (`huellas_integracion_rf1_test`), backend en `http://localhost:3001` y frontend en `http://localhost:5174`. Usuario de ejemplo: `staff@huellas.cl` / `admin123`. La base anterior de pruebas de GitHub conserva sus solicitudes; no se importan automáticamente en la nueva base.

Desde la copia de ProyectoISW, con la base de revisión ya migrada y sembrada, abrir dos terminales:

```sh
cd backend
DATABASE_URL="postgresql://huellas_test@127.0.0.1:55439/huellas_integracion_rf1_test" PORT=3001 JWT_SECRET="clave-local-para-pruebas" npm run dev
```

```sh
cd frontend
VITE_API_URL="http://localhost:3001/api" npm run dev -- --port 5174 --strictPort
```

Recorrer Inicio, Caniles y Traslados, Registro Animales, Adopciones y Auditoría. En Adopciones, crear una solicitud y comprobar que aparece su registro en Auditoría. Los campos y botones deben heredar la misma tipografía y los botones tener una altura mínima común de 40 px.
