import prisma from '../config/prisma.js';
import { AdopcionError } from './adopcion.service.js';

const transiciones = {
  EVALUAR: { desde: ['RECIBIDA', 'EN_EVALUACION', 'VISITA_AGENDADA', 'VISITA_REALIZADA'], hasta: 'EN_EVALUACION' },
  AGENDAR_VISITA: { desde: ['EN_EVALUACION', 'VISITA_AGENDADA'], hasta: 'VISITA_AGENDADA' },
  REGISTRAR_VISITA: { desde: ['EN_EVALUACION', 'VISITA_AGENDADA'], hasta: 'VISITA_REALIZADA' },
  OMITIR_VISITA: { desde: ['EN_EVALUACION', 'VISITA_AGENDADA'], hasta: 'EN_EVALUACION' },
  APROBAR: { desde: ['EN_EVALUACION', 'VISITA_REALIZADA'], hasta: 'APROBADA' },
  RECHAZAR: { desde: ['RECIBIDA', 'EN_EVALUACION', 'VISITA_AGENDADA', 'VISITA_REALIZADA'], hasta: 'RECHAZADA' },
  CANCELAR: { desde: ['APROBADA'], hasta: 'CANCELADA' },
  ENTREGAR: { desde: ['APROBADA'], hasta: 'ENTREGADA' }
};
const json = value => JSON.parse(JSON.stringify(value));
const vigente = { devolucion: false, registroDevolucion: { is: null }, etapa: { in: ['Adoptado', 'Entregada', 'Seguimiento 15d', 'Seguimiento 30d'] } };
const segundo = date => Math.floor(new Date(date).getTime() / 1000);

export const actualizarEtapa = async (id, data, responsable, ip) => {
  try {
    return await prisma.$transaction(async tx => {
      // Bloquear primero la solicitud; los cierres de un mismo animal se serializan después.
      await tx.$queryRaw`SELECT id FROM solicitudes_adopcion WHERE id = ${id} FOR UPDATE`;
      const anterior = await tx.solicitudAdopcion.findUnique({ where: { id }, include: {
        postulante: true, adopcion: true, etapas: { orderBy: [{ registradoEn: 'asc' }, { id: 'asc' }] }
      } });
      if (!anterior) throw new AdopcionError(404, 'Solicitud no encontrada');
      if (anterior.actualizadoEn.toISOString() !== data.actualizadoEn) throw new AdopcionError(409, 'La solicitud cambió. Recarga su detalle antes de continuar.');
      const transicion = transiciones[data.accion];
      if (!transicion?.desde.includes(anterior.estado) || anterior.adopcion) throw new AdopcionError(409, 'La acción no está permitida en la etapa actual.');
      if (!['RECHAZAR', 'CANCELAR'].includes(data.accion) && !anterior.postulante.activo) throw new AdopcionError(409, 'El postulante está dado de baja.');
      const evaluacion = anterior.etapas.filter(e => e.accion === 'EVALUAR').at(-1);
      if (['AGENDAR_VISITA', 'REGISTRAR_VISITA', 'OMITIR_VISITA', 'APROBAR'].includes(data.accion) && evaluacion?.resultadoEvaluacion !== 'CUMPLE') {
        throw new AdopcionError(409, 'Antes de continuar, registra una evaluación con resultado Cumple.');
      }
      let estadoNuevo = transicion.hasta;
      if (data.accion === 'EVALUAR') {
        estadoNuevo = data.resultadoEvaluacion === 'NO_CUMPLE' ? 'RECHAZADA'
          : data.resultadoEvaluacion === 'CUMPLE' && ['VISITA_AGENDADA', 'VISITA_REALIZADA'].includes(anterior.estado) ? anterior.estado : 'EN_EVALUACION';
      }
      if (data.accion === 'APROBAR' && anterior.estado !== 'VISITA_REALIZADA' && !(anterior.visitaOmitida && anterior.motivoOmisionVisita?.trim())) {
        throw new AdopcionError(409, 'Antes de aprobar debes registrar la visita al hogar o justificar su omisión.');
      }
      const fecha = new Date(data.fecha);
      const ultimaReal = anterior.etapas.filter(e => e.accion !== 'AGENDAR_VISITA').at(-1);
      if (segundo(fecha) < segundo(ultimaReal?.fecha || anterior.creadoEn)) throw new AdopcionError(400, 'La fecha no puede ser anterior al último paso registrado ni a la solicitud.');
      if (data.accion === 'AGENDAR_VISITA' ? segundo(fecha) < segundo(new Date()) : fecha.getTime() > Date.now()) {
        throw new AdopcionError(400, data.accion === 'AGENDAR_VISITA' ? 'Agenda la visita para una fecha futura.' : 'La fecha de una acción realizada no puede estar en el futuro.');
      }
      const autor = { usuarioId: responsable.id, usuarioNombre: responsable.nombre, usuarioEmail: responsable.email, ipAddress: ip };
      const auditar = (entidad, entidadId, antes, despues) => tx.auditoria.create({ data: {
        ...autor, entidad, entidadId, accion: antes ? 'MODIFICACION' : 'CREACION',
        ...(antes && { valorAnterior: json(antes) }), valorNuevo: json(despues)
      } });
      let adopcion = null;
      if (['APROBAR', 'ENTREGAR'].includes(data.accion)) {
        await tx.$queryRaw`SELECT id FROM animales WHERE id = ${anterior.animalId} FOR UPDATE`;
        const animal = await tx.animal.findUnique({ where: { id: anterior.animalId } });
        if (!animal?.activo || animal.estadoAdopcion === 'ADOPTADO' || await tx.adopcion.findFirst({ where: { animalId: anterior.animalId, ...vigente } })) {
          throw new AdopcionError(409, 'El animal ya no está disponible para adopción.');
        }
        if (data.accion === 'ENTREGAR') {
          // Registro, ficha, canil e historial se confirman juntos o se revierten juntos.
          adopcion = await tx.adopcion.create({ data: {
            solicitudId: id, animalId: anterior.animalId, postulanteId: anterior.postulanteId,
            fecha, responsableId: responsable.id, etapa: 'Adoptado'
          } });
          const configMax = await tx.configuracionSistema.findUnique({ where: { clave: 'SEGUIMIENTO_MAX_INTENTOS' } });
          const limiteIntentos = configMax ? parseInt(configMax.valor, 10) || 3 : 3;
          const fecha15 = new Date(fecha.getTime() + 15 * 24 * 60 * 60 * 1000);
          const fecha30 = new Date(fecha.getTime() + 30 * 24 * 60 * 60 * 1000);
          await tx.seguimientoAdopcion.createMany({
            data: [
              { adopcionId: adopcion.id, tipoSeguimiento: 'SEGUIMIENTO_15_DIAS', diasProgramados: 15, fechaProgramada: fecha15, estado: 'PENDIENTE', limiteIntentos },
              { adopcionId: adopcion.id, tipoSeguimiento: 'SEGUIMIENTO_30_DIAS', diasProgramados: 30, fechaProgramada: fecha30, estado: 'PENDIENTE', limiteIntentos }
            ]
          });
          const actualizado = await tx.animal.update({ where: { id: animal.id }, data: { estadoAdopcion: 'ADOPTADO', canilId: null } });
          await auditar('Animal', animal.id, animal, actualizado);
          if (animal.canilId) {
            const canil = await tx.canil.findUnique({ where: { id: animal.canilId } });
            const libre = await tx.canil.update({ where: { id: animal.canilId }, data: { estado: 'LIBRE' } });
            await auditar('Canil', canil.id, canil, libre);
          }
          await auditar('Adopcion', adopcion.id, null, adopcion);
        }
      }
      const visita = data.accion === 'EVALUAR' && data.resultadoEvaluacion !== 'CUMPLE'
        ? { visitaOmitida: false, motivoOmisionVisita: null }
        : data.accion === 'OMITIR_VISITA'
        ? { visitaOmitida: true, motivoOmisionVisita: data.motivoOmision }
        : ['AGENDAR_VISITA', 'REGISTRAR_VISITA'].includes(data.accion) ? { visitaOmitida: false, motivoOmisionVisita: null } : {};
      const solicitud = await tx.solicitudAdopcion.update({ where: { id }, data: { estado: estadoNuevo, ...visita } });
      await tx.etapaSolicitudAdopcion.create({ data: {
        solicitudId: id, accion: data.accion, estadoAnterior: anterior.estado, estadoNuevo,
        fecha, observaciones: data.observaciones, resultadoEvaluacion: data.resultadoEvaluacion || null, motivoOmision: data.motivoOmision || null, responsableId: responsable.id
      } });
      await auditar('SolicitudAdopcion', id, anterior, { ...solicitud, accion: data.accion, resultadoEvaluacion: data.resultadoEvaluacion || null, observaciones: data.observaciones, fecha });
      return { solicitud, adopcion };
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (['P2034', 'P2002', 'P2003'].includes(error.code) || (error.code === 'P2010' && ['40001', '40P01'].includes(error.meta?.code))) throw new AdopcionError(409, 'Hubo un cambio simultáneo. Recarga la solicitud antes de reintentar.');
    throw error;
  }
};
