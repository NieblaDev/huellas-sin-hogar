# Entrega del módulo de Caniles

## Verificación

| Flujo | Resultado observado |
| --- | --- |
| Caniles grupales | Alta con capacidad 4 en Edge. En PostgreSQL, dos asignaciones simultáneas al último cupo dan una aceptación y un rechazo. Se verificaron especie, mantenimiento, reducción de capacidad, liberación múltiple y adopción del último residente. |
| Días en canil | El cálculo usa días calendario UTC. Las pruebas comprueban el ingreso de hoy, el cambio de día, valores ausentes y fechas invertidas. El mapa y la etiqueta muestran el dato por residente. |
| Cuarentena | Inicio y cierre desde la ficha en Edge. La API rechaza cuarentenas duplicadas o grupales y devuelve 403 al intentar finalizarlas desde Voluntariado. |
| Movimiento | Movimiento entre un canil individual y uno grupal con mouse, teclado y eventos táctiles emulados en Edge. Se verificó el retorno al origen con Deshacer. |
| Historial | En Edge se abrió el historial del destino después del movimiento. Las pruebas comprueban estadías actuales, residentes únicos, paginación y respuesta 404. |
| QR | Edge pidió sesión y abrió la ficha del canil solicitado después del login. Se verificaron nombres a 390 px de ancho y un PDF con tres hojas de etiquetas A4 en el escenario de prueba. El uso de una impresora física y el escaneo con cámara de teléfono quedan pendientes. |

## Base local y reversión

La migración `20261125020000_caniles_grupales_cuarentena_historial` se probó sobre una copia de PostgreSQL y se aplicó en `huellas_sin_hogar`. Antes y después se contaron 14 animales, 12 caniles, 59 traslados y cero registros clínicos de cuarentena. Había un canil marcado en cuarentena por el flujo antiguo. Su ficha permite incorporar motivo y fecha de término reales.

El respaldo local previo es `huellas_pre_caniles_1795645392383`. Para volver al estado anterior en desarrollo, usar el código previo, apuntar `DATABASE_URL` a una copia de ese respaldo, regenerar Prisma y reiniciar el backend. El respaldo corresponde al momento de la migración.

`npm run prisma:generate` encontró la DLL del motor en uso en Windows. Se generó el cliente con el mismo esquema en una carpeta temporal del proyecto y se instalaron sus archivos con el motor existente. La suite de integración utilizó ese cliente. El despliegue ejecutó `prisma/migrate.js`, el programa de `npm run prisma:deploy`.

## Archivos de la implementación

- Datos y documentación. `README.md`, `backend/prisma/schema.prisma`, `backend/prisma/seed.js` y `backend/prisma/migrations/20261125020000_caniles_grupales_cuarentena_historial/migration.sql`.
- Backend. Rutas, controlador y esquemas de Caniles. Servicios `canil.service.js`, `canilOcupacion.js`, `canilHistorial.js`, `cuarentena.service.js`, `animal.service.js`, `salud.service.js`, `adopcionEtapa.service.js`, `devolucion.service.js`, `audit.service.js`, `dashboard.service.js`, `export.service.js` y `utils/fechas.js`.
- Frontend. `App.jsx`, `CanilesPage.jsx`, `AnimalFormModal.jsx`, componentes en `src/components/caniles/`, esquema y servicio de Caniles, hooks de arrastre y lecturas de notificaciones, `utils/dias.js`, `utils/qr.js`, `styles/caniles.css`, `.env.example` y manifiestos de npm.
- Pruebas. `backend/tests/caniles.integration.test.js`, `backend/tests/caniles.dias.test.js`, `backend/tests/adopcion.migration.test.js`, `backend/tests/adopcion.etapas.integration.test.js` y `frontend/tests/caniles-mapa.test.jsx`.

La suite de Node pasó 71 pruebas, incluida la migración desde la base histórica. Vitest pasó 95 pruebas. Vite generó la compilación de producción.
