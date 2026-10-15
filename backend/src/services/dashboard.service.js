import prisma from '../config/prisma.js';

/**
 * Obtener métricas consolidadas del panel de indicadores
 * Requisito 2:
 * - Animales albergados
 * - Caniles libres y ocupación
 * - Stock crítico de insumos
 * - Turnos descubiertos
 * - Alertas prioritarias en tiempo real
 * - Restringe información según el rol del usuario (Directora ve todo y auditorías/costos, otros ven operativo)
 */
export const getDashboardMetrics = async (user) => {
  const [
    totalAnimales,
    animalesPorEspecie,
    animalesPorSalud,
    totalCaniles,
    canilesLibres,
    canilesOcupados,
    canilesCuarentena,
    todosInsumos,
    turnosDescubiertos,
    trasladosPendientes,
    ultimasAuditorias
  ] = await Promise.all([
    // 1. Animales albergados
    prisma.animal.count({ where: { activo: true } }),
    prisma.animal.groupBy({
      by: ['especie'],
      where: { activo: true },
      _count: { id: true }
    }),
    prisma.animal.groupBy({
      by: ['estadoSalud'],
      where: { activo: true },
      _count: { id: true }
    }),

    // 2. Caniles y ocupación
    prisma.canil.count(),
    prisma.canil.count({ where: { estado: 'LIBRE' } }),
    prisma.canil.count({ where: { estado: 'OCUPADO' } }),
    prisma.canil.count({ where: { estado: 'CUARENTENA' } }),

    // 3. Todos los insumos activos
    prisma.insumo.findMany({ where: { activo: true } }),

    // 4. Turnos descubiertos (voluntario es nulo o cubierto = false)
    prisma.turno.findMany({
      where: {
        cubierto: false
      },
      orderBy: { id: 'asc' }
    }),

    // 5. Traslados pendientes de aprobación (prioridad para Directora)
    prisma.traslado.findMany({
      where: { estado: 'PENDIENTE_APROBACION' },
      include: {
        animal: { select: { id: true, nombre: true, especie: true } },
        responsable: { select: { id: true, nombre: true } }
      }
    }),

    // 6. Actividad reciente para la Directora
    user.rol === 'DIRECTORA'
      ? prisma.auditoria.findMany({
          take: 6,
          orderBy: { fechaHora: 'desc' },
          include: { usuario: { select: { nombre: true, rol: true } } }
        })
      : Promise.resolve([])
  ]);

  // Filtrar insumos críticos reales (stock <= stockMinimo)
  const insumosAlerta = todosInsumos.filter(i => i.stock <= i.stockMinimo);

  // Porcentaje de ocupación
  const ocupacionPorcentaje = totalCaniles > 0
    ? Math.round(((canilesOcupados + canilesCuarentena) / totalCaniles) * 100)
    : 0;

  // Alertas prioritarias en tiempo real
  const alertasPrioritarias = [];

  if (ocupacionPorcentaje > 90) {
    alertasPrioritarias.push({
      tipo: 'CRITICA',
      categoria: 'CANILES',
      titulo: 'Capacidad de Caniles al límite',
      mensaje: `Ocupación actual en ${ocupacionPorcentaje}%. Se supera el umbral crítico del 90%.`,
      icono: 'alert-triangle'
    });
  }

  if (insumosAlerta.length > 0) {
    alertasPrioritarias.push({
      tipo: 'ALERTA',
      categoria: 'INVENTARIO',
      titulo: `${insumosAlerta.length} Insumos en Stock Crítico`,
      mensaje: `Hay productos por debajo del stock mínimo (${insumosAlerta.map(i => i.nombre).slice(0, 3).join(', ')}...).`,
      icono: 'package'
    });
  }

  if (turnosDescubiertos.length > 0) {
    alertasPrioritarias.push({
      tipo: 'AVISO',
      categoria: 'TURNOS',
      titulo: `${turnosDescubiertos.length} Turnos de Voluntariado sin cubrir`,
      mensaje: `Existen turnos desatendidos esta semana que requieren asignación urgente.`,
      icono: 'users'
    });
  }

  if (trasladosPendientes.length > 0) {
    alertasPrioritarias.push({
      tipo: 'APROBACION',
      categoria: 'TRASLADOS',
      titulo: `${trasladosPendientes.length} Traslados externos pendientes de aprobación`,
      mensaje: `Requieren revisión y firma de la Directora para proceder.`,
      icono: 'file-text'
    });
  }

  // Restricción según Rol:
  // - Directora: Acceso completo (auditoría, aprobación traslados, alertas directivas)
  // - Veterinaria/Voluntarios: Métricas operativas, sin historial auditor ni controles directivos
  const respuesta = {
    rolUsuario: user.rol,
    resumen: {
      animalesAlbergados: totalAnimales,
      canilesLibres,
      canilesOcupados,
      canilesCuarentena,
      totalCaniles,
      ocupacionPorcentaje,
      alertaSobrecupo: ocupacionPorcentaje > 90,
      stockCriticoCount: insumosAlerta.length,
      turnosDescubiertosCount: turnosDescubiertos.length,
      trasladosPendientesCount: trasladosPendientes.length
    },
    tendencias: {
      especies: animalesPorEspecie.map(e => ({ especie: e.especie, cantidad: e._count.id })),
      salud: animalesPorSalud.map(s => ({ estado: s.estadoSalud, cantidad: s._count.id }))
    },
    alertasPrioritarias,
    listadosOperativos: {
      insumosBajoStock: insumosAlerta,
      turnosSinCubrir: turnosDescubiertos
    }
  };

  if (user.rol === 'DIRECTORA') {
    respuesta.trasladosPendientes = trasladosPendientes;
    respuesta.ultimasAuditorias = ultimasAuditorias;
  }

  return respuesta;
};
