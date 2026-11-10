import prisma from '../config/prisma.js';
import { registrarAuditoria } from './audit.service.js';

export const ROLES_COORDINADOR = ['DIRECTORA', 'COORDINADOR'];
export const esCoordinador = (rol) => ROLES_COORDINADOR.includes(rol);

export const ROLES_PERSONAL_AVANZADO = ['DIRECTORA', 'COORDINADOR', 'VETERINARIA', 'VOLUNTARIO_AVANZADO'];
export const esPersonalAvanzado = (rol) => ROLES_PERSONAL_AVANZADO.includes(rol);

const DIAS_ORDEN = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/**
 * Obtener todos los turnos con sus voluntarios inscritos
 */
export const getTurnos = async (filtros = {}) => {
  const where = {};
  if (filtros.diaSemana) where.diaSemana = filtros.diaSemana;
  if (filtros.franja) where.franja = filtros.franja;
  if (filtros.area) where.area = filtros.area;

  const turnos = await prisma.turno.findMany({
    where,
    include: {
      inscripciones: {
        where: { estado: 'CONFIRMADA' },
        include: {
          usuario: { select: { id: true, nombre: true, email: true, rol: true } }
        }
      },
      bitacoras: {
        include: {
          usuario: { select: { id: true, nombre: true } }
        }
      }
    },
    orderBy: [{ id: 'asc' }]
  });

  return turnos.map(t => {
    const inscritos = t.inscripciones || [];
    const estaCubierto = inscritos.length > 0;
    const cupoDisponible = Math.max(0, t.cupoMaximo - inscritos.length);
    const estaLleno = cupoDisponible === 0;

    return {
      ...t,
      cubierto: estaCubierto,
      inscritosCount: inscritos.length,
      cupoDisponible,
      estaLleno,
      esDescubierto: !estaCubierto,
      voluntariosNombres: inscritos.map(i => i.usuario.nombre).join(', ') || 'Sin asignar'
    };
  });
};

/**
 * Obtener matriz interactiva estructurada por franjas y días
 */
export const getMatrizTurnos = async () => {
  const turnos = await getTurnos();

  const franjasMap = {
    'Mañana': 'Mañana (08:00 - 13:00)',
    'Tarde': 'Tarde (14:00 - 19:00)'
  };

  const matriz = {
    dias: DIAS_ORDEN,
    franjas: ['Mañana', 'Tarde'],
    turnosPorFranja: {
      'Mañana': {},
      'Tarde': {}
    },
    estadisticas: {
      totalTurnos: turnos.length,
      turnosCubiertos: turnos.filter(t => t.cubierto).length,
      turnosDescubiertos: turnos.filter(t => !t.cubierto).length,
      planificacionConfirmada: turnos.every(t => t.estadoPlanificacion === 'CONFIRMADA') && turnos.length > 0
    }
  };

  // Inicializar días en blanco
  DIAS_ORDEN.forEach(dia => {
    matriz.turnosPorFranja['Mañana'][dia] = [];
    matriz.turnosPorFranja['Tarde'][dia] = [];
  });

  turnos.forEach(t => {
    const franjaKey = t.franja.includes('Mañana') || t.franja.includes('manana') ? 'Mañana' : 'Tarde';
    if (!matriz.turnosPorFranja[franjaKey][t.diaSemana]) {
      matriz.turnosPorFranja[franjaKey][t.diaSemana] = [];
    }
    matriz.turnosPorFranja[franjaKey][t.diaSemana].push(t);
  });

  return matriz;
};

/**
 * Crear un nuevo turno (Exclusivo Coordinador)
 */
export const createTurno = async (data, user, ip) => {
  if (!esCoordinador(user.rol)) {
    const error = new Error('Acceso denegado: Solo el personal con rol de Coordinador puede crear turnos en la matriz.');
    error.statusCode = 403;
    throw error;
  }

  const nuevo = await prisma.turno.create({
    data: {
      ...data,
      cubierto: false,
      estadoPlanificacion: 'BORRADOR'
    }
  });

  await registrarAuditoria({
    entidad: 'Turnos',
    entidadId: nuevo.id,
    accion: 'CREACION',
    valorAnterior: null,
    valorNuevo: nuevo,
    usuario: user,
    ip
  });

  return nuevo;
};

/**
 * Modificar un turno en la matriz (Exclusivo Coordinador)
 */
export const updateTurno = async (id, data, user, ip) => {
  if (!esCoordinador(user.rol)) {
    const error = new Error('Acceso denegado: Solo el Coordinador puede modificar la configuración de los turnos.');
    error.statusCode = 403;
    throw error;
  }

  const anterior = await prisma.turno.findUnique({ where: { id: Number(id) } });
  if (!anterior) {
    const error = new Error('Turno no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const actualizado = await prisma.turno.update({
    where: { id: Number(id) },
    data
  });

  await registrarAuditoria({
    entidad: 'Turnos',
    entidadId: actualizado.id,
    accion: 'MODIFICACION',
    valorAnterior: anterior,
    valorNuevo: actualizado,
    usuario: user,
    ip
  });

  return actualizado;
};

/**
 * Eliminar un turno (Exclusivo Coordinador)
 */
export const deleteTurno = async (id, user, ip) => {
  if (!esCoordinador(user.rol)) {
    const error = new Error('Acceso denegado: Solo el Coordinador puede eliminar turnos de la matriz.');
    error.statusCode = 403;
    throw error;
  }

  const anterior = await prisma.turno.findUnique({ where: { id: Number(id) } });
  if (!anterior) {
    const error = new Error('Turno no encontrado');
    error.statusCode = 404;
    throw error;
  }

  await prisma.turno.delete({ where: { id: Number(id) } });

  await registrarAuditoria({
    entidad: 'Turnos',
    entidadId: Number(id),
    accion: 'BAJA_LOGICA',
    valorAnterior: anterior,
    valorNuevo: null,
    usuario: user,
    ip
  });

  return { message: 'Turno eliminado correctamente' };
};

/**
 * Confirmar planificación semanal completa (Exclusivo Coordinador)
 * Deja la planificación semanal confirmada y habilita formalmente las bitácoras.
 */
export const confirmarPlanificacionSemanal = async (user, ip) => {
  if (!esCoordinador(user.rol)) {
    const error = new Error('Acceso denegado: Solo el Coordinador puede confirmar la planificación semanal.');
    error.statusCode = 403;
    throw error;
  }

  const actualizados = await prisma.turno.updateMany({
    data: { estadoPlanificacion: 'CONFIRMADA' }
  });

  await registrarAuditoria({
    entidad: 'Turnos',
    accion: 'MODIFICACION',
    valorAnterior: { estadoPlanificacion: 'BORRADOR' },
    valorNuevo: { estadoPlanificacion: 'CONFIRMADA', turnosAfectados: actualizados.count },
    usuario: user,
    ip
  });

  return {
    mensaje: 'Planificación semanal confirmada exitosamente. La matriz queda fijada y la bitácora habilitada.',
    turnosConfirmados: actualizados.count
  };
};

/**
 * GESTIÓN DE INSCRIPCIÓN INDIVIDUAL A TURNOS
 * Reglas de negocio estrictas:
 * 1. Inscripción previa obligatoria.
 * 2. Sin sobrecupos (aforo estricto según cupoMaximo).
 * 3. Sin cruces de horarios (mismo día y misma franja).
 * 4. Tareas críticas reservadas exclusivamente a personal avanzado.
 * 5. Voluntario gestiona su inscripción individual; Coordinador puede asignar a cualquiera.
 */
export const inscribirVoluntario = async (turnoId, user, payload = {}, ip) => {
  const tId = Number(turnoId);
  const turno = await prisma.turno.findUnique({
    where: { id: tId },
    include: {
      inscripciones: { where: { estado: 'CONFIRMADA' } }
    }
  });

  if (!turno) {
    const error = new Error('Turno no encontrado');
    error.statusCode = 404;
    throw error;
  }

  // Determinar usuario a inscribir
  let usuarioObjetivoId = user.id;
  let rolObjetivo = user.rol;
  let nombreObjetivo = user.nombre;

  if (payload.usuarioId && payload.usuarioId !== user.id) {
    // Solo un coordinador puede inscribir a otro voluntario
    if (!esCoordinador(user.rol)) {
      const error = new Error('Acceso denegado: Solo el Coordinador puede administrar e inscribir a otros voluntarios en la matriz.');
      error.statusCode = 403;
      throw error;
    }
    const targetUser = await prisma.usuario.findUnique({ where: { id: Number(payload.usuarioId) } });
    if (!targetUser || !targetUser.activo) {
      const error = new Error('El voluntario objetivo no existe o no está activo');
      error.statusCode = 404;
      throw error;
    }
    usuarioObjetivoId = targetUser.id;
    rolObjetivo = targetUser.rol;
    nombreObjetivo = targetUser.nombre;
  }

  // REGLA 1: Verificar si ya está inscrito en este turno
  const yaInscrito = turno.inscripciones.some(i => i.usuarioId === usuarioObjetivoId);
  if (yaInscrito) {
    const error = new Error('El voluntario ya se encuentra registrado e inscrito en este turno.');
    error.statusCode = 400;
    throw error;
  }

  // REGLA 2: SIN SOBRECUPOS
  if (turno.inscripciones.length >= turno.cupoMaximo) {
    const error = new Error(`Operación rechazada: Sobrecupo no permitido. Este turno ya alcanzó el aforo máximo de ${turno.cupoMaximo} voluntario(s).`);
    error.statusCode = 400;
    throw error;
  }

  // REGLA 3: SIN CRUCES DE HORARIOS
  // Buscar si el voluntario ya tiene otro turno confirmado en el mismo día y en la misma franja
  const turnosMismoHorario = await prisma.turno.findMany({
    where: {
      id: { not: tId },
      diaSemana: turno.diaSemana,
      franja: turno.franja,
      inscripciones: {
        some: {
          usuarioId: usuarioObjetivoId,
          estado: 'CONFIRMADA'
        }
      }
    }
  });

  if (turnosMismoHorario.length > 0) {
    const tConflicto = turnosMismoHorario[0];
    const error = new Error(`Operación rechazada por cruce de horarios: El voluntario ya está inscrito el ${turno.diaSemana} en la franja ${turno.franja} en el área de "${tConflicto.area}".`);
    error.statusCode = 400;
    throw error;
  }

  // REGLA 4: TAREAS CRÍTICAS RESERVADAS SOLO A PERSONAL AVANZADO
  const esAreaCritica = turno.esCritica ||
    turno.area.toLowerCase().includes('veterinaria') ||
    turno.area.toLowerCase().includes('clínica') ||
    turno.area.toLowerCase().includes('clinica') ||
    turno.area.toLowerCase().includes('crítico') ||
    turno.area.toLowerCase().includes('cuarentena');

  if (esAreaCritica && !esPersonalAvanzado(rolObjetivo)) {
    const error = new Error(`Acceso restringido: El área o tarea "${turno.area}" está catalogada como CRÍTICA y está reservada exclusivamente a Personal Avanzado (Veterinaria, Directora o Voluntario Avanzado). Tu rol actual es ${rolObjetivo}.`);
    error.statusCode = 403;
    throw error;
  }

  // Ejecutar inscripción en transacción
  const inscripcion = await prisma.$transaction(async (tx) => {
    const nuevaInscripcion = await tx.inscripcionTurno.create({
      data: {
        turnoId: tId,
        usuarioId: usuarioObjetivoId,
        inscritoPorId: user.id,
        estado: 'CONFIRMADA'
      },
      include: {
        usuario: { select: { id: true, nombre: true, email: true, rol: true } },
        turno: true
      }
    });

    // Actualizar campo cubierto del turno
    await tx.turno.update({
      where: { id: tId },
      data: {
        cubierto: true,
        voluntario: nombreObjetivo
      }
    });

    return nuevaInscripcion;
  });

  await registrarAuditoria({
    entidad: 'Turnos',
    entidadId: tId,
    accion: 'MODIFICACION',
    valorAnterior: { cubierto: turno.cubierto, inscritos: turno.inscripciones.length },
    valorNuevo: { inscripcionId: inscripcion.id, voluntario: nombreObjetivo, rol: rolObjetivo },
    usuario: user,
    ip
  });

  return inscripcion;
};

/**
 * Desinscribirse de un turno (o remover a un voluntario si es Coordinador)
 */
export const desinscribirVoluntario = async (turnoId, user, usuarioIdObjetivo = null, ip) => {
  const tId = Number(turnoId);
  const objetivoId = usuarioIdObjetivo ? Number(usuarioIdObjetivo) : user.id;

  if (objetivoId !== user.id && !esCoordinador(user.rol)) {
    const error = new Error('Acceso denegado: Solo el Coordinador puede desinscribir a otros voluntarios.');
    error.statusCode = 403;
    throw error;
  }

  const inscripcion = await prisma.inscripcionTurno.findFirst({
    where: {
      turnoId: tId,
      usuarioId: objetivoId,
      estado: 'CONFIRMADA'
    }
  });

  if (!inscripcion) {
    const error = new Error('No se encontró una inscripción activa del voluntario en este turno');
    error.statusCode = 404;
    throw error;
  }

  await prisma.$transaction(async (tx) => {
    await tx.inscripcionTurno.update({
      where: { id: inscripcion.id },
      data: { estado: 'CANCELADA' }
    });

    const restantes = await tx.inscripcionTurno.count({
      where: { turnoId: tId, estado: 'CONFIRMADA' }
    });

    await tx.turno.update({
      where: { id: tId },
      data: {
        cubierto: restantes > 0,
        voluntario: restantes === 0 ? null : undefined
      }
    });
  });

  await registrarAuditoria({
    entidad: 'Turnos',
    entidadId: tId,
    accion: 'MODIFICACION',
    valorAnterior: { inscripcionId: inscripcion.id, estado: 'CONFIRMADA' },
    valorNuevo: { estado: 'CANCELADA' },
    usuario: user,
    ip
  });

  return { message: 'Inscripción dada de baja correctamente' };
};

/**
 * GESTIÓN DE PERMUTAS DE TURNOS
 * Validación por ambas partes:
 * - Solicitante crea permuta -> estado PENDIENTE, aprobadoSolicitante: true
 * - Destinatario debe responder: si APROBAR -> intercambio atómico de turnos
 */
export const solicitarPermuta = async (data, user, ip) => {
  const solicitanteId = user.id;
  const destinatarioId = Number(data.destinatarioId);
  const turnoOrigenId = Number(data.turnoOrigenId);
  const turnoDestinoId = data.turnoDestinoId ? Number(data.turnoDestinoId) : null;

  if (solicitanteId === destinatarioId) {
    const error = new Error('No puedes solicitar una permuta contigo mismo.');
    error.statusCode = 400;
    throw error;
  }

  // 1. Verificar que el solicitante esté efectivamente inscrito en el turnoOrigen
  const inscripcionSolicitante = await prisma.inscripcionTurno.findFirst({
    where: {
      turnoId: turnoOrigenId,
      usuarioId: solicitanteId,
      estado: 'CONFIRMADA'
    },
    include: { turno: true }
  });

  if (!inscripcionSolicitante) {
    const error = new Error('Operación rechazada: Solo puedes solicitar permuta de turnos en los que te encuentras previamente inscrito.');
    error.statusCode = 400;
    throw error;
  }

  const destinatario = await prisma.usuario.findUnique({ where: { id: destinatarioId } });
  if (!destinatario || !destinatario.activo) {
    const error = new Error('El voluntario destinatario no existe o no se encuentra activo');
    error.statusCode = 404;
    throw error;
  }

  // 2. Si el turno origen es tarea crítica, el destinatario debe ser personal avanzado
  const turnoOrigen = inscripcionSolicitante.turno;
  const esOrigenCritico = turnoOrigen.esCritica ||
    turnoOrigen.area.toLowerCase().includes('veterinaria') ||
    turnoOrigen.area.toLowerCase().includes('clínica');

  if (esOrigenCritico && !esPersonalAvanzado(destinatario.rol)) {
    const error = new Error(`No se puede permutar este turno: El área "${turnoOrigen.area}" es una tarea CRÍTICA y el destinatario no cuenta con rango de Personal Avanzado.`);
    error.statusCode = 400;
    throw error;
  }

  // 3. Si se especificó turnoDestinoId, verificar que el destinatario esté inscrito en él
  if (turnoDestinoId) {
    const inscripcionDestinatario = await prisma.inscripcionTurno.findFirst({
      where: {
        turnoId: turnoDestinoId,
        usuarioId: destinatarioId,
        estado: 'CONFIRMADA'
      },
      include: { turno: true }
    });

    if (!inscripcionDestinatario) {
      const error = new Error('El voluntario destinatario no está inscrito en el turno propuesto para intercambio.');
      error.statusCode = 400;
      throw error;
    }

    const turnoDestino = inscripcionDestinatario.turno;
    const esDestinoCritico = turnoDestino.esCritica ||
      turnoDestino.area.toLowerCase().includes('veterinaria') ||
      turnoDestino.area.toLowerCase().includes('clínica');

    if (esDestinoCritico && !esPersonalAvanzado(user.rol)) {
      const error = new Error(`No puedes recibir ese turno en permuta: La tarea "${turnoDestino.area}" es CRÍTICA y tu rol no es de Personal Avanzado.`);
      error.statusCode = 400;
      throw error;
    }
  }

  // Crear solicitud de permuta
  const permuta = await prisma.permutaTurno.create({
    data: {
      solicitanteId,
      destinatarioId,
      turnoOrigenId,
      turnoDestinoId,
      motivo: data.motivo,
      aprobadoSolicitante: true,
      aprobadoDestinatario: false,
      estado: 'PENDIENTE'
    },
    include: {
      solicitante: { select: { id: true, nombre: true, email: true, rol: true } },
      destinatario: { select: { id: true, nombre: true, email: true, rol: true } },
      turnoOrigen: true,
      turnoDestino: true
    }
  });

  await registrarAuditoria({
    entidad: 'PermutaTurnos',
    entidadId: permuta.id,
    accion: 'CREACION',
    valorAnterior: null,
    valorNuevo: permuta,
    usuario: user,
    ip
  });

  return permuta;
};

/**
 * Listar permutas de turnos
 */
export const getPermutas = async (user) => {
  const where = {};
  if (!esCoordinador(user.rol)) {
    // Si no es coordinador, solo ve sus permutas donde es solicitante o destinatario
    where.OR = [
      { solicitanteId: user.id },
      { destinatarioId: user.id }
    ];
  }

  return await prisma.permutaTurno.findMany({
    where,
    include: {
      solicitante: { select: { id: true, nombre: true, email: true, rol: true } },
      destinatario: { select: { id: true, nombre: true, email: true, rol: true } },
      turnoOrigen: true,
      turnoDestino: true
    },
    orderBy: { fechaSolicitud: 'desc' }
  });
};

/**
 * Responder y validar permuta por ambas partes
 * Si se aprueba: se intercambian atómicamente los turnos
 */
export const responderPermuta = async (permutaId, accion, observacion, user, ip) => {
  const idNum = Number(permutaId);
  const permuta = await prisma.permutaTurno.findUnique({
    where: { id: idNum },
    include: {
      turnoOrigen: true,
      turnoDestino: true,
      solicitante: true,
      destinatario: true
    }
  });

  if (!permuta) {
    const error = new Error('Permuta no encontrada');
    error.statusCode = 404;
    throw error;
  }

  if (permuta.estado !== 'PENDIENTE') {
    const error = new Error(`Esta permuta ya fue resuelta con estado: ${permuta.estado}`);
    error.statusCode = 400;
    throw error;
  }

  // Solo el destinatario o un coordinador pueden responder
  const esDestinatario = user.id === permuta.destinatarioId;
  const esCoord = esCoordinador(user.rol);

  if (!esDestinatario && !esCoord) {
    const error = new Error('Acceso denegado: Solo el voluntario destinatario o el Coordinador pueden responder esta solicitud de permuta.');
    error.statusCode = 403;
    throw error;
  }

  if (accion === 'RECHAZAR') {
    const actualizada = await prisma.permutaTurno.update({
      where: { id: idNum },
      data: {
        estado: 'RECHAZADA',
        fechaResolucion: new Date(),
        observacionResolucion: observacion || 'Rechazada por el destinatario'
      }
    });

    await registrarAuditoria({
      entidad: 'PermutaTurnos',
      entidadId: idNum,
      accion: 'MODIFICACION',
      valorAnterior: { estado: 'PENDIENTE' },
      valorNuevo: { estado: 'RECHAZADA' },
      usuario: user,
      ip
    });

    return actualizada;
  }

  if (accion === 'APROBAR') {
    // INTERCAMBIO ATÓMICO DE TURNOS APROBADO POR AMBAS PARTES
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Desasignar solicitante de turnoOrigen
      await tx.inscripcionTurno.updateMany({
        where: { turnoId: permuta.turnoOrigenId, usuarioId: permuta.solicitanteId, estado: 'CONFIRMADA' },
        data: { estado: 'PERMUTADA' }
      });

      // 2. Asignar destinatario a turnoOrigen
      await tx.inscripcionTurno.create({
        data: {
          turnoId: permuta.turnoOrigenId,
          usuarioId: permuta.destinatarioId,
          estado: 'CONFIRMADA',
          inscritoPorId: user.id
        }
      });

      // 3. Si había turnoDestino (intercambio mutuo)
      if (permuta.turnoDestinoId) {
        // Desasignar destinatario de turnoDestino
        await tx.inscripcionTurno.updateMany({
          where: { turnoId: permuta.turnoDestinoId, usuarioId: permuta.destinatarioId, estado: 'CONFIRMADA' },
          data: { estado: 'PERMUTADA' }
        });

        // Asignar solicitante a turnoDestino
        await tx.inscripcionTurno.create({
          data: {
            turnoId: permuta.turnoDestinoId,
            usuarioId: permuta.solicitanteId,
            estado: 'CONFIRMADA',
            inscritoPorId: user.id
          }
        });
      }

      // 4. Actualizar estado de la permuta
      const permutaAprobada = await tx.permutaTurno.update({
        where: { id: idNum },
        data: {
          aprobadoDestinatario: true,
          estado: 'APROBADA',
          fechaResolucion: new Date(),
          observacionResolucion: observacion || 'Permuta aprobada y turnos intercambiados con éxito'
        }
      });

      return permutaAprobada;
    });

    await registrarAuditoria({
      entidad: 'PermutaTurnos',
      entidadId: idNum,
      accion: 'MODIFICACION',
      valorAnterior: { estado: 'PENDIENTE' },
      valorNuevo: { estado: 'APROBADA', resueltoPor: user.nombre },
      usuario: user,
      ip
    });

    return resultado;
  }

  const error = new Error('Acción inválida. Debe ser APROBAR o RECHAZAR.');
  error.statusCode = 400;
  throw error;
};

/**
 * BITÁCORA DE TURNOS HABILITADA CON INSCRIPCIÓN PREVIA OBLIGATORIA
 */
export const registrarBitacora = async (turnoId, data, user, ip) => {
  const tId = Number(turnoId);
  const turno = await prisma.turno.findUnique({ where: { id: tId } });

  if (!turno) {
    const error = new Error('Turno no encontrado');
    error.statusCode = 404;
    throw error;
  }

  // REGLA CRÍTICA: INSCRIPCIÓN PREVIA OBLIGATORIA
  const inscripcion = await prisma.inscripcionTurno.findFirst({
    where: {
      turnoId: tId,
      usuarioId: user.id,
      estado: 'CONFIRMADA'
    }
  });

  if (!inscripcion) {
    const error = new Error('Operación rechazada: Bitácora bloqueada. Se requiere inscripción previa obligatoria y confirmada para registrar notas en la bitácora de este turno.');
    error.statusCode = 403;
    throw error;
  }

  const bitacora = await prisma.$transaction(async (tx) => {
    const nuevaBitacora = await tx.bitacoraTurno.create({
      data: {
        turnoId: tId,
        usuarioId: user.id,
        tareasRealizadas: data.tareasRealizadas,
        incidentes: data.incidentes || null,
        observaciones: data.observaciones || null
      },
      include: {
        usuario: { select: { id: true, nombre: true, email: true, rol: true } }
      }
    });

    // Marcar asistencia registrada en la inscripción
    await tx.inscripcionTurno.update({
      where: { id: inscripcion.id },
      data: { asistenciaRegistrada: true }
    });

    return nuevaBitacora;
  });

  await registrarAuditoria({
    entidad: 'BitacoraTurnos',
    entidadId: bitacora.id,
    accion: 'CREACION',
    valorAnterior: null,
    valorNuevo: bitacora,
    usuario: user,
    ip
  });

  return bitacora;
};

/**
 * Listar bitácoras de un turno
 */
export const getBitacorasTurno = async (turnoId) => {
  return await prisma.bitacoraTurno.findMany({
    where: { turnoId: Number(turnoId) },
    include: {
      usuario: { select: { id: true, nombre: true, email: true, rol: true } }
    },
    orderBy: { fechaHora: 'desc' }
  });
};

/**
 * Alerta automática de turnos descubiertos
 */
export const getTurnosDescubiertos = async () => {
  const turnos = await getTurnos();
  const descubiertos = turnos.filter(t => !t.cubierto);

  return {
    totalDescubiertos: descubiertos.length,
    turnos: descubiertos.map(t => ({
      id: t.id,
      diaSemana: t.diaSemana,
      franja: t.franja,
      area: t.area,
      esCritica: t.esCritica,
      mensaje: `Alerta: Turno descubierto el día ${t.diaSemana} (${t.franja}) en el área "${t.area}".`
    }))
  };
};

/**
 * Directorio de voluntarios activos
 */
export const getDirectorioVoluntarios = async () => {
  const voluntarios = await prisma.usuario.findMany({
    where: {
      activo: true,
      rol: { in: ['VOLUNTARIO_NOVATO', 'VOLUNTARIO_AVANZADO', 'COORDINADOR', 'VETERINARIA', 'DIRECTORA'] }
    },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      inscripcionesTurnos: {
        where: { estado: 'CONFIRMADA' },
        include: { turno: true }
      }
    },
    orderBy: { nombre: 'asc' }
  });

  return voluntarios.map(v => ({
    id: v.id,
    nombre: v.nombre,
    email: v.email,
    rol: v.rol,
    esAvanzado: esPersonalAvanzado(v.rol),
    turnosAsignadosCount: v.inscripcionesTurnos.length,
    turnos: v.inscripcionesTurnos.map(i => ({
      turnoId: i.turno.id,
      diaSemana: i.turno.diaSemana,
      franja: i.turno.franja,
      area: i.turno.area
    }))
  }));
};
