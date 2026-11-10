# RF1 — Commit 2: etapas y entrega

En Adopciones → Ver detalle se muestran el formulario de etapas y el historial de acciones con fecha, responsable y observaciones.

## Flujo

Solicitud → Evaluación → Visita previa al hogar → Aprobada, pendiente de entrega → Adopción exitosa.

- La evaluación exige un resultado: Cumple, No cumple o Pendiente de información.
- Cumple permite agendar/registrar la visita previa o justificar su omisión. No cumple rechaza con motivo obligatorio. Pendiente de información mantiene la evaluación abierta y bloquea el avance hasta registrar Cumple.
- Las evaluaciones antiguas sin resultado se conservan. Se puede registrar el resultado en el mismo detalle antes de continuar, sin borrar visitas existentes.
- La visita del RF1 ocurre antes de la adopción y revisa espacio, seguridad y condiciones de cuidado del hogar. Revisar cómo vive el animal después de entregarlo corresponde al seguimiento del RF2 (Commit 3).
- Omitir la visita exige un motivo de 3 a 2000 caracteres. Solo una visita realizada o una omisión justificada permite aprobar.
- Aprobada, pendiente de entrega → confirmar adopción exitosa cuando el animal sea entregado. Solo entonces cambia a adoptado y se libera su canil.
- Antes de aprobar se puede rechazar con motivo. Después de aprobar se puede cancelar el proceso con motivo o concretar la adopción; no se permite rechazar.
- Rechazada, Cancelada y Adopción exitosa son finales. Una devolución después de concretar se gestionará en RF2 (Commit 4).
- Agendar otra visita o dejar una nueva evaluación pendiente invalida una omisión anterior, conservándola en el historial.

Cada acción exige fecha y observaciones (3–4000 caracteres). Las fechas realizadas no pueden estar en el futuro ni retroceder respecto del último paso realizado. La agenda exige una fecha futura. Se compara a precisión de segundos para admitir la entrada de fecha/hora del formulario.

La identidad y el responsable original de la solicitud permanecen intactos. Cada etapa usa el usuario autenticado y verifica su rol y estado activo actual. Un detalle desactualizado devuelve 409 y debe recargarse.

## Cierre atómico

La entrega crea Adopcion con fecha, responsable y solicitud asociada. Actualiza Animal.estadoAdopcion a ADOPTADO, desvincula su canil y marca ese canil LIBRE. Conserva ficha, estado de salud, alta lógica e historial; registra auditoría de la solicitud, animal, canil y adopción en la misma transacción. Los bloqueos y el aislamiento serializable impiden dos entregas del mismo animal. Un fallo revierte todos los cambios.

El catálogo muestra la etiqueta Adoptado. Las nuevas solicitudes excluyen animales adoptados, y el módulo de caniles rechaza una nueva asignación de esos animales.

La programación de seguimientos corresponde al Commit 3.

## Migración

Con DATABASE_URL apuntando a la base local y desde backend:

```sh
npm exec -- prisma migrate deploy
npm exec -- prisma generate
```

Las migraciones añaden el resultado explícito de evaluación (sin inventarlo para registros antiguos), el estado administrativo, el responsable de entrega y el historial de etapas. Reconoce adopciones históricas vigentes como ADOPTADO; no inventa sus responsables ni altera sus fichas o caniles anteriores. La base local de desarrollo fue respaldada antes de aplicar la migración.

## API

POST /api/adopciones/solicitudes/:id/etapas recibe accion, fecha ISO, observaciones y actualizadoEn (del detalle). Solo OMITIR_VISITA recibe además motivoOmision. EVALUAR exige resultadoEvaluacion (CUMPLE, NO_CUMPLE o PENDIENTE). Acciones: EVALUAR, AGENDAR_VISITA, REGISTRAR_VISITA, OMITIR_VISITA, APROBAR, RECHAZAR, CANCELAR, ENTREGAR. Se conservan los estados técnicos para compatibilidad: ENTREGADA se muestra como Adopción exitosa.

GET /api/adopciones/solicitudes/:id incluye etapas y adopcion con sus responsables.

## Pruebas

Desde la raíz, con una base de pruebas local cuyo nombre incluya test:

```sh
TEST_DATABASE_URL='postgresql://usuario@localhost:5432/huellas_test' node --test backend/tests/adopcion.schema.test.js backend/tests/adopcion.integration.test.js backend/tests/adopcion.migration.test.js backend/tests/adopcion.etapas.integration.test.js frontend/tests/session.test.mjs
npm --prefix frontend run build
```

Las pruebas crean y eliminan solo sus esquemas aislados. La prueba de reversión provoca intencionalmente un error de auditoría y verifica que nada quede aplicado.

## Revisión manual

1. Crear una solicitud de prueba y abrir su detalle.
2. Registrar evaluación Pendiente de información: no debe permitir visitas ni aprobación. Registrar Cumple: habilita la visita. Comprobar resultado, fecha, responsable y observaciones en el historial.
3. Agendar la visita y registrar su realización. Alternativamente, omitirla: el motivo vacío debe impedir guardar.
4. Aprobar. El animal aún conserva su canil.
5. Confirmar la entrega. Comprobar estado Adopción exitosa, fecha y responsable de adopción, etiqueta Adoptado en el catálogo y canil libre.
6. Comprobar que no se puede entregar nuevamente ni crear otra solicitud para ese animal.
7. En otra solicitud, evaluar No cumple con motivo: debe quedar rechazada. En otra aprobada, cancelar con motivo: debe quedar cancelada. Ninguna de esas acciones cambia el animal ni libera su canil.
8. Revisar en Auditoría las modificaciones de la entrega.
