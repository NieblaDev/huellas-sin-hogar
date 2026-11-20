import { z } from 'zod';

const NOMBRES_CAMPOS = {
  nombre: 'Nombre',
  especie: 'Especie',
  sexo: 'Sexo',
  estadoSalud: 'Estado de salud',
  estadoAdopcion: 'Estado de adopción',
  tipoIngreso: 'Tipo de ingreso',
  motivoIngreso: 'Motivo de ingreso',
  ubicacion: 'Ubicación',
  fechaIngreso: 'Fecha de ingreso',
  fechaNacimiento: 'Fecha de nacimiento',
  peso: 'Peso',
  pesoActual: 'Peso actual',
  temperatura: 'Temperatura',
  edadEstimada: 'Edad aproximada',
  descripcion: 'Descripción',
  observaciones: 'Observaciones',
  condicionIngreso: 'Condición de ingreso',
  contactoRescate: 'Contacto de rescate',
  fotoUrl: 'Fotografía',
  canilId: 'Canil asignado',
  animalId: 'Animal',
  usuarioId: 'Usuario',
  postulanteId: 'Postulante',
  adopcionId: 'Adopción',
  turnoOrigenId: 'Turno de origen',
  turnoDestinoId: 'Turno de destino',
  destinatarioId: 'Voluntario destinatario',
  insumoId: 'Insumo',
  tratamientoId: 'Tratamiento',
  indicacionId: 'Indicación médica',
  codigo: 'Código',
  sector: 'Sector',
  capacidad: 'Capacidad',
  tipo: 'Tipo',
  subtipo: 'Subtipo',
  estado: 'Estado',
  stock: 'Stock disponible',
  stockMinimo: 'Stock mínimo',
  unidad: 'Unidad de medida',
  lote: 'Número de lote',
  fechaVencimiento: 'Fecha de vencimiento',
  esFarmaco: 'Medicamento',
  email: 'Correo electrónico',
  password: 'Contraseña',
  contrasena: 'Contraseña',
  rol: 'Rol o perfil',
  telefono: 'Teléfono',
  direccion: 'Dirección',
  identificacion: 'RUT o documento',
  tipoIdentificacion: 'Tipo de documento',
  motivacion: 'Motivación',
  resultadoEvaluacion: 'Resultado de la evaluación',
  motivoOmision: 'Motivo de omisión',
  fechaProgramada: 'Fecha programada',
  fecha: 'Fecha',
  diaSemana: 'Día de la semana',
  franja: 'Franja horaria',
  area: 'Área de servicio',
  cupoMaximo: 'Cupo máximo',
  tareasRealizadas: 'Tareas realizadas',
  incidentes: 'Incidentes reportados',
  destinoNombre: 'Nombre del destino',
  destinoContacto: 'Contacto del destino',
  destinoDireccion: 'Dirección del destino',
  accion: 'Acción',
  cantidad: 'Cantidad',
  actualizadoEn: 'Fecha de actualización',
  fechaInicio: 'Fecha de inicio',
  fechaFin: 'Fecha de término',
  fechaDesde: 'Fecha desde',
  fechaHasta: 'Fecha hasta',
  fechaReprogramada: 'Fecha reprogramada',
  resultado: 'Resultado',
  canal: 'Canal de contacto',
  contexto: 'Contexto clínico',
  criticidad: 'Nivel de criticidad',
  motivo: 'Motivo',
  pagina: 'Página',
  raza: 'Raza',
  tamano: 'Tamaño',
  color: 'Color del pelaje',
  microchip: 'Número de microchip',
  chip: 'Número de microchip',
  edad: 'Edad',
  categoria: 'Categoría',
  comentario: 'Comentario',
  diagnostico: 'Diagnóstico',
  dosis: 'Dosis',
  estadoAnimal: 'Estado del animal',
  fechaAplicacion: 'Fecha de aplicación',
  fechaFinEstimada: 'Fecha estimada de término',
  fechaIntento: 'Fecha del intento de contacto',
  franjaHoraria: 'Franja horaria',
  historialMedico: 'Historial médico',
  horaInicio: 'Hora de inicio',
  horaFin: 'Hora de término',
  instruccion: 'Instrucción de cuidado',
  nombreVacuna: 'Nombre de la vacuna',
  nota: 'Nota',
  observacion: 'Observación',
  observacionesPostulante: 'Observaciones del postulante',
  postulante: 'Postulante',
  procedimientos: 'Procedimientos',
  tratamientos: 'Tratamientos',
  canalContacto: 'Canal de contacto',
  tipoSeguimiento: 'Tipo de seguimiento',
  canilAislamiento: 'Canil de aislamiento',
  donanteOProveedor: 'Donante o proveedor',
  diasProgramados: 'Días programados',
  limite: 'Límite',
  titulo: 'Título'
};

const traducirMensajeValidacion = (issue, campo) => {
  const etiqueta = campo || 'Este dato';
  const mensajePredeterminado = z.defaultErrorMap(issue, { data: undefined, defaultError: '' }).message;
  if (campo && /Id$/.test(issue.path.at(-1)) && issue.message === mensajePredeterminado) {
    return 'Selecciona una opción válida en «' + campo + '».';
  }
  if (issue.message !== mensajePredeterminado && issue.code !== 'unrecognized_keys') return issue.message;

  switch (issue.code) {
    case 'invalid_type':
      if (issue.received === 'undefined') return 'Completa ' + (campo ? 'el campo «' + campo + '».' : 'los datos obligatorios.');
      if (issue.expected === 'integer') return etiqueta + ' debe ser un número entero.';
      if (issue.expected === 'number') return etiqueta + ' debe ser un número válido.';
      return 'Revisa el formato de ' + (campo ? '«' + campo + '».' : 'los datos ingresados.');
    case 'invalid_enum_value':
    case 'invalid_literal':
      return 'Selecciona una opción válida' + (campo ? ' en «' + campo + '».' : '.');
    case 'invalid_string':
      if (issue.validation === 'email') return 'Ingresa un correo electrónico válido.';
      if (issue.validation === 'datetime' || issue.validation === 'date') return 'Ingresa una fecha válida' + (campo ? ' en «' + campo + '».' : '.');
      return 'Revisa el formato de ' + (campo ? '«' + campo + '».' : 'los datos ingresados.');
    case 'too_small':
    case 'too_big': {
      const menor = issue.code === 'too_small';
      const limite = menor ? issue.minimum : issue.maximum;
      if (issue.type === 'string') return etiqueta + ' debe tener ' + (menor ? 'al menos ' : 'como máximo ') + limite + ' caracteres.';
      if (issue.type === 'number') {
        const comparacion = menor ? 'mayor' : 'menor';
        return etiqueta + ' debe ser ' + comparacion + (issue.inclusive ? ' o igual' : '') + ' a ' + limite + '.';
      }
      break;
    }
    case 'unrecognized_keys':
      return 'Quita los datos que no corresponden a este formulario.';
  }

  return campo ? 'Revisa el valor de «' + campo + '».' : 'Revisa los datos ingresados e inténtalo nuevamente.';
};

export const validate = (schema, target = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[target]);
  if (!result.success) {
    return res.status(400).json({
      error: 'Revisa los datos ingresados.',
      detalles: result.error.issues.map(issue => {
        const clave = issue.path.at(-1);
        const campo = Object.hasOwn(NOMBRES_CAMPOS, clave) ? NOMBRES_CAMPOS[clave] : null;
        return { campo, mensaje: traducirMensajeValidacion(issue, campo) };
      })
    });
  }
  req[target] = result.data;
  next();
};
