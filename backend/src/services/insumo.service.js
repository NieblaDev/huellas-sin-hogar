import prisma from '../config/prisma.js';
import { registrarAuditoria } from './audit.service.js';

/**
 * Roles autorizados para gestionar inventario general:
 * Staff (Directora, Encargada Adopciones), Veterinaria y Voluntarios Avanzados.
 */
export const ROLES_INVENTARIO = ['DIRECTORA', 'VETERINARIA', 'ENCARGADA_ADOPCIONES', 'VOLUNTARIO_AVANZADO'];

/**
 * Roles autorizados exclusivamente para consulta y edición de FÁRMACOS / MEDICAMENTOS
 */
export const ROLES_FARMACOS = ['DIRECTORA', 'VETERINARIA'];

export const esAutorizadoFarmacos = (rol) => ROLES_FARMACOS.includes(rol);

/**
 * Verifica si un insumo es fármaco por flag explícito o categoría
 */
export const esInsumoFarmaco = (insumo) => {
  if (!insumo) return false;
  if (insumo.esFarmaco) return true;
  const cat = (insumo.categoria || '').toLowerCase();
  return cat.includes('medicamento') || cat.includes('fármaco') || cat.includes('farmaco');
};

/**
 * Listar insumos con cálculo de estado y alertas en tiempo real.
 * Si el usuario NO tiene rol autorizado para fármacos, los fármacos se excluyen de la consulta.
 */
export const getInsumos = async (user, filtros = {}) => {
  const where = { activo: true };

  // Restricción de fármacos: si no es personal médico/autorizado, ocultar fármacos
  if (!esAutorizadoFarmacos(user?.rol)) {
    where.AND = [
      { esFarmaco: false },
      { categoria: { not: { contains: 'medicamento', mode: 'insensitive' } } },
      { categoria: { not: { contains: 'fármaco', mode: 'insensitive' } } },
      { categoria: { not: { contains: 'farmaco', mode: 'insensitive' } } }
    ];
  }

  if (filtros.search) {
    where.nombre = { contains: filtros.search, mode: 'insensitive' };
  }

  if (filtros.categoria && filtros.categoria !== 'TODAS') {
    where.categoria = { equals: filtros.categoria, mode: 'insensitive' };
  }

  const insumos = await prisma.insumo.findMany({
    where,
    orderBy: { nombre: 'asc' }
  });

  const hoy = new Date();

  return insumos.map(ins => {
    let diasParaVencer = null;
    let alertaVencimiento = false;
    let estaVencido = false;

    if (ins.fechaVencimiento) {
      const fechaVenc = new Date(ins.fechaVencimiento);
      const diffMs = fechaVenc.getTime() - hoy.getTime();
      diasParaVencer = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diasParaVencer <= 0) {
        estaVencido = true;
        alertaVencimiento = true;
      } else if (diasParaVencer <= 30) {
        alertaVencimiento = true;
      }
    }

    const esStockBajo = ins.stock <= ins.stockMinimo;
    const esAgotado = ins.stock === 0;

    return {
      ...ins,
      diasParaVencer,
      alertaVencimiento,
      estaVencido,
      esStockBajo,
      esAgotado,
      estadoStock: esAgotado ? 'AGOTADO' : (esStockBajo ? 'CRITICO' : 'NORMAL'),
      estadoVencimiento: estaVencido ? 'VENCIDO' : (alertaVencimiento ? 'VENCIMIENTO_PROXIMO' : 'VIGENTE')
    };
  });
};

/**
 * Obtener detalle de un insumo por ID
 */
export const getInsumoById = async (id, user) => {
  const insumo = await prisma.insumo.findUnique({
    where: { id: Number(id) },
    include: {
      movimientos: {
        orderBy: { fecha: 'desc' },
        take: 10,
        include: {
          registradoPor: { select: { id: true, nombre: true, email: true, rol: true } },
          animal: { select: { id: true, nombre: true, especie: true } }
        }
      }
    }
  });

  if (!insumo || !insumo.activo) {
    const error = new Error('Insumo no encontrado');
    error.statusCode = 404;
    throw error;
  }

  // Restricción de fármacos
  if (esInsumoFarmaco(insumo) && !esAutorizadoFarmacos(user?.rol)) {
    const error = new Error('Acceso restringido: La consulta de fármacos está reservada exclusivamente a personal médico/autorizado (Veterinaria y Dirección).');
    error.statusCode = 403;
    throw error;
  }

  return insumo;
};

/**
 * Crear nuevo insumo en inventario
 */
export const createInsumo = async (data, user, ip) => {
  // Restricción de fármacos en creación
  const quiereCrearFarmaco = data.esFarmaco ||
    (data.categoria && (
      data.categoria.toLowerCase().includes('medicamento') ||
      data.categoria.toLowerCase().includes('fármaco') ||
      data.categoria.toLowerCase().includes('farmaco')
    ));

  if (quiereCrearFarmaco && !esAutorizadoFarmacos(user?.rol)) {
    const error = new Error('Acceso denegado: El registro de fármacos está restringido exclusivamente a personal médico autorizado (Veterinaria y Dirección).');
    error.statusCode = 403;
    throw error;
  }

  if (data.stock < 0) {
    const error = new Error('No se permiten saldos de stock negativos.');
    error.statusCode = 400;
    throw error;
  }

  const payload = {
    ...data,
    esFarmaco: quiereCrearFarmaco ? true : Boolean(data.esFarmaco),
    fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : null
  };

  const nuevo = await prisma.insumo.create({
    data: payload
  });

  await registrarAuditoria({
    entidad: 'Inventario',
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
 * Actualizar insumo existente
 */
export const updateInsumo = async (id, data, user, ip) => {
  const anterior = await prisma.insumo.findUnique({ where: { id: Number(id) } });
  if (!anterior || !anterior.activo) {
    const error = new Error('Insumo no encontrado');
    error.statusCode = 404;
    throw error;
  }

  // Restricción de fármacos
  const involucraFarmaco = esInsumoFarmaco(anterior) ||
    data.esFarmaco ||
    (data.categoria && (
      data.categoria.toLowerCase().includes('medicamento') ||
      data.categoria.toLowerCase().includes('fármaco') ||
      data.categoria.toLowerCase().includes('farmaco')
    ));

  if (involucraFarmaco && !esAutorizadoFarmacos(user?.rol)) {
    const error = new Error('Acceso denegado: La edición de fármacos está restringida exclusivamente a personal médico autorizado (Veterinaria y Dirección).');
    error.statusCode = 403;
    throw error;
  }

  if (data.stock !== undefined && data.stock < 0) {
    const error = new Error('Prohibido saldo negativo: El stock no puede ser inferior a 0.');
    error.statusCode = 400;
    throw error;
  }

  const payload = { ...data };
  if (data.fechaVencimiento !== undefined) {
    payload.fechaVencimiento = data.fechaVencimiento ? new Date(data.fechaVencimiento) : null;
  }
  if (involucraFarmaco) {
    payload.esFarmaco = true;
  }

  const actualizado = await prisma.insumo.update({
    where: { id: Number(id) },
    data: payload
  });

  await registrarAuditoria({
    entidad: 'Inventario',
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
 * Dar de baja lógica un insumo
 */
export const deleteInsumo = async (id, user, ip) => {
  const anterior = await prisma.insumo.findUnique({ where: { id: Number(id) } });
  if (!anterior) {
    const error = new Error('Insumo no encontrado');
    error.statusCode = 404;
    throw error;
  }

  if (esInsumoFarmaco(anterior) && !esAutorizadoFarmacos(user?.rol)) {
    const error = new Error('Acceso denegado: La baja de fármacos está restringida exclusivamente a personal médico autorizado.');
    error.statusCode = 403;
    throw error;
  }

  const baja = await prisma.insumo.update({
    where: { id: Number(id) },
    data: { activo: false }
  });

  await registrarAuditoria({
    entidad: 'Inventario',
    entidadId: baja.id,
    accion: 'BAJA_LOGICA',
    valorAnterior: anterior,
    valorNuevo: { activo: false },
    usuario: user,
    ip
  });

  return baja;
};

/**
 * REGISTRO CLASIFICADO DE ENTRADAS Y SALIDAS
 * - Entradas: DONACION, COMPRA, AJUSTE
 * - Salidas: CONSUMO, TRATAMIENTO_MEDICO, MERMA, AJUSTE
 * - Prohibición estricta de saldos negativos
 * - Actualización en tiempo real atómica
 * - Restricción de fármacos a personal autorizado
 */
export const registrarMovimiento = async (insumoId, data, user, ip) => {
  const idNum = Number(insumoId);
  const insumo = await prisma.insumo.findUnique({ where: { id: idNum } });

  if (!insumo || !insumo.activo) {
    const error = new Error('Insumo no encontrado');
    error.statusCode = 404;
    throw error;
  }

  // Restricción de fármacos
  if (esInsumoFarmaco(insumo) && !esAutorizadoFarmacos(user?.rol)) {
    const error = new Error('Acceso denegado: El registro de entradas/salidas de fármacos está restringido exclusivamente a personal médico autorizado (Veterinaria y Dirección).');
    error.statusCode = 403;
    throw error;
  }

  const cantidad = Number(data.cantidad);
  if (cantidad <= 0) {
    const error = new Error('La cantidad a registrar debe ser estrictamente mayor a 0.');
    error.statusCode = 400;
    throw error;
  }

  const stockAnterior = insumo.stock;
  let stockNuevo = stockAnterior;

  if (data.tipo === 'ENTRADA') {
    stockNuevo = stockAnterior + cantidad;
  } else if (data.tipo === 'SALIDA') {
    // REGLA CRÍTICA: PROHIBICIÓN DE SALDOS NEGATIVOS
    if (stockAnterior - cantidad < 0) {
      const error = new Error(`Operación rechazada: Stock insuficiente. El stock actual es de ${stockAnterior} ${insumo.unidad} y se intentó dar salida a ${cantidad} ${insumo.unidad}. No se permiten saldos negativos.`);
      error.statusCode = 400;
      throw error;
    }
    stockNuevo = stockAnterior - cantidad;
  } else {
    const error = new Error('Tipo de movimiento inválido. Debe ser ENTRADA o SALIDA.');
    error.statusCode = 400;
    throw error;
  }

  // Transacción atómica en tiempo real
  const resultado = await prisma.$transaction(async (tx) => {
    // 1. Actualizar stock del insumo
    const updateData = { stock: stockNuevo };
    if (data.tipo === 'ENTRADA' && data.fechaVencimiento) {
      updateData.fechaVencimiento = new Date(data.fechaVencimiento);
    }
    if (data.lote) {
      updateData.lote = data.lote;
    }

    const insumoActualizado = await tx.insumo.update({
      where: { id: idNum },
      data: updateData
    });

    // 2. Crear movimiento clasificado
    const movimiento = await tx.movimientoInventario.create({
      data: {
        insumoId: idNum,
        tipo: data.tipo,
        subtipo: data.subtipo,
        cantidad,
        stockAnterior,
        stockNuevo,
        motivo: data.motivo,
        donanteOProveedor: data.donanteOProveedor || null,
        animalId: data.animalId ? Number(data.animalId) : null,
        tratamientoId: data.tratamientoId ? Number(data.tratamientoId) : null,
        lote: data.lote || insumo.lote || null,
        fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : null,
        registradoPorId: user.id
      },
      include: {
        animal: { select: { id: true, nombre: true, especie: true } },
        registradoPor: { select: { id: true, nombre: true, email: true, rol: true } }
      }
    });

    return { insumoActualizado, movimiento };
  });

  // 3. Registrar auditoría inmutable
  await registrarAuditoria({
    entidad: 'Inventario',
    entidadId: idNum,
    accion: 'MODIFICACION',
    valorAnterior: { stock: stockAnterior, insumo: insumo.nombre },
    valorNuevo: { stock: stockNuevo, movimiento: resultado.movimiento },
    usuario: user,
    ip
  });

  return resultado;
};

/**
 * Historial de movimientos de un insumo
 */
export const getMovimientosInsumo = async (insumoId, user) => {
  const idNum = Number(insumoId);
  const insumo = await prisma.insumo.findUnique({ where: { id: idNum } });
  if (!insumo || !insumo.activo) {
    const error = new Error('Insumo no encontrado');
    error.statusCode = 404;
    throw error;
  }

  if (esInsumoFarmaco(insumo) && !esAutorizadoFarmacos(user?.rol)) {
    const error = new Error('Acceso restringido: Consulta de movimientos de fármacos restringida a personal médico.');
    error.statusCode = 403;
    throw error;
  }

  return await prisma.movimientoInventario.findMany({
    where: { insumoId: idNum },
    orderBy: { fecha: 'desc' },
    include: {
      animal: { select: { id: true, nombre: true, especie: true } },
      registradoPor: { select: { id: true, nombre: true, email: true, rol: true } }
    }
  });
};

/**
 * Alertas automáticas en tiempo real:
 * - Stock crítico (stock <= stockMinimo)
 * - Vencimientos próximos (dentro de 30 días) o vencidos
 */
export const getAlertasInventario = async (user) => {
  const where = { activo: true };

  // Restricción de fármacos para usuarios no médicos
  if (!esAutorizadoFarmacos(user?.rol)) {
    where.AND = [
      { esFarmaco: false },
      { categoria: { not: { contains: 'medicamento', mode: 'insensitive' } } }
    ];
  }

  const todos = await prisma.insumo.findMany({
    where,
    orderBy: { nombre: 'asc' }
  });

  const hoy = new Date();
  const en30Dias = new Date(hoy.getTime() + 30 * 24 * 3600 * 1000);

  const alertasStock = [];
  const alertasVencimiento = [];

  for (const ins of todos) {
    if (ins.stock <= ins.stockMinimo) {
      alertasStock.push({
        id: ins.id,
        nombre: ins.nombre,
        categoria: ins.categoria,
        stock: ins.stock,
        stockMinimo: ins.stockMinimo,
        unidad: ins.unidad,
        esFarmaco: ins.esFarmaco,
        tipo: ins.stock === 0 ? 'AGOTADO' : 'STOCK_CRITICO',
        mensaje: ins.stock === 0
          ? `Insumo ${ins.nombre} totalmente AGOTADO (0 ${ins.unidad}).`
          : `Stock crítico alcanzado: quedan ${ins.stock} ${ins.unidad} (mínimo: ${ins.stockMinimo}).`
      });
    }

    if (ins.fechaVencimiento) {
      const fechaVenc = new Date(ins.fechaVencimiento);
      const diffDias = Math.ceil((fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDias <= 0) {
        alertasVencimiento.push({
          id: ins.id,
          nombre: ins.nombre,
          categoria: ins.categoria,
          stock: ins.stock,
          fechaVencimiento: ins.fechaVencimiento,
          diasRestantes: diffDias,
          estado: 'VENCIDO',
          mensaje: `¡URGENTE! ${ins.nombre} se encuentra VENCIDO desde hace ${Math.abs(diffDias)} días.`
        });
      } else if (diffDias <= 30) {
        alertasVencimiento.push({
          id: ins.id,
          nombre: ins.nombre,
          categoria: ins.categoria,
          stock: ins.stock,
          fechaVencimiento: ins.fechaVencimiento,
          diasRestantes: diffDias,
          estado: 'PROXIMO_A_VENCER',
          mensaje: `Vencimiento próximo: ${ins.nombre} vence en ${diffDias} días.`
        });
      }
    }
  }

  return {
    totalAlertas: alertasStock.length + alertasVencimiento.length,
    stockCriticoCount: alertasStock.length,
    vencimientoCount: alertasVencimiento.length,
    alertasStock,
    alertasVencimiento
  };
};
