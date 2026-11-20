import prisma from '../config/prisma.js';
import { AdopcionError } from './adopcion.service.js';

export const modificarSolicitud = async (id, data, responsable, ip, eliminar = false) => {
  try {
    return await prisma.$transaction(async tx => {
      const anterior = await tx.solicitudAdopcion.findUnique({ where: { id }, include: { postulante: true, adopcion: true } });
      if (!anterior) throw new AdopcionError(404, 'No encontramos esta solicitud. Puede que ya no exista.');
      if (anterior.estado !== 'RECIBIDA' || anterior.adopcion) throw new AdopcionError(409, 'Solo se pueden editar o cancelar las solicitudes que aún están en estado «Recibida».');
      if (anterior.actualizadoEn.toISOString() !== data.actualizadoEn) throw new AdopcionError(409, 'Otra persona modificó esta solicitud mientras la veías. Ciérrala y ábrela de nuevo para ver los cambios.');
      let cambios = { estado: 'CANCELADA' };
      if (!eliminar) {
        if (data.postulante.tipoIdentificacion !== anterior.datosPostulante.tipoIdentificacion || data.postulante.identificacion !== anterior.datosPostulante.identificacion) throw new AdopcionError(400, 'No se puede cambiar el RUT o documento de la persona postulante.');
        if (!anterior.postulante.activo) throw new AdopcionError(409, 'Esta persona fue dada de baja y no puede postular por ahora.');
        const animal = await tx.animal.findFirst({ where: { id: data.animalId, activo: true, estadoAdopcion: 'EN_REFUGIO', adopciones: { none: { devolucion: false, registroDevolucion: { is: null }, etapa: { in: ['Adoptado', 'Entregada', 'Seguimiento 15d', 'Seguimiento 30d'] } } } } });
        if (!animal) throw new AdopcionError(409, 'El animal elegido ya no está disponible. Elige otro de la lista.');
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
    if (['P2034', 'P2002', 'P2003'].includes(error.code)) throw new AdopcionError(409, 'Alguien más hizo un cambio al mismo tiempo. Cierra la solicitud, ábrela de nuevo e inténtalo otra vez.');
    throw error;
  }
};
