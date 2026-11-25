import { EventEmitter } from 'events';
import prisma from '../config/prisma.js';
import { etiquetaRolHistorico } from '../constants/usuarios.js';

export const notificationEmitter = new EventEmitter();

// Almacén interno en memoria de notificaciones recientes para el personal del refugio
const notificacionesMemoria = [];
const MAX_NOTIFICACIONES = 50;

const limpiarReferenciasInternas = (texto) => String(texto || '')
  .replace(/#\s*\d+/g, '')
  .replace(/\bID\s*(?:Ficha|Solicitud|Registro|Animal|Canil)\s*:?\s*\d+/gi, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

// Listener interno para trazabilidad en consola del servidor
notificationEmitter.on('notificacion:personal', (notificacion) => {
  console.log(
    `[NOTIFICACIÓN REFUGIO] [${notificacion.tipo}] ${notificacion.titulo} — ${notificacion.mensaje}`
  );
});

/**
 * Dispara una notificación dirigida al personal del refugio
 * @param {Object} params
 * @param {string} params.tipo - 'INGRESO_ANIMAL' | 'EXPORTACION_PDF' | 'EXPORTACION_CSV'
 * @param {string} params.titulo - Título breve de la notificación
 * @param {string} params.mensaje - Descripción detallada del evento
 * @param {string[]} [params.destinatarios] - Roles destinatarios
 * @param {Object} [params.usuario] - Usuario que originó el evento
 * @param {Object} [params.metadata] - Datos adicionales asociados al evento
 */
export const notificarPersonalRefugio = async ({
  tipo,
  titulo,
  mensaje,
  destinatarios = ['DIRECCION', 'PERSONAL_VETERINARIO', 'PERSONAL_ADOPCIONES'],
  usuario = null,
  metadata = {}
}) => {
  const nuevaNotificacion = {
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    tipo,
    titulo: limpiarReferenciasInternas(titulo),
    mensaje: limpiarReferenciasInternas(mensaje),
    destinatarios,
    emitidoPor: usuario
      ? {
          id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol
        }
      : { nombre: 'Sistema', rol: 'SISTEMA' },
    metadata,
    fechaHora: new Date().toISOString()
  };

  notificacionesMemoria.unshift(nuevaNotificacion);
  if (notificacionesMemoria.length > MAX_NOTIFICACIONES) {
    notificacionesMemoria.pop();
  }

  notificationEmitter.emit('notificacion:personal', nuevaNotificacion);

  return nuevaNotificacion;
};

/**
 * Obtiene las notificaciones activas para el personal del refugio,
 * combinando los eventos en memoria con los registros recientes de auditoría
 * para mantener persistencia ante reinicios del servidor.
 */
export const obtenerNotificacionesPersonal = async (limit = 15) => {
  try {
    const auditoriasRecientes = await prisma.auditoria.findMany({
      where: {
        OR: [
          { entidad: 'Animal', accion: 'CREACION' },
          { entidad: { startsWith: 'Reporte' } }
        ]
      },
      orderBy: { fechaHora: 'desc' },
      take: limit
    });

    const desdeAuditoria = auditoriasRecientes.map((aud) => {
      const esReporte = aud.entidad.startsWith('Reporte');
      const info = aud.valorNuevo || {};

      if (esReporte) {
        return {
          id: `aud-${aud.id}`,
          tipo: info.tipoReporte === 'CSV' ? 'EXPORTACION_CSV' : 'EXPORTACION_PDF',
          titulo: `Exportación de ${info.tipoReporte || 'Reporte'} realizada`,
          mensaje: limpiarReferenciasInternas(`${aud.usuarioNombre || 'Usuario'} (${etiquetaRolHistorico(info.rolUsuario, info.sexoUsuario) || 'Personal'}) exportó: ${info.recursoExportado || aud.entidad}.`),
          destinatarios: ['DIRECCION', 'PERSONAL_VETERINARIO', 'PERSONAL_ADOPCIONES'],
          emitidoPor: {
            id: aud.usuarioId,
            nombre: aud.usuarioNombre || 'Sistema',
            email: aud.usuarioEmail
          },
          metadata: info,
          fechaHora: aud.fechaHora.toISOString()
        };
      }

      return {
        id: `aud-${aud.id}`,
        tipo: 'INGRESO_ANIMAL',
        titulo: `Nuevo ingreso registrado: ${info.nombre || 'Animal sin nombre registrado'}`,
        mensaje: `${aud.usuarioNombre || 'Voluntario/Personal'} registró el ingreso de ${info.nombre || 'un animal'} (${info.especie || 'Especie'}, ${info.sexo || 'Sexo'})${info.tipoIngreso ? ` por ${info.tipoIngreso}` : ''}. Ficha del animal disponible.`,
        destinatarios: ['DIRECCION', 'PERSONAL_VETERINARIO', 'PERSONAL_ADOPCIONES'],
        emitidoPor: {
          id: aud.usuarioId,
          nombre: aud.usuarioNombre || 'Sistema',
          email: aud.usuarioEmail
        },
        metadata: {
          animalId: aud.entidadId,
          nombre: info.nombre,
          especie: info.especie,
          sexo: info.sexo,
          estadoSalud: info.estadoSalud,
          tipoIngreso: info.tipoIngreso || 'Rescate'
        },
        fechaHora: aud.fechaHora.toISOString()
      };
    });

    // Si hay notificaciones en memoria que aún no están reflejadas o viceversa, unificarlas por cercanía/contenido
    if (desdeAuditoria.length > 0) {
      return desdeAuditoria.slice(0, limit);
    }

    return notificacionesMemoria.slice(0, limit);
  } catch (error) {
    console.error('Error al consultar notificaciones:', error.message);
    return notificacionesMemoria.slice(0, limit);
  }
};
