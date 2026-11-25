export const SEXOS_USUARIO = ['FEMENINO', 'MASCULINO', 'NEUTRO'];

export const PERFILES_USUARIO = [
  {
    rol: 'DIRECCION',
    etiqueta: 'Dirección',
    etiquetasPorSexo: { FEMENINO: 'Directora', MASCULINO: 'Director' },
    descripcion: 'Dirección general, supervisión y control completo del refugio.',
    permisos: [
      'Administrar usuarios, perfiles y permisos del equipo.',
      'Acceder a todas las áreas operativas, clínicas y administrativas.',
      'Aprobar traslados externos y consultar la auditoría.',
      'Exportar fichas de animales y reportes consolidados.',
      'Administrar la matriz semanal, las inscripciones y las permutas de turnos.'
    ],
    prohibiciones: [
      'No puede eliminar su propio perfil.',
      'No puede eliminar el último perfil activo de Dirección.'
    ]
  },
  {
    rol: 'PERSONAL_VETERINARIO',
    etiqueta: 'Personal veterinario',
    etiquetasPorSexo: { FEMENINO: 'Veterinaria', MASCULINO: 'Veterinario' },
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
    rol: 'PERSONAL_ADOPCIONES',
    etiqueta: 'Personal de adopciones',
    etiquetasPorSexo: { FEMENINO: 'Encargada de Adopciones', MASCULINO: 'Encargado de Adopciones' },
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
    rol: 'VOLUNTARIO_AVANZADO',
    etiqueta: 'Voluntariado avanzado',
    etiquetasPorSexo: { FEMENINO: 'Voluntaria avanzada', MASCULINO: 'Voluntario avanzado' },
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
    etiqueta: 'Voluntariado inicial',
    etiquetasPorSexo: { FEMENINO: 'Voluntaria novata', MASCULINO: 'Voluntario novato' },
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

export const etiquetaRolUsuario = (rol, sexo) => {
  const perfil = obtenerPerfilUsuario(rol);
  return perfil?.etiquetasPorSexo[sexo] || perfil?.etiqueta;
};

export const etiquetaRolHistorico = (rol, sexo) => {
  const equivalencias = {
    DIRECTORA: 'DIRECCION',
    VETERINARIA: 'PERSONAL_VETERINARIO',
    ENCARGADA_ADOPCIONES: 'PERSONAL_ADOPCIONES'
  };
  if (rol === 'COORDINADOR') return 'Coordinación (histórico)';
  return etiquetaRolUsuario(equivalencias[rol] || rol, sexo);
};
