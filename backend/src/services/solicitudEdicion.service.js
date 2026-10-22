import prisma from '../config/prisma.js';
import { AdopcionError } from './adopcion.service.js';

export const modificarSolicitud = async (id, data, responsable, ip, eliminar = false) => {
  try {
    return await prisma.$transaction(async tx => {
      const anterior = await tx.solicitudAdopcion.findUnique({ where: { id }, include: { postulante: true, adopcion: true } });
      if (!anterior) throw new AdopcionError(404, 'Solicitud no encontrada');
      if (anterior.estado !== 'RECIBIDA' || anterior.adopcion) throw new AdopcionError(409, 'Solo se pueden editar o eliminar solicitudes recibidas, sin adopción asociada.');
      if (anterior.actualizadoEn.toISOString() !== data.actualizadoEn) throw new AdopcionError(409, 'La solicitud cambió. Vuelve a abrir su detalle antes de continuar.');
      let cambios = { estado: 'CANCELADA' };
      if (!eliminar) {
        if (data.postulante.tipoIdentificacion !== anterior.datosPostulante.tipoIdentificacion || data.postulante.identificacion !== anterior.datosPostulante.identificacion) throw new AdopcionError(400, 'La identidad del postulante no se puede cambiar.');
        if (!anterior.postulante.activo) throw new AdopcionError(409, 'El postulante está dado de baja.');
        const animal = await tx.animal.findFirst({ where: { id: data.animalId, activo: true, adopciones: { none: { devolucion: false, registroDevolucion: { is: null }, etapa: { in: ['Adoptado', 'Entregada', 'Seguimiento 15d', 'Seguimiento 30d'] } } } } });
        if (!animal) throw new AdopcionError(409, 'El animal seleccionado ya no está disponible.');
        const { tipoIdentificacion, identificacion, ...contacto } = data.postulante;
        const postulante = await tx.postulante.update({ where: { id: anterior.postulanteId }, data: contacto });
        await tx.auditoria.create({ data: { usuarioId: responsable.id, usuarioEmail: responsable.email, usuarioNombre: responsable.nombre, ipAddress: ip, entidad: 'Postulante', entidadId: postulante.id, accion: 'MODIFICACION', valorAnterior: JSON.parse(JSON.stringify(anterior.postulante)), valorNuevo: JSON.parse(JSON.stringify(postulante)) } });
        cambios = { animalId: data.animalId, motivacion: data.motivacion, datosPostulante: data.postulante };
      }
      const solicitud = await tx.solicitudAdopcion.update({ where: { id }, data: cambios });
      await tx.auditoria.create({ data: { usuarioId: responsable.id, usuarioEmail: responsable.email, usuarioNombre: responsable.nombre, ipAddress: ip, entidad: 'SolicitudAdopcion', entidadId: id, accion: eliminar ? 'BAJA_LOGICA' : 'MODIFICACION', valorAnterior: JSON.parse(JSON.stringify(anterior)), valorNuevo: JSON.parse(JSON.stringify(solicitud)) } });
      return { solicitud, alertas: [] };
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (['P2034', 'P2002', 'P2003'].includes(error.code)) throw new AdopcionError(409, 'Hubo un cambio simultáneo. Vuelve a abrir la solicitud antes de reintentar.');
    throw error;
  }
};
