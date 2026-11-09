import React from 'react';
import { resultadoEvaluacionActual } from './flujoAdopcion';

export default function SolicitudProgreso({ solicitud }) {
  const cerrada = ['CANCELADA', 'RECHAZADA'].includes(solicitud.estado);
  const resultado = resultadoEvaluacionActual(solicitud);
  const estadoPrevio = solicitud.etapas?.at(-1)?.estadoAnterior || 'RECIBIDA';
  const estado = cerrada ? estadoPrevio : solicitud.estado;
  const nivel = { RECIBIDA: 0, EN_EVALUACION: resultado === 'CUMPLE' ? (solicitud.visitaOmitida ? 3 : 2) : 1, VISITA_AGENDADA: 2, VISITA_REALIZADA: 3, APROBADA: 3, ENTREGADA: 4 };
  const actual = cerrada ? 4 : ['VISITA_AGENDADA', 'VISITA_REALIZADA'].includes(estado) && resultado !== 'CUMPLE' ? 1 : nivel[estado];
  const pasos = ['Solicitud recibida', 'Evaluación', 'Visita previa al hogar', 'Aprobación', solicitud.estado === 'RECHAZADA' ? 'Solicitud rechazada' : solicitud.estado === 'CANCELADA' ? 'Proceso cancelado' : 'Adopción exitosa'];
  const completados = [true,
    resultado === 'CUMPLE' || ['APROBADA', 'ENTREGADA'].includes(estado),
    ['VISITA_REALIZADA', 'APROBADA', 'ENTREGADA'].includes(estado) || solicitud.visitaOmitida,
    ['APROBADA', 'ENTREGADA'].includes(estado), solicitud.estado === 'ENTREGADA'];
  const descripcion = indice => {
    if (cerrada && indice === 4) return 'Proceso cerrado';
    if (indice === 1 && resultado === 'NO_CUMPLE') return 'No cumple';
    if (indice === 1 && resultado === 'PENDIENTE') return 'Pendiente de información';
    if (indice === 1 && resultado === 'CUMPLE') return 'Cumple';
    if (indice === 2 && solicitud.visitaOmitida) return 'Omitida con motivo';
    if (indice === 2 && estado === 'VISITA_AGENDADA') return cerrada ? 'No realizada' : 'Visita agendada';
    if (indice === 3 && solicitud.estado === 'APROBADA') return 'Pendiente de entrega';
    return completados[indice] ? 'Completada' : cerrada ? 'No realizada' : actual === indice ? 'En curso' : 'Pendiente';
  };
  return <>
    <ol className="adopciones-progreso" aria-label="Progreso de la adopción">
      {pasos.map((paso, indice) => <li key={paso} className={`${completados[indice] ? 'completado' : ''} ${actual === indice ? 'actual' : ''} ${cerrada && indice === 4 ? 'cerrado' : ''}`} aria-current={actual === indice ? 'step' : undefined}>
        <span className="adopciones-paso-numero" aria-hidden="true">{cerrada && indice === 4 ? '×' : completados[indice] ? '✓' : indice + 1}</span>
        <strong>{paso}</strong><small>{descripcion(indice)}</small>
      </li>)}
    </ol>
    {cerrada && <p className="adopciones-alert" role="status">{solicitud.estado === 'CANCELADA'
      ? 'Proceso cancelado. Conserva su historial y no permite añadir etapas. Para iniciar otro proceso, crea una nueva solicitud.'
      : 'Solicitud rechazada. Conserva su historial y no permite añadir etapas.'}</p>}
  </>;
}
