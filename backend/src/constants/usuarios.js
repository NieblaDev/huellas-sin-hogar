export const PERFILES_USUARIO = [
  {
    rol: 'DIRECTORA',
    etiqueta: 'Directora',
    descripcion: 'Dirección general, supervisión y control completo del refugio.',
    permisos: [
      'Administrar usuarios, perfiles y permisos del equipo.',
      'Acceder a todas las áreas operativas, clínicas y administrativas.',
      'Aprobar traslados externos y consultar la auditoría.',
      'Exportar fichas de animales y reportes consolidados.'
    ],
    prohibiciones: [
      'No puede eliminar su propio perfil.',
      'No puede eliminar el último perfil activo de Directora.'
    ]
  },
  {
    rol: 'VETERINARIA',
    etiqueta: 'Veterinaria',
    descripcion: 'Salud, tratamientos y bienestar clínico de los animales.',
    permisos: [
      'Consultar y registrar fichas de animales.',
      'Registrar vacunas, atenciones clínicas y cuarentenas.',
      'Crear indicaciones de cuidado para el equipo.',
      'Gestionar inventario, incluidos fármacos, y exportar fichas.'
    ],
    prohibiciones: [
      'No puede administrar perfiles ni consultar la auditoría.',
      'No puede gestionar adopciones ni aprobar traslados externos.',
      'No puede emitir reportes consolidados.'
    ]
  },
  {
    rol: 'ENCARGADA_ADOPCIONES',
    etiqueta: 'Encargada de adopciones',
    descripcion: 'Solicitudes, seguimientos post-adopción y devoluciones.',
    permisos: [
      'Gestionar solicitudes, etapas y seguimientos de adopción.',
      'Registrar devoluciones y reingresos al refugio.',
      'Consultar y registrar fichas de animales.',
      'Gestionar inventario general y exportar fichas.'
    ],
    prohibiciones: [
      'No puede registrar datos clínicos ni indicaciones médicas.',
      'No puede administrar perfiles, auditar ni aprobar traslados.',
      'No puede gestionar fármacos ni emitir reportes consolidados.'
    ]
  },
  {
    rol: 'COORDINADOR',
    etiqueta: 'Coordinador',
    descripcion: 'Planificación de turnos y coordinación operativa del equipo.',
    permisos: [
      'Crear y modificar la matriz semanal de turnos.',
      'Inscribir voluntarios y responder permutas.',
      'Gestionar caniles y traslados internos.',
      'Completar tareas de cuidado y consultar fichas de animales.'
    ],
    prohibiciones: [
      'No puede crear ni editar fichas de animales.',
      'No puede registrar datos clínicos, gestionar fármacos ni adopciones.',
      'No puede administrar perfiles, auditar ni aprobar traslados.',
      'No puede acceder a inventario ni emitir reportes consolidados.'
    ]
  },
  {
    rol: 'VOLUNTARIO_AVANZADO',
    etiqueta: 'Voluntario avanzado',
    descripcion: 'Apoyo operativo con acceso ampliado y tareas críticas.',
    permisos: [
      'Registrar y editar fichas de animales.',
      'Gestionar caniles, traslados internos y tareas de cuidado.',
      'Gestionar inventario general.',
      'Inscribirse en turnos y asumir tareas críticas.'
    ],
    prohibiciones: [
      'No puede gestionar fármacos ni registrar datos clínicos.',
      'No puede administrar adopciones, perfiles ni auditoría.',
      'No puede aprobar traslados ni emitir reportes consolidados.',
      'No puede exportar fichas de animales.'
    ]
  },
  {
    rol: 'VOLUNTARIO_NOVATO',
    etiqueta: 'Voluntario',
    descripcion: 'Apoyo general en las tareas diarias del refugio.',
    permisos: [
      'Registrar y editar fichas de animales.',
      'Gestionar caniles y traslados internos.',
      'Completar tareas de cuidado e inscribirse en turnos.',
      'Consultar salud y fichas de animales.'
    ],
    prohibiciones: [
      'No puede asumir turnos críticos.',
      'No puede acceder a inventario ni gestionar fármacos.',
      'No puede registrar datos clínicos ni administrar adopciones.',
      'No puede administrar perfiles, auditar, aprobar traslados ni emitir reportes.'
    ]
  }
];

export const ROLES_USUARIO = PERFILES_USUARIO.map(perfil => perfil.rol);

export const obtenerPerfilUsuario = rol => PERFILES_USUARIO.find(perfil => perfil.rol === rol) || null;
