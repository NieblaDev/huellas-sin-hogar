import React, { useState, useEffect, useRef } from 'react';
import ModalAdopcion from './adopciones/ModalAdopcion';
import AnimalCardPicker from './adopciones/AnimalCardPicker';
import { folioSeguimiento, folioSolicitud } from './adopciones/folios';
import './adopciones/adopciones.css';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Eye,
  FileCheck,
  FilePenLine,
  FileText,
  Filter,
  HeartHandshake,
  Home,
  House,
  Info,
  MapPin,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  User,
  Users,
  X
} from 'lucide-react';
import { formatearErrorApi } from '../utils/errores';
import {
  listarSolicitudes,
  obtenerSolicitud,
  crearSolicitud,
  editarSolicitud,
  eliminarSolicitud,
  registrarEtapa,
  listarAnimalesDisponibles,
  obtenerAntecedentes,
  listarSeguimientos,
  registrarSeguimiento,
  reprogramarSeguimiento,
  registrarDevolucion
} from '../api/adopciones';

// Constantes y diccionarios
export const ESTADOS_SOLICITUD = {
  RECIBIDA: { etiqueta: 'Recibida', bg: '#eef2f7', color: '#4b5b70' },
  EN_EVALUACION: { etiqueta: 'En evaluación', bg: '#faf1de', color: '#b37416' },
  VISITA_AGENDADA: { etiqueta: 'Visita agendada', bg: '#f3ecf8', color: '#6b3e84' },
  VISITA_REALIZADA: { etiqueta: 'Visita realizada', bg: '#e8f1f7', color: '#25637d' },
  APROBADA: { etiqueta: 'Aprobada (pendiente entrega)', bg: '#e8f0e8', color: '#2f5540' },
  ENTREGADA: { etiqueta: 'Adopción exitosa', bg: '#e8f0e8', color: '#2f5540' },
  RECHAZADA: { etiqueta: 'Rechazada', bg: '#fbeae8', color: '#d1453b' },
  CANCELADA: { etiqueta: 'Cancelada', bg: '#fbeae8', color: '#d1453b' }
};

export const ESTADOS_SEGUIMIENTO = {
  PENDIENTE: { etiqueta: 'Pendiente', bg: '#faf1de', color: '#b37416' },
  REPROGRAMADO: { etiqueta: 'Reprogramado', bg: '#fff7e5', color: '#704d0e' },
  COMPLETADO: { etiqueta: 'Completado', bg: '#e8f0e8', color: '#2f5540' },
  SIN_CONTACTO: { etiqueta: 'Sin contacto', bg: '#fbeae8', color: '#d1453b' }
};

export const TIPOS_SEGUIMIENTO = {
  SEGUIMIENTO_15_DIAS: 'Seguimiento a los 15 días',
  SEGUIMIENTO_30_DIAS: 'Seguimiento a los 30 días',
  EXTRAORDINARIO: 'Seguimiento extraordinario'
};

export const CANALES_FORMULARIO = {
  VISITA_PRESENCIAL: 'Visita presencial',
  VIDEOLLAMADA: 'Videollamada',
  LLAMADA_TELEFONICA: 'Llamada telefónica',
  WHATSAPP: 'WhatsApp',
  CORREO: 'Correo electrónico',
  OTRO: 'Otro'
};

export const CANALES_DESPLIEGUE = {
  LLAMADA_TELEFONICA: 'Llamada telefónica',
  WHATSAPP: 'WhatsApp',
  CORREO_ELECTRONICO: 'Correo electrónico',
  VISITA_DOMICILIARIA: 'Visita presencial',
  OTRO: 'Otro (incluye videollamada)'
};

export const RESULTADOS_EVALUACION = {
  CUMPLE: 'Cumple requisitos',
  NO_CUMPLE: 'No cumple requisitos',
  PENDIENTE: 'Pendiente de información'
};

const NOMBRES_ETAPAS = {
  EVALUAR: 'Registrar evaluación',
  AGENDAR_VISITA: 'Agendar o reprogramar visita previa',
  REGISTRAR_VISITA: 'Registrar visita previa realizada',
  OMITIR_VISITA: 'Omitir visita con motivo fundado',
  APROBAR: 'Aprobar solicitud',
  RECHAZAR: 'Rechazar solicitud',
  CANCELAR: 'Cancelar proceso',
  ENTREGAR: 'Concretar adopción (entrega)'
};

const formatearFecha = (fecha, incluirHora = false) => {
  if (!fecha) return '—';
  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return '—';

  return incluirHora
    ? valor.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : valor.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
};

const ahoraLocal = () => {
  const fecha = new Date();
  return new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
};

const formatearIdentificacion = (valor, tipo) => {
  const limpio = (valor || '').trim().toUpperCase();
  if (tipo !== 'RUT') return limpio.replace(/\s+/g, '');
  const rut = limpio.replace(/[.\s-]/g, '');
  if (!/^[1-9]\d{6,7}[0-9K]$/.test(rut)) return limpio;
  return `${rut.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${rut.slice(-1)}`;
};

const resultadoEvaluacionActual = solicitud =>
  solicitud?.etapas?.filter(etapa => etapa.accion === 'EVALUAR').at(-1)?.resultadoEvaluacion || null;

const opcionesEtapasDisponibles = solicitud => {
  if (!solicitud) return [];
  if (['RECIBIDA', 'EN_EVALUACION', 'VISITA_AGENDADA', 'VISITA_REALIZADA'].includes(solicitud.estado) &&
      resultadoEvaluacionActual(solicitud) !== 'CUMPLE') {
    return ['EVALUAR', 'RECHAZAR'];
  }
  switch (solicitud.estado) {
    case 'RECIBIDA':
      return ['EVALUAR', 'RECHAZAR'];
    case 'EN_EVALUACION':
      return solicitud.visitaOmitida
        ? ['APROBAR', 'AGENDAR_VISITA', 'REGISTRAR_VISITA', 'RECHAZAR']
        : ['AGENDAR_VISITA', 'REGISTRAR_VISITA', 'OMITIR_VISITA', 'RECHAZAR'];
    case 'VISITA_AGENDADA':
      return ['AGENDAR_VISITA', 'REGISTRAR_VISITA', 'OMITIR_VISITA', 'RECHAZAR'];
    case 'VISITA_REALIZADA':
      return ['APROBAR', 'RECHAZAR'];
    case 'APROBADA':
      return ['ENTREGAR', 'CANCELAR'];
    default:
      return [];
  }
};

export default function AdopcionesModulo({ user }) {
  const [tab, setTab] = useState('lista'); // 'lista' | 'seguimientos'
  // Ventanas modales sobre el listado: null | 'crear' | 'detalle'
  const [modalSolicitud, setModalSolicitud] = useState(null);
  const [mensajeExito, setMensajeExito] = useState(null);

  // Estados para Solicitudes
  const [solicitudesData, setSolicitudesData] = useState(null);
  const [solicitudesCargando, setSolicitudesCargando] = useState(false);
  const [solicitudesError, setSolicitudesError] = useState('');
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [ordenSolicitudes, setOrdenSolicitudes] = useState('reciente'); // 'reciente' | 'antigua'
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [paginaSolicitudes, setPaginaSolicitudes] = useState(1);
  const [recargaSolicitudes, setRecargaSolicitudes] = useState(0);

  // Detalle de solicitud y expediente
  const [solicitudSeleccionadaId, setSolicitudSeleccionadaId] = useState(null);
  const [detalleData, setDetalleData] = useState(null);
  const [detalleCargando, setDetalleCargando] = useState(false);
  const [detalleError, setDetalleError] = useState('');
  const [editandoSolicitud, setEditandoSolicitud] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  // Formulario de Etapa / Progreso
  const [accionEtapa, setAccionEtapa] = useState('');
  const [fechaEtapa, setFechaEtapa] = useState('');
  const [resultadoEvalEtapa, setResultadoEvalEtapa] = useState('');
  const [observacionesEtapa, setObservacionesEtapa] = useState('');
  const [motivoOmisionEtapa, setMotivoOmisionEtapa] = useState('');
  const [guardandoEtapa, setGuardandoEtapa] = useState(false);
  const [errorEtapa, setErrorEtapa] = useState('');

  // Estados para Seguimientos Post-Adopción
  const [seguimientosData, setSeguimientosData] = useState(null);
  const [seguimientosCargando, setSeguimientosCargando] = useState(false);
  const [seguimientosError, setSeguimientosError] = useState('');
  const [filtroEstadoSeguimiento, setFiltroEstadoSeguimiento] = useState('');
  const [filtroAlertaSeguimiento, setFiltroAlertaSeguimiento] = useState('');
  const [paginaSeguimientos, setPaginaSeguimientos] = useState(1);
  const [seguimientoAccionModal, setSeguimientoAccionModal] = useState(null);

  // Modal de Devolución
  const [modalDevolucion, setModalDevolucion] = useState(null); // { adopcionId, animalNombre, postulanteNombre }
  const [formDevolucion, setFormDevolucion] = useState({
    fecha: ahoraLocal(),
    motivo: '',
    estadoAnimal: '',
    observacionesPostulante: ''
  });
  const [guardandoDevolucion, setGuardandoDevolucion] = useState(false);
  const [errorDevolucion, setErrorDevolucion] = useState('');
  const [exitoDevolucion, setExitoDevolucion] = useState(false);

  // Formulario Solicitud (Crear / Editar)
  const [formPostulante, setFormPostulante] = useState({
    tipoIdentificacion: 'RUT',
    identificacion: '',
    nombre: '',
    email: '',
    telefono: '',
    direccion: ''
  });
  const [formAnimalId, setFormAnimalId] = useState('');
  const [formMotivacion, setFormMotivacion] = useState('');
  const [animalesDisponibles, setAnimalesDisponibles] = useState([]);
  const [cargandoAnimales, setCargandoAnimales] = useState(false);
  const [errorAnimales, setErrorAnimales] = useState('');
  const [antecedentes, setAntecedentes] = useState(null);
  const [consultandoAntecedentes, setConsultandoAntecedentes] = useState(false);
  const [guardandoSolicitud, setGuardandoSolicitud] = useState(false);
  const [errorFormSolicitud, setErrorFormSolicitud] = useState('');
  const [alertasPostulante, setAlertasPostulante] = useState([]);

  // Formulario de Registro / Reprogramación de Seguimiento
  const [formSeguimiento, setFormSeguimiento] = useState({
    accion: 'REGISTRAR', // 'REGISTRAR' | 'REPROGRAMAR'
    fecha: ahoraLocal(),
    canal: '',
    estadoAnimal: '',
    resultado: '',
    observaciones: '',
    fechaReprogramada: ''
  });
  const [guardandoSeguimientoAccion, setGuardandoSeguimientoAccion] = useState(false);
  const [errorSeguimientoAccion, setErrorSeguimientoAccion] = useState('');

  const tienePermisoAdopciones = ['DIRECTORA', 'ENCARGADA_ADOPCIONES'].includes(user?.rol);

  // La búsqueda se actualiza sola mientras se escribe (con una pausa mínima para no saturar al servidor)
  useEffect(() => {
    if (tab === 'lista' && tienePermisoAdopciones) {
      const controller = new AbortController();
      const timer = setTimeout(() => cargarSolicitudes(controller.signal), solicitudesData ? 200 : 0);
      return () => {
        clearTimeout(timer);
        controller.abort();
      };
    }
  }, [tab, tienePermisoAdopciones, paginaSolicitudes, filtroEstado, filtroTexto, ordenSolicitudes, fechaDesde, fechaHasta, recargaSolicitudes]);

  // Carga inicial en Seguimientos
  useEffect(() => {
    if (tab === 'seguimientos' && tienePermisoAdopciones) {
      const controller = new AbortController();
      cargarSeguimientos(controller.signal);
      return () => controller.abort();
    }
  }, [tab, tienePermisoAdopciones, paginaSeguimientos, filtroEstadoSeguimiento, filtroAlertaSeguimiento]);

  // Carga de animales cuando se abre la ventana de nueva solicitud
  useEffect(() => {
    if (modalSolicitud === 'crear' && tienePermisoAdopciones) {
      cargarAnimalesDisponibles();
    }
  }, [modalSolicitud]);

  // Cargar detalle cuando se abre una solicitud
  useEffect(() => {
    if (solicitudSeleccionadaId && modalSolicitud === 'detalle' && tienePermisoAdopciones) {
      cargarDetalleSolicitud(solicitudSeleccionadaId);
    }
  }, [solicitudSeleccionadaId, modalSolicitud]);

  if (!tienePermisoAdopciones) {
    return (
      <div className="portal-page-container">
        <div className="portal-alert portal-alert-danger">
          No tienes permisos para acceder al módulo de gestión de adopciones.
        </div>
      </div>
    );
  }

  // --- MÉTODOS DE SOLICITUDES ---
  const hayFiltrosSolicitudes = Boolean(
    filtroTexto.trim() || filtroEstado || fechaDesde || fechaHasta || ordenSolicitudes !== 'reciente'
  );

  const limpiarFiltrosSolicitudes = () => {
    setFiltroTexto('');
    setFiltroEstado('');
    setOrdenSolicitudes('reciente');
    setFechaDesde('');
    setFechaHasta('');
    setPaginaSolicitudes(1);
  };

  const cargarSolicitudes = async (signal) => {
    setSolicitudesCargando(true);
    setSolicitudesError('');
    try {
      const params = {
        pagina: paginaSolicitudes,
        orden: ordenSolicitudes,
        ...(filtroTexto.trim() && { search: filtroTexto.trim() }),
        ...(filtroEstado && { estado: filtroEstado }),
        ...(fechaDesde && { desde: new Date(`${fechaDesde}T00:00:00`).toISOString() }),
        ...(fechaHasta && { hasta: new Date(`${fechaHasta}T23:59:59.999`).toISOString() })
      };
      const res = await listarSolicitudes(params, signal);
      if (signal?.aborted) return;
      setSolicitudesData(res);
    } catch (err) {
      if (!signal?.aborted) setSolicitudesError(formatearErrorApi(err, 'No pudimos cargar las solicitudes. Intenta nuevamente.'));
    } finally {
      if (!signal?.aborted) setSolicitudesCargando(false);
    }
  };

  const refrescarSolicitudes = () => setRecargaSolicitudes(k => k + 1);

  const verExpediente = (id) => {
    setSolicitudSeleccionadaId(id);
    setEditandoSolicitud(false);
    setConfirmarEliminar(false);
    setErrorEtapa('');
    setModalSolicitud('detalle');
  };

  const cerrarModalSolicitud = () => {
    setModalSolicitud(null);
    setEditandoSolicitud(false);
    setConfirmarEliminar(false);
    setErrorFormSolicitud('');
    setErrorEtapa('');
    setDetalleData(null);
    setSolicitudSeleccionadaId(null);
    refrescarSolicitudes();
  };

  const cargarDetalleSolicitud = async (id) => {
    setDetalleCargando(true);
    setDetalleError('');
    try {
      const res = await obtenerSolicitud(id);
      setDetalleData(res);
      // Preconfigurar formulario de etapa
      const disp = opcionesEtapasDisponibles(res.solicitud);
      const primeraAccion = disp[0] || '';
      setAccionEtapa(primeraAccion);
      setFechaEtapa(primeraAccion === 'AGENDAR_VISITA' ? '' : ahoraLocal());
      setResultadoEvalEtapa('');
      setObservacionesEtapa('');
      setMotivoOmisionEtapa('');
    } catch (err) {
      setDetalleError(formatearErrorApi(err, 'Error al cargar expediente'));
    } finally {
      setDetalleCargando(false);
    }
  };

  const handleGuardarEtapa = async (e) => {
    e.preventDefault();
    if (!detalleData?.solicitud) return;
    setGuardandoEtapa(true);
    setErrorEtapa('');
    try {
      await registrarEtapa(detalleData.solicitud.id, {
        accion: accionEtapa,
        fecha: new Date(fechaEtapa).toISOString(),
        observaciones: observacionesEtapa,
        actualizadoEn: detalleData.solicitud.actualizadoEn,
        ...(accionEtapa === 'OMITIR_VISITA' && { motivoOmision: motivoOmisionEtapa }),
        ...(accionEtapa === 'EVALUAR' && { resultadoEvaluacion: resultadoEvalEtapa })
      });

      const mensaje = accionEtapa === 'ENTREGAR'
        ? 'Adopción concretada con éxito. El animal quedó adoptado y su canil liberado.'
        : 'Progreso y etapa de la adopción actualizados.';

      setMensajeExito(mensaje);
      setTimeout(() => setMensajeExito(null), 4000);
      refrescarSolicitudes();
      await cargarDetalleSolicitud(detalleData.solicitud.id);
    } catch (err) {
      setErrorEtapa(formatearErrorApi(err));
    } finally {
      setGuardandoEtapa(false);
    }
  };

  const handleEliminarSolicitud = async () => {
    if (!detalleData?.solicitud) return;
    setEliminando(true);
    try {
      await eliminarSolicitud(detalleData.solicitud.id, detalleData.solicitud.actualizadoEn);
      setConfirmarEliminar(false);
      setMensajeExito('Solicitud cancelada y eliminada lógicamente; su historial queda conservado en auditoría.');
      setTimeout(() => setMensajeExito(null), 4000);
      await cargarDetalleSolicitud(detalleData.solicitud.id);
    } catch (err) {
      setErrorEtapa(formatearErrorApi(err, 'Error al eliminar la solicitud'));
    } finally {
      setEliminando(false);
    }
  };

  // --- MÉTODOS DE FORMULARIO DE SOLICITUD (CREAR / EDITAR) ---
  const cargarAnimalesDisponibles = async () => {
    setCargandoAnimales(true);
    setErrorAnimales('');
    try {
      const data = await listarAnimalesDisponibles();
      setAnimalesDisponibles(data);
    } catch (err) {
      setErrorAnimales(formatearErrorApi(err, 'Error al listar animales disponibles'));
    } finally {
      setCargandoAnimales(false);
    }
  };

  const abrirCrearSolicitud = () => {
    setFormPostulante({
      tipoIdentificacion: 'RUT',
      identificacion: '',
      nombre: '',
      email: '',
      telefono: '',
      direccion: ''
    });
    setFormAnimalId('');
    setFormMotivacion('');
    setAntecedentes(null);
    setAlertasPostulante([]);
    setErrorFormSolicitud('');
    setModalSolicitud('crear');
  };

  const abrirEditarSolicitud = () => {
    if (!detalleData?.solicitud) return;
    const sol = detalleData.solicitud;
    setFormPostulante(sol.datosPostulante || {
      tipoIdentificacion: 'RUT',
      identificacion: '',
      nombre: '',
      email: '',
      telefono: '',
      direccion: ''
    });
    setFormAnimalId(String(sol.animalId));
    setFormMotivacion(sol.motivacion || '');
    setAntecedentes({ solicitudesActivas: [], devolucionesPrevias: [], alertas: [] });
    setAlertasPostulante([]);
    setErrorFormSolicitud('');
    setEditandoSolicitud(true);
    cargarAnimalesDisponibles();
  };

  const handleConsultarAntecedentes = async () => {
    if (!formPostulante.identificacion.trim()) return;
    setConsultandoAntecedentes(true);
    setErrorFormSolicitud('');
    setAntecedentes(null);
    setAlertasPostulante([]);
    try {
      const res = await obtenerAntecedentes(formPostulante.tipoIdentificacion, formPostulante.identificacion);
      setAntecedentes(res);
      setAlertasPostulante(res.alertas || []);
      if (res.postulante) {
        setFormPostulante(prev => ({
          ...prev,
          nombre: res.postulante.nombre || prev.nombre,
          email: res.postulante.email || prev.email,
          telefono: res.postulante.telefono || prev.telefono,
          direccion: res.postulante.direccion || prev.direccion
        }));
      }
    } catch (err) {
      setErrorFormSolicitud(formatearErrorApi(err));
    } finally {
      setConsultandoAntecedentes(false);
    }
  };

  const handleGuardarSolicitud = async (e) => {
    e.preventDefault();
    if (!antecedentes && !editandoSolicitud) return;
    if (antecedentes?.solicitudesActivas?.length > 0 || antecedentes?.postulante?.activo === false) return;

    setGuardandoSolicitud(true);
    setErrorFormSolicitud('');
    try {
      const payload = {
        postulante: formPostulante,
        animalId: Number(formAnimalId),
        motivacion: formMotivacion
      };

      if (editandoSolicitud && detalleData?.solicitud) {
        await editarSolicitud(detalleData.solicitud.id, {
          ...payload,
          actualizadoEn: detalleData.solicitud.actualizadoEn
        });
        setMensajeExito('Solicitud editada correctamente.');
        setTimeout(() => setMensajeExito(null), 4000);
        setEditandoSolicitud(false);
        await cargarDetalleSolicitud(detalleData.solicitud.id);
      } else {
        const res = await crearSolicitud(payload);
        setMensajeExito('Solicitud registrada exitosamente.');
        setTimeout(() => setMensajeExito(null), 4000);
        refrescarSolicitudes();
        verExpediente(res.solicitud.id);
      }
    } catch (err) {
      setErrorFormSolicitud(formatearErrorApi(err));
      if (err.alertas) setAlertasPostulante(err.alertas);
    } finally {
      setGuardandoSolicitud(false);
    }
  };

  // --- MÉTODOS DE SEGUIMIENTOS ---
  const cargarSeguimientos = async (signal) => {
    setSeguimientosCargando(true);
    setSeguimientosError('');
    try {
      const params = {
        pagina: paginaSeguimientos,
        ...(filtroEstadoSeguimiento && { estado: filtroEstadoSeguimiento }),
        ...(filtroAlertaSeguimiento && { alertaSinContacto: filtroAlertaSeguimiento })
      };
      const res = await listarSeguimientos(params, signal);
      if (signal?.aborted) return;
      setSeguimientosData(res);
    } catch (err) {
      if (!signal?.aborted) setSeguimientosError(formatearErrorApi(err, 'Error al cargar seguimientos'));
    } finally {
      if (!signal?.aborted) setSeguimientosCargando(false);
    }
  };

  const abrirModalAccionSeguimiento = (seguimiento) => {
    setSeguimientoAccionModal(seguimiento);
    setFormSeguimiento({
      accion: 'REGISTRAR',
      fecha: ahoraLocal(),
      canal: '',
      estadoAnimal: '',
      resultado: '',
      observaciones: '',
      fechaReprogramada: ''
    });
    setErrorSeguimientoAccion('');
  };

  const handleGuardarAccionSeguimiento = async (e) => {
    e.preventDefault();
    if (!seguimientoAccionModal) return;
    setGuardandoSeguimientoAccion(true);
    setErrorSeguimientoAccion('');
    try {
      const esReprogramar = formSeguimiento.accion === 'REPROGRAMAR';
      if (esReprogramar) {
        const res = await reprogramarSeguimiento(seguimientoAccionModal.id, {
          fechaIntento: new Date(formSeguimiento.fecha).toISOString(),
          canalContacto: formSeguimiento.canal,
          resultado: formSeguimiento.resultado.trim() || 'NO_RESPONDE',
          observaciones: formSeguimiento.observaciones,
          fechaReprogramada: new Date(formSeguimiento.fechaReprogramada).toISOString(),
          actualizadoEn: seguimientoAccionModal.actualizadoEn
        });
        setMensajeExito(res.alertaGenerada
          ? 'Límite de intentos alcanzado: el seguimiento quedó marcado «Sin contacto» y generó alerta.'
          : 'Intento registrado y seguimiento reprogramado.');
      } else {
        await registrarSeguimiento(seguimientoAccionModal.id, {
          fecha: new Date(formSeguimiento.fecha).toISOString(),
          canalContacto: formSeguimiento.canal,
          estadoAnimal: formSeguimiento.estadoAnimal,
          resultado: formSeguimiento.resultado,
          ...(formSeguimiento.observaciones.trim() && { observaciones: formSeguimiento.observaciones }),
          actualizadoEn: seguimientoAccionModal.actualizadoEn
        });
        setMensajeExito('Seguimiento registrado exitosamente.');
      }

      setTimeout(() => setMensajeExito(null), 4000);
      setSeguimientoAccionModal(null);
      await cargarSeguimientos();
    } catch (err) {
      setErrorSeguimientoAccion(formatearErrorApi(err));
    } finally {
      setGuardandoSeguimientoAccion(false);
    }
  };

  // --- MÉTODOS DE DEVOLUCIÓN ---
  const abrirModalDevolucion = (adopcionId, animalNombre, postulanteNombre) => {
    setModalDevolucion({ adopcionId, animalNombre, postulanteNombre });
    setFormDevolucion({
      fecha: ahoraLocal(),
      motivo: '',
      estadoAnimal: '',
      observacionesPostulante: ''
    });
    setErrorDevolucion('');
    setExitoDevolucion(false);
  };

  const handleGuardarDevolucion = async (e) => {
    e.preventDefault();
    if (!modalDevolucion) return;
    setGuardandoDevolucion(true);
    setErrorDevolucion('');
    try {
      await registrarDevolucion({
        adopcionId: modalDevolucion.adopcionId,
        fecha: new Date(formDevolucion.fecha).toISOString(),
        motivo: formDevolucion.motivo,
        estadoAnimal: formDevolucion.estadoAnimal,
        ...(formDevolucion.observacionesPostulante.trim() && {
          observacionesPostulante: formDevolucion.observacionesPostulante
        })
      });
      setExitoDevolucion(true);
      setMensajeExito(`Devolución de ${modalDevolucion.animalNombre} registrada con éxito.`);
      setTimeout(() => setMensajeExito(null), 4000);
      if (modalSolicitud === 'detalle' && solicitudSeleccionadaId) {
        cargarDetalleSolicitud(solicitudSeleccionadaId);
      }
      if (tab === 'seguimientos') {
        cargarSeguimientos();
      }
      refrescarSolicitudes();
    } catch (err) {
      setErrorDevolucion(formatearErrorApi(err));
    } finally {
      setGuardandoDevolucion(false);
    }
  };

  // Formulario de solicitud (se usa al crear y al editar dentro de la ventana modal)
  const formularioSolicitud = (
          <form onSubmit={handleGuardarSolicitud}>
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, marginBottom: '12px', color: 'var(--portal-text-main)' }}>
                1. Identificación y Consulta de Antecedentes
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '12px', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                    Tipo Doc.
                  </label>
                  <select
                    disabled={editandoSolicitud}
                    value={formPostulante.tipoIdentificacion}
                    onChange={(e) => {
                      setFormPostulante(prev => ({ ...prev, tipoIdentificacion: e.target.value }));
                      setAntecedentes(null);
                    }}
                    className="portal-select"
                    style={{ width: '100%' }}
                  >
                    <option value="RUT">RUT Chileno</option>
                    <option value="OTRO">Otro Pasaporte/DNI</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                    Identificación / RUT
                  </label>
                  <input
                    disabled={editandoSolicitud}
                    required
                    maxLength={60}
                    value={formPostulante.identificacion}
                    onChange={(e) => {
                      setFormPostulante(prev => ({ ...prev, identificacion: e.target.value }));
                      setAntecedentes(null);
                    }}
                    onBlur={() => setFormPostulante(prev => ({
                      ...prev,
                      identificacion: formatearIdentificacion(prev.identificacion, prev.tipoIdentificacion)
                    }))}
                    placeholder={formPostulante.tipoIdentificacion === 'RUT' ? 'Ej: 12.345.678-5' : 'AB123456'}
                    className="portal-input"
                    style={{ width: '100%' }}
                  />
                </div>

                {!editandoSolicitud && (
                  <button
                    type="button"
                    onClick={handleConsultarAntecedentes}
                    disabled={consultandoAntecedentes || !formPostulante.identificacion.trim()}
                    className="portal-btn portal-btn-secondary"
                  >
                    {consultandoAntecedentes ? 'Consultando...' : 'Consultar'}
                  </button>
                )}
              </div>

              {/* Alertas y Antecedentes */}
              {alertasPostulante.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  {alertasPostulante.map((alerta, idx) => (
                    <div key={idx} className="portal-alert portal-alert-danger" style={{ margin: '6px 0', fontSize: '0.84rem' }}>
                      <AlertTriangle size={15} /> {alerta.mensaje}
                    </div>
                  ))}
                </div>
              )}

              {antecedentes && !alertasPostulante.length && (
                <div className="portal-alert portal-alert-success" style={{ marginTop: '12px', fontSize: '0.84rem' }}>
                  <ShieldCheck size={16} /> Postulante habilitado: no registra solicitudes activas ni devoluciones previas.
                </div>
              )}

              {antecedentes?.devolucionesPrevias?.map(dev => (
                <div key={dev.id} className="portal-alert portal-alert-warning" style={{ marginTop: '8px', fontSize: '0.84rem' }}>
                  <AlertTriangle size={15} /> Devolución registrada ({formatearFecha(dev.fecha)}): {dev.motivo}
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, marginBottom: '12px', color: 'var(--portal-text-main)' }}>
                2. Datos de Contacto del Postulante
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                    Nombre Completo
                  </label>
                  <input
                    required
                    value={formPostulante.nombre}
                    onChange={(e) => setFormPostulante({ ...formPostulante, nombre: e.target.value })}
                    placeholder="Ana Pérez González"
                    className="portal-input"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                    Correo Electrónico
                  </label>
                  <input
                    required
                    type="email"
                    value={formPostulante.email}
                    onChange={(e) => setFormPostulante({ ...formPostulante, email: e.target.value })}
                    placeholder="ana@ejemplo.cl"
                    className="portal-input"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                    Teléfono
                  </label>
                  <input
                    required
                    value={formPostulante.telefono}
                    onChange={(e) => setFormPostulante({ ...formPostulante, telefono: e.target.value })}
                    placeholder="+56 9 1234 5678"
                    className="portal-input"
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                    Dirección Domiciliaria
                  </label>
                  <input
                    required
                    value={formPostulante.direccion}
                    onChange={(e) => setFormPostulante({ ...formPostulante, direccion: e.target.value })}
                    placeholder="Calle Los Aromos 123, Depto 402, Santiago"
                    className="portal-input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, marginBottom: '12px', color: 'var(--portal-text-main)' }}>
                3. Selección del Animal y Condiciones
              </h4>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                  Animal Disponible para Adopción *
                </label>
                <AnimalCardPicker
                  animales={animalesDisponibles}
                  value={formAnimalId}
                  onChange={(animalId) => setFormAnimalId(animalId)}
                  cargando={cargandoAnimales}
                  disabled={guardandoSolicitud}
                />
                {errorAnimales && (
                  <p style={{ color: '#d1453b', fontSize: '0.78rem', margin: '4px 0 0' }}>{errorAnimales}</p>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                  Motivación y Condiciones del Hogar (Mínimo 10 caracteres)
                </label>
                <textarea
                  required
                  minLength={10}
                  maxLength={4000}
                  rows={4}
                  value={formMotivacion}
                  onChange={(e) => setFormMotivacion(e.target.value)}
                  placeholder="Detalla experiencia previa con mascotas, espacio disponible en vivienda, miembros del hogar y motivos de la adopción..."
                  className="portal-textarea"
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>

            <div className="adop-modal-pie">
              <button
                type="button"
                onClick={() => (editandoSolicitud ? setEditandoSolicitud(false) : cerrarModalSolicitud())}
                className="portal-btn portal-btn-secondary"
                disabled={guardandoSolicitud}
              >
                {editandoSolicitud ? 'Cancelar edición' : 'Cancelar'}
              </button>
              <button
                type="submit"
                disabled={guardandoSolicitud || (!antecedentes && !editandoSolicitud) || antecedentes?.solicitudesActivas?.length > 0 || !formAnimalId}
                className="portal-btn portal-btn-primary"
              >
                {guardandoSolicitud ? 'Guardando...' : editandoSolicitud ? 'Guardar cambios' : 'Registrar solicitud'}
              </button>
            </div>
          </form>
  );


  return (
    <div className="portal-page-container">
      <div className="portal-header" style={{ marginBottom: '16px' }}>
        <div>
          <h2 className="portal-header-title">
            <House size={26} aria-hidden="true" />
            <span>Gestión de Adopciones</span>
          </h2>
          <p className="portal-header-subtitle">
            Evaluación de postulantes, trazabilidad de solicitudes, seguimientos post-adopción y devoluciones
          </p>
        </div>

        <div className="portal-header-actions">
          {/* Botón de Nueva Solicitud en formato verde primario */}
          <button
            type="button"
            onClick={abrirCrearSolicitud}
            className="portal-btn portal-btn-primary"
          >
            <Plus size={16} aria-hidden="true" /> Nueva Solicitud
          </button>
        </div>
      </div>

      {/* Pestañas Subnavegación */}
      <div className="portal-subtabs portal-subtabs-sticky">
        <button
          type="button"
          onClick={() => setTab('lista')}
          className={`portal-subtab-btn ${tab === 'lista' ? 'active' : ''}`}
        >
          <ClipboardList size={15} aria-hidden="true" /> Consultar Solicitudes
        </button>
        <button
          type="button"
          onClick={() => setTab('seguimientos')}
          className={`portal-subtab-btn ${tab === 'seguimientos' ? 'active' : ''}`}
        >
          <PhoneCall size={15} aria-hidden="true" /> Seguimientos Post-Adopción
        </button>
      </div>

      {mensajeExito && (
        <div className="portal-alert portal-alert-success" style={{ marginBottom: '18px', fontWeight: '600' }}>
          <Check size={18} aria-hidden="true" /> {mensajeExito}
        </div>
      )}

      {/* ============================================================== */}
      {/* PESTAÑA: CONSULTAR SOLICITUDES                                  */}
      {/* ============================================================== */}
      {tab === 'lista' && (
        <div>
          <div className="portal-card adop-filtros-card">
            <div className="adop-filtros">
              <div className="adop-filtros-campo adop-filtros-campo-busqueda">
                <label htmlFor="adop-busqueda" className="adop-filtros-etiqueta">
                  Buscar por postulante, RUT o animal
                </label>
                <div className="adop-filtros-buscador">
                  <Search size={16} aria-hidden="true" className="adop-filtros-buscador-icono" />
                  <input
                    id="adop-busqueda"
                    type="search"
                    autoComplete="off"
                    value={filtroTexto}
                    onChange={(e) => {
                      setFiltroTexto(e.target.value);
                      setPaginaSolicitudes(1);
                    }}
                    placeholder="Ej. Juan Pérez, 12.345.678-9, Luna..."
                    className="portal-input"
                  />
                </div>
              </div>

              <div className="adop-filtros-campo adop-filtros-campo-estado">
                <label htmlFor="adop-estado" className="adop-filtros-etiqueta">Estado de la solicitud</label>
                <select
                  id="adop-estado"
                  value={filtroEstado}
                  onChange={(e) => {
                    setFiltroEstado(e.target.value);
                    setPaginaSolicitudes(1);
                  }}
                  className="portal-select"
                >
                  <option value="">Todos los estados</option>
                  {Object.entries(ESTADOS_SOLICITUD).map(([clave, info]) => (
                    <option key={clave} value={clave}>{info.etiqueta}</option>
                  ))}
                </select>
              </div>

              <div className="adop-filtros-campo adop-filtros-campo-tercio">
                <label htmlFor="adop-orden" className="adop-filtros-etiqueta">Ordenar por fecha</label>
                <select
                  id="adop-orden"
                  value={ordenSolicitudes}
                  onChange={(e) => {
                    setOrdenSolicitudes(e.target.value);
                    setPaginaSolicitudes(1);
                  }}
                  className="portal-select"
                >
                  <option value="reciente">Más recientes primero</option>
                  <option value="antigua">Más antiguas primero</option>
                </select>
              </div>

              <div className="adop-filtros-campo adop-filtros-campo-tercio">
                <label htmlFor="adop-desde" className="adop-filtros-etiqueta">Solicitadas desde</label>
                <input
                  id="adop-desde"
                  type="date"
                  value={fechaDesde}
                  max={fechaHasta || undefined}
                  onChange={(e) => {
                    setFechaDesde(e.target.value);
                    setPaginaSolicitudes(1);
                  }}
                  className="portal-input"
                />
              </div>

              <div className="adop-filtros-campo adop-filtros-campo-tercio">
                <label htmlFor="adop-hasta" className="adop-filtros-etiqueta">Hasta</label>
                <input
                  id="adop-hasta"
                  type="date"
                  value={fechaHasta}
                  min={fechaDesde || undefined}
                  onChange={(e) => {
                    setFechaHasta(e.target.value);
                    setPaginaSolicitudes(1);
                  }}
                  className="portal-input"
                />
              </div>
            </div>

            {(hayFiltrosSolicitudes || (solicitudesCargando && solicitudesData)) && (
              <div className="adop-filtros-acciones">
                {solicitudesCargando && solicitudesData && (
                  <span className="adop-buscando" role="status" aria-live="polite">
                    Actualizando resultados…
                  </span>
                )}
                {hayFiltrosSolicitudes && (
                  <button
                    type="button"
                    onClick={limpiarFiltrosSolicitudes}
                    className="portal-btn portal-btn-secondary"
                    style={{ minHeight: '34px', padding: '6px 14px', fontSize: '0.82rem' }}
                  >
                    <X size={14} aria-hidden="true" /> Limpiar filtros
                  </button>
                )}
              </div>
            )}
          </div>

          {solicitudesError && (
            <div className="portal-alert portal-alert-danger" style={{ marginBottom: '16px' }}>
              <AlertTriangle size={16} /> {solicitudesError}
            </div>
          )}

          {solicitudesCargando && !solicitudesData ? (
            <div className="portal-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--portal-text-muted)' }}>
              Cargando solicitudes de adopción...
            </div>
          ) : !solicitudesData?.solicitudes?.length ? (
            <div className="portal-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--portal-text-muted)' }}>
              <ClipboardList size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ fontWeight: 600, margin: 0 }}>No se encontraron solicitudes con los criterios seleccionados.</p>
            </div>
          ) : (
            <div className="portal-card" style={{ padding: 0, overflow: 'hidden', opacity: solicitudesCargando ? 0.65 : 1, transition: 'opacity 0.15s' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="portal-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--portal-border)' }}>
                      <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800 }}>Folio</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800 }}>Fecha de solicitud</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800 }}>Postulante</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800 }}>Animal</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800 }}>Estado</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800, textAlign: 'right' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {solicitudesData.solicitudes.map(solicitud => {
                      const estadoInfo = ESTADOS_SOLICITUD[solicitud.estado] || { etiqueta: solicitud.estado, bg: '#eee', color: '#555' };
                      return (
                        <tr key={solicitud.id} style={{ borderBottom: '1px solid var(--portal-border)', transition: 'background 0.2s' }}>
                          <td style={{ padding: '14px 16px' }}>
                            <span className="adop-folio">{folioSolicitud(solicitud)}</span>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '0.86rem', color: 'var(--portal-text-muted)', whiteSpace: 'nowrap' }}>
                            {formatearFecha(solicitud.creadoEn, true)}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--portal-text-main)', fontSize: '0.9rem' }}>
                              {solicitud.datosPostulante?.nombre}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--portal-text-muted)' }}>
                              {solicitud.postulante?.identificacion || solicitud.datosPostulante?.identificacion}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                            {solicitud.animal?.nombre}
                            <span style={{ fontSize: '0.78rem', color: 'var(--portal-text-muted)', marginLeft: 6 }}>
                              ({solicitud.animal?.especie})
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '3px 10px',
                                borderRadius: '999px',
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                background: estadoInfo.bg,
                                color: estadoInfo.color
                              }}
                            >
                              {estadoInfo.etiqueta}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => verExpediente(solicitud.id)}
                              className="portal-btn portal-btn-secondary"
                              style={{ padding: '6px 12px', minHeight: '32px', fontSize: '0.8rem' }}
                            >
                              <Eye size={14} /> Ver detalle
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 20px',
                  borderTop: '1px solid var(--portal-border)',
                  background: '#fafbfc'
                }}
              >
                <div style={{ fontSize: '0.84rem', color: 'var(--portal-text-muted)' }}>
                  Total: <strong>{solicitudesData.total}</strong> solicitud(es) · Página {solicitudesData.pagina} de {Math.max(1, Math.ceil(solicitudesData.total / solicitudesData.limite))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    disabled={solicitudesData.pagina <= 1 || solicitudesCargando}
                    onClick={() => setPaginaSolicitudes(p => p - 1)}
                    className="portal-btn portal-btn-secondary"
                    style={{ padding: '6px 12px', minHeight: '32px', fontSize: '0.8rem' }}
                  >
                    <ChevronLeft size={14} /> Anterior
                  </button>
                  <button
                    type="button"
                    disabled={solicitudesData.pagina * solicitudesData.limite >= solicitudesData.total || solicitudesCargando}
                    onClick={() => setPaginaSolicitudes(p => p + 1)}
                    className="portal-btn portal-btn-secondary"
                    style={{ padding: '6px 12px', minHeight: '32px', fontSize: '0.8rem' }}
                  >
                    Siguiente <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* PESTAÑA: SEGUIMIENTOS POST-ADOPCIÓN                             */}
      {/* ============================================================== */}
      {tab === 'seguimientos' && (
        <div>
          <div className="portal-card adop-filtros-card">
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Seguimientos Post-Adopción</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--portal-text-muted)' }}>
                Programación automatizada (15 y 30 días) para verificar adaptación, salud y bienestar del animal adoptado.
              </p>
            </div>

            <div className="adop-filtros-seguimientos">
              <div className="adop-filtros-campo">
                <label htmlFor="seg-estado" className="adop-filtros-etiqueta">
                  Estado
                </label>
                <select
                  id="seg-estado"
                  value={filtroEstadoSeguimiento}
                  onChange={(e) => {
                    setFiltroEstadoSeguimiento(e.target.value);
                    setPaginaSeguimientos(1);
                  }}
                  className="portal-select"
                >
                  <option value="">Todos los estados</option>
                  {Object.entries(ESTADOS_SEGUIMIENTO).map(([clave, info]) => (
                    <option key={clave} value={clave}>{info.etiqueta}</option>
                  ))}
                </select>
              </div>

              <div className="adop-filtros-campo">
                <label htmlFor="seg-alerta" className="adop-filtros-etiqueta">
                  Alerta sin contacto
                </label>
                <select
                  id="seg-alerta"
                  value={filtroAlertaSeguimiento}
                  onChange={(e) => {
                    setFiltroAlertaSeguimiento(e.target.value);
                    setPaginaSeguimientos(1);
                  }}
                  className="portal-select"
                >
                  <option value="">Todas las alertas</option>
                  <option value="true">Solo «Sin contacto» (Requieren atención)</option>
                </select>
              </div>
            </div>
          </div>

          {seguimientosError && (
            <div className="portal-alert portal-alert-danger" style={{ marginBottom: '16px' }}>
              <AlertTriangle size={16} /> {seguimientosError}
            </div>
          )}

          {seguimientosCargando ? (
            <div className="portal-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--portal-text-muted)' }}>
              Cargando cronograma de seguimientos...
            </div>
          ) : !seguimientosData?.seguimientos?.length ? (
            <div className="portal-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--portal-text-muted)' }}>
              <PhoneCall size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ fontWeight: 600, margin: 0 }}>No hay seguimientos registrados para los filtros indicados.</p>
            </div>
          ) : (
            <div className="portal-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="portal-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--portal-border)' }}>
                      <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800 }}>Tipo y Animal</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800 }}>Adoptante</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800 }}>Programado</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800 }}>Estado</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800 }}>Intentos</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800, textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seguimientosData.seguimientos.map(s => {
                      const estadoInfo = ESTADOS_SEGUIMIENTO[s.estado] || { etiqueta: s.estado, bg: '#eee', color: '#555' };
                      return (
                        <tr
                          key={s.id}
                          style={{
                            borderBottom: '1px solid var(--portal-border)',
                            background: s.alertaSinContacto ? '#fff8f7' : 'transparent'
                          }}
                        >
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--portal-text-main)', fontSize: '0.9rem' }}>
                              {s.adopcion?.animal?.nombre}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--portal-text-muted)' }}>
                              {TIPOS_SEGUIMIENTO[s.tipoSeguimiento] || s.tipoSeguimiento} · <span className="adop-folio">{folioSeguimiento(s)}</span>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 600 }}>{s.adopcion?.postulante?.nombre}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--portal-text-muted)' }}>
                              {s.adopcion?.postulante?.identificacion}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '0.85rem' }}>
                            <div>{formatearFecha(s.fechaProgramada, true)}</div>
                            {s.fechaEjecucion && (
                              <div style={{ fontSize: '0.76rem', color: '#2f5540' }}>
                                Realizado: {formatearFecha(s.fechaEjecucion, true)}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '3px 10px',
                                borderRadius: '999px',
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                background: estadoInfo.bg,
                                color: estadoInfo.color
                              }}
                            >
                              {estadoInfo.etiqueta}
                            </span>
                            {s.alertaSinContacto && (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, color: '#d1453b', fontSize: '0.74rem', fontWeight: 700 }}>
                                <AlertTriangle size={12} /> Límite de intentos
                              </div>
                            )}
                            {s.estado === 'COMPLETADO' && s.canalContacto && (
                              <div style={{ fontSize: '0.76rem', color: 'var(--portal-text-muted)', marginTop: 4 }}>
                                {CANALES_DESPLIEGUE[s.canalContacto] || s.canalContacto} · {s.resultado}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '0.85rem' }}>
                            {s.intentosFallidos} / {s.limiteIntentos}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              {s.adopcion?.devolucion ? (
                                <span style={{ fontSize: '0.8rem', color: '#7c8592', fontStyle: 'italic' }}>
                                  Adopción devuelta
                                </span>
                              ) : (
                                <>
                                  {s.estado !== 'COMPLETADO' && (
                                    <button
                                      type="button"
                                      onClick={() => abrirModalAccionSeguimiento(s)}
                                      className="portal-btn portal-btn-secondary"
                                      style={{ padding: '6px 10px', minHeight: '32px', fontSize: '0.78rem' }}
                                    >
                                      <Clock size={13} /> Gestionar
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => abrirModalDevolucion(s.adopcion.id, s.adopcion.animal?.nombre, s.adopcion.postulante?.nombre)}
                                    className="portal-btn portal-btn-secondary"
                                    style={{ padding: '6px 10px', minHeight: '32px', fontSize: '0.78rem', color: '#d1453b' }}
                                  >
                                    <RotateCcw size={13} /> Devolución
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 20px',
                  borderTop: '1px solid var(--portal-border)',
                  background: '#fafbfc'
                }}
              >
                <div style={{ fontSize: '0.84rem', color: 'var(--portal-text-muted)' }}>
                  Total: <strong>{seguimientosData.total}</strong> seguimiento(s) · Página {seguimientosData.pagina} de {seguimientosData.totalPaginas}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    disabled={seguimientosData.pagina <= 1 || seguimientosCargando}
                    onClick={() => setPaginaSeguimientos(p => p - 1)}
                    className="portal-btn portal-btn-secondary"
                    style={{ padding: '6px 12px', minHeight: '32px', fontSize: '0.8rem' }}
                  >
                    <ChevronLeft size={14} /> Anterior
                  </button>
                  <button
                    type="button"
                    disabled={seguimientosData.pagina >= seguimientosData.totalPaginas || seguimientosCargando}
                    onClick={() => setPaginaSeguimientos(p => p + 1)}
                    className="portal-btn portal-btn-secondary"
                    style={{ padding: '6px 12px', minHeight: '32px', fontSize: '0.8rem' }}
                  >
                    Siguiente <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: NUEVA SOLICITUD                                          */}
      {/* ============================================================== */}
      {modalSolicitud === 'crear' && (
        <ModalAdopcion
          titulo="Nueva solicitud de adopción"
          subtitulo="Verifica los antecedentes de la persona postulante antes de registrar la solicitud."
          icono={<FilePenLine size={20} aria-hidden="true" />}
          ancho="lg"
          bloqueado={guardandoSolicitud}
          onClose={cerrarModalSolicitud}
        >
          {errorFormSolicitud && (
            <div className="portal-alert portal-alert-danger" style={{ marginBottom: '16px' }}>
              <AlertTriangle size={16} /> {errorFormSolicitud}
            </div>
          )}
          {formularioSolicitud}
        </ModalAdopcion>
      )}

      {/* ============================================================== */}
      {/* MODAL: DETALLE / EXPEDIENTE DE LA SOLICITUD                     */}
      {/* ============================================================== */}
      {modalSolicitud === 'detalle' && (
        <ModalAdopcion
          titulo={editandoSolicitud
            ? `Editar solicitud ${folioSolicitud(detalleData?.solicitud)}`
            : `Detalle de la solicitud ${folioSolicitud(detalleData?.solicitud)}`.trim()}
          subtitulo={editandoSolicitud
            ? 'Actualiza los datos de la persona postulante, el animal elegido o su motivación.'
            : 'Revisa el avance, registra etapas y consulta el historial sin salir del listado.'}
          icono={<FileText size={20} aria-hidden="true" />}
          ancho="xl"
          bloqueado={guardandoSolicitud || guardandoEtapa || eliminando}
          onClose={cerrarModalSolicitud}
        >
          {editandoSolicitud ? (
            <>
              {errorFormSolicitud && (
                <div className="portal-alert portal-alert-danger" style={{ marginBottom: '16px' }}>
                  <AlertTriangle size={16} /> {errorFormSolicitud}
                </div>
              )}
              {formularioSolicitud}
            </>
          ) : (
        <div>
          {detalleCargando ? (
            <div className="portal-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--portal-text-muted)' }}>
              Cargando expediente de la solicitud...
            </div>
          ) : detalleError ? (
            <div className="portal-alert portal-alert-danger">
              <AlertTriangle size={16} /> {detalleError}
            </div>
          ) : !detalleData?.solicitud ? (
            <div className="portal-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--portal-text-muted)' }}>
              No se ha seleccionado ninguna solicitud.
            </div>
          ) : (
            <div>
              {/* Barra superior del expediente */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <span className="adop-folio">{folioSolicitud(detalleData.solicitud)}</span>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {detalleData.solicitud.estado === 'RECIBIDA' && (
                    <>
                      <button
                        type="button"
                        onClick={abrirEditarSolicitud}
                        className="portal-btn portal-btn-secondary"
                        style={{ minHeight: '36px', padding: '6px 14px' }}
                      >
                        <Pencil size={15} /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmarEliminar(true)}
                        className="portal-btn portal-btn-danger"
                        style={{ minHeight: '36px', padding: '6px 14px' }}
                      >
                        <Trash2 size={15} /> Cancelar Solicitud
                      </button>
                    </>
                  )}
                  {detalleData.solicitud.adopcion && !detalleData.solicitud.adopcion.devolucion && (
                    <button
                      type="button"
                      onClick={() => abrirModalDevolucion(
                        detalleData.solicitud.adopcion.id,
                        detalleData.solicitud.animal?.nombre,
                        detalleData.solicitud.datosPostulante?.nombre
                      )}
                      className="portal-btn portal-btn-secondary"
                      style={{ minHeight: '36px', padding: '6px 14px', color: '#d1453b' }}
                    >
                      <RotateCcw size={15} /> Registrar Devolución
                    </button>
                  )}
                </div>
              </div>

              {confirmarEliminar && (
                <div className="portal-alert portal-alert-danger" style={{ marginBottom: '16px' }}>
                  <div style={{ fontWeight: 700, marginBottom: '6px' }}>¿Confirmas cancelar esta solicitud de adopción?</div>
                  <div style={{ fontSize: '0.85rem', marginBottom: '10px' }}>
                    La solicitud pasará a estado Cancelada y quedará registrada en auditoría con todo su historial.
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleEliminarSolicitud}
                      disabled={eliminando}
                      className="portal-btn portal-btn-danger"
                      style={{ minHeight: '32px', padding: '4px 12px' }}
                    >
                      {eliminando ? 'Cancelando...' : 'Sí, confirmar cancelación'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmarEliminar(false)}
                      disabled={eliminando}
                      className="portal-btn portal-btn-secondary"
                      style={{ minHeight: '32px', padding: '4px 12px' }}
                    >
                      Volver
                    </button>
                  </div>
                </div>
              )}

              {/* Tarjeta de Resumen y Línea de Tiempo del Progreso */}
              <div className="portal-card" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>
                      Expediente de Adopción — {detalleData.solicitud.datosPostulante?.nombre || 'Postulante'}
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--portal-text-muted)' }}>
                      Ingresada el {formatearFecha(detalleData.solicitud.creadoEn, true)} por {detalleData.solicitud.registradoPor?.nombre || 'Personal'}
                    </p>
                  </div>
                  {(() => {
                    const est = ESTADOS_SOLICITUD[detalleData.solicitud.estado] || { etiqueta: detalleData.solicitud.estado, bg: '#eee', color: '#555' };
                    return (
                      <span
                        style={{
                          padding: '6px 14px',
                          borderRadius: '999px',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          background: est.bg,
                          color: est.color
                        }}
                      >
                        {est.etiqueta}
                      </span>
                    );
                  })()}
                </div>

                {/* Pasos de progreso estilo caniles */}
                {(() => {
                  const sol = detalleData.solicitud;
                  const cerrada = ['CANCELADA', 'RECHAZADA'].includes(sol.estado);
                  const resEval = resultadoEvaluacionActual(sol);
                  const pasos = [
                    { titulo: 'Recepción', desc: 'Solicitud recibida' },
                    { titulo: 'Evaluación', desc: resEval ? RESULTADOS_EVALUACION[resEval] : 'En revisión' },
                    { titulo: 'Visita Hogar', desc: sol.visitaOmitida ? 'Omitida (fundada)' : 'Condiciones' },
                    { titulo: 'Aprobación', desc: 'Dictamen final' },
                    { titulo: cerrada ? 'Cierre' : 'Adopción', desc: cerrada ? (ESTADOS_SOLICITUD[sol.estado]?.etiqueta || sol.estado) : 'Entrega' }
                  ];

                  const nivel = {
                    RECIBIDA: 0,
                    EN_EVALUACION: resEval === 'CUMPLE' ? (sol.visitaOmitida ? 3 : 2) : 1,
                    VISITA_AGENDADA: 2,
                    VISITA_REALIZADA: 3,
                    APROBADA: 3,
                    ENTREGADA: 4
                  };

                  const actualIndice = cerrada ? 4 : (nivel[sol.estado] ?? 0);

                  return (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                        gap: '10px',
                        background: '#f8fafc',
                        padding: '16px',
                        borderRadius: '10px',
                        border: '1px solid var(--portal-border)',
                        marginBottom: '16px'
                      }}
                    >
                      {pasos.map((paso, idx) => {
                        const esCompletado = idx < actualIndice || (idx === actualIndice && sol.estado === 'ENTREGADA');
                        const esActual = idx === actualIndice;
                        return (
                          <div
                            key={idx}
                            style={{
                              padding: '10px',
                              borderRadius: '8px',
                              background: esCompletado ? '#edf4ee' : esActual ? '#ffffff' : '#f1f5f9',
                              border: `1.5px solid ${esCompletado ? '#bdd1c2' : esActual ? 'var(--portal-primary)' : 'transparent'}`,
                              color: esCompletado ? '#2f5540' : esActual ? 'var(--portal-primary)' : '#64748b'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.82rem' }}>
                              <span
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  background: esCompletado ? 'var(--portal-primary)' : '#cbd5e1',
                                  color: '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.72rem'
                                }}
                              >
                                {esCompletado ? '✓' : idx + 1}
                              </span>
                              {paso.titulo}
                            </div>
                            <div style={{ fontSize: '0.74rem', marginTop: 4, color: 'var(--portal-text-muted)' }}>
                              {paso.desc}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Grid con Postulante y Animal */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '16px' }}>
                  <div style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid var(--portal-border)' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <User size={16} /> Postulante
                    </div>
                    <div style={{ fontSize: '0.86rem', lineHeight: 1.6 }}>
                      <div><strong>Nombre:</strong> {detalleData.solicitud.datosPostulante?.nombre}</div>
                      <div><strong>{detalleData.solicitud.datosPostulante?.tipoIdentificacion === 'RUT' ? 'RUT' : 'Documento'}:</strong> {detalleData.solicitud.datosPostulante?.identificacion}</div>
                      <div><strong>Correo:</strong> {detalleData.solicitud.datosPostulante?.email}</div>
                      <div><strong>Teléfono:</strong> {detalleData.solicitud.datosPostulante?.telefono}</div>
                      <div><strong>Dirección:</strong> {detalleData.solicitud.datosPostulante?.direccion}</div>
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid var(--portal-border)' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Home size={16} /> Animal Solicitado
                    </div>
                    <div style={{ fontSize: '0.86rem', lineHeight: 1.6 }}>
                      <div><strong>Nombre:</strong> {detalleData.solicitud.animal?.nombre}</div>
                      <div><strong>Especie / Raza:</strong> {detalleData.solicitud.animal?.especie} {detalleData.solicitud.animal?.raza ? `· ${detalleData.solicitud.animal.raza}` : ''}</div>
                      <div><strong>Estado del animal:</strong> {detalleData.solicitud.animal?.estadoAdopcion === 'ADOPTADO' ? 'Adoptado' : 'En refugio'}</div>
                      <div style={{ marginTop: 6 }}><strong>Motivación informada:</strong></div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--portal-text-muted)', fontStyle: 'italic', background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                        "{detalleData.solicitud.motivacion}"
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alertas y antecedentes del postulante */}
                {detalleData.antecedentes && (
                  <div style={{ marginTop: '16px' }}>
                    {detalleData.antecedentes.devolucionesPrevias?.length > 0 ? (
                      <div className="portal-alert portal-alert-warning" style={{ fontSize: '0.84rem' }}>
                        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: '6px' }}>
                          <AlertTriangle size={15} /> Esta persona registra {detalleData.antecedentes.devolucionesPrevias.length} devolución(es) previa(s)
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '18px' }}>
                          {detalleData.antecedentes.devolucionesPrevias.map((dev) => (
                            <li key={dev.id}>
                              {dev.fecha ? formatearFecha(dev.fecha) : 'Fecha no registrada'}: {dev.motivo}
                              {dev.estadoAnimal ? ` (Estado del animal: ${dev.estadoAnimal})` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="portal-alert portal-alert-success" style={{ fontSize: '0.83rem' }}>
                        <ShieldCheck size={15} /> Sin devoluciones previas registradas en el historial del postulante.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Registro de Nueva Etapa si está disponible */}
              {opcionesEtapasDisponibles(detalleData.solicitud).length > 0 && (
                <div className="portal-card" style={{ marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 14px', fontSize: '1.05rem', fontWeight: 800 }}>
                    Avanzar Etapa en el Proceso de Adopción
                  </h4>

                  {errorEtapa && (
                    <div className="portal-alert portal-alert-danger" style={{ marginBottom: '14px' }}>
                      <AlertTriangle size={15} /> {errorEtapa}
                    </div>
                  )}

                  <form onSubmit={handleGuardarEtapa}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                          Acción a Registrar
                        </label>
                        <select
                          value={accionEtapa}
                          onChange={(e) => {
                            setAccionEtapa(e.target.value);
                            setFechaEtapa(e.target.value === 'AGENDAR_VISITA' ? '' : ahoraLocal());
                            setErrorEtapa('');
                          }}
                          className="portal-select"
                          style={{ width: '100%' }}
                        >
                          {opcionesEtapasDisponibles(detalleData.solicitud).map(acc => (
                            <option key={acc} value={acc}>{NOMBRES_ETAPAS[acc]}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                          {accionEtapa === 'AGENDAR_VISITA' ? 'Fecha y Hora Agendada' : 'Fecha y Hora de Ejecución'}
                        </label>
                        <input
                          type="datetime-local"
                          step="1"
                          required
                          value={fechaEtapa}
                          onChange={(e) => setFechaEtapa(e.target.value)}
                          className="portal-input"
                          style={{ width: '100%' }}
                        />
                      </div>

                      {accionEtapa === 'EVALUAR' && (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                            Resultado de la Evaluación
                          </label>
                          <select
                            required
                            value={resultadoEvalEtapa}
                            onChange={(e) => setResultadoEvalEtapa(e.target.value)}
                            className="portal-select"
                            style={{ width: '100%' }}
                          >
                            <option value="">Selecciona dictamen</option>
                            {Object.entries(RESULTADOS_EVALUACION).map(([clave, lbl]) => (
                              <option key={clave} value={clave}>{lbl}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {accionEtapa === 'OMITIR_VISITA' && (
                      <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                          Motivo Fundado de Omisión de Visita Previa
                        </label>
                        <textarea
                          required
                          minLength={3}
                          maxLength={2000}
                          rows={2}
                          value={motivoOmisionEtapa}
                          onChange={(e) => setMotivoOmisionEtapa(e.target.value)}
                          placeholder="Indica la justificación formal para omitir la visita domiciliaria..."
                          className="portal-textarea"
                          style={{ width: '100%', resize: 'vertical' }}
                        />
                      </div>
                    )}

                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                        {accionEtapa === 'CANCELAR' ? 'Motivo de Cancelación' : accionEtapa === 'RECHAZAR' ? 'Motivo de Rechazo' : 'Observaciones de la Etapa'}
                      </label>
                      <textarea
                        required
                        minLength={3}
                        maxLength={4000}
                        rows={3}
                        value={observacionesEtapa}
                        onChange={(e) => setObservacionesEtapa(e.target.value)}
                        placeholder="Detalles, hallazgos o acuerdos de esta etapa..."
                        className="portal-textarea"
                        style={{ width: '100%', resize: 'vertical' }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="submit"
                        disabled={guardandoEtapa}
                        className="portal-btn portal-btn-primary"
                      >
                        <CheckCircle2 size={16} /> {guardandoEtapa ? 'Procesando...' : accionEtapa === 'ENTREGAR' ? 'Confirmar Entrega y Adopción' : 'Guardar Etapa'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Historial de Etapas Registradas */}
              <div className="portal-card">
                <h4 style={{ margin: '0 0 14px', fontSize: '1.05rem', fontWeight: 800 }}>
                  Bitácora de Etapas y Acciones Realizadas
                </h4>
                {!detalleData.solicitud.etapas?.length ? (
                  <p style={{ color: 'var(--portal-text-muted)', fontSize: '0.86rem' }}>No hay etapas adicionales registradas aún.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="portal-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--portal-border)' }}>
                          <th style={{ padding: '10px 14px', fontSize: '0.8rem', fontWeight: 800 }}>Acción</th>
                          <th style={{ padding: '10px 14px', fontSize: '0.8rem', fontWeight: 800 }}>Fecha</th>
                          <th style={{ padding: '10px 14px', fontSize: '0.8rem', fontWeight: 800 }}>Responsable</th>
                          <th style={{ padding: '10px 14px', fontSize: '0.8rem', fontWeight: 800 }}>Observaciones / Detalle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalleData.solicitud.etapas.map(etapa => (
                          <tr key={etapa.id} style={{ borderBottom: '1px solid var(--portal-border)' }}>
                            <td style={{ padding: '12px 14px', fontWeight: 700, fontSize: '0.86rem' }}>
                              {NOMBRES_ETAPAS[etapa.accion] || etapa.accion}
                            </td>
                            <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--portal-text-muted)', whiteSpace: 'nowrap' }}>
                              {formatearFecha(etapa.fecha, true)}
                            </td>
                            <td style={{ padding: '12px 14px', fontSize: '0.85rem' }}>
                              {etapa.responsable?.nombre || 'Personal'}
                            </td>
                            <td style={{ padding: '12px 14px', fontSize: '0.85rem' }}>
                              {etapa.resultadoEvaluacion && (
                                <strong style={{ color: 'var(--portal-primary)' }}>
                                  {RESULTADOS_EVALUACION[etapa.resultadoEvaluacion] || etapa.resultadoEvaluacion} ·{' '}
                                </strong>
                              )}
                              {etapa.observaciones}
                              {etapa.motivoOmision && (
                                <div style={{ fontSize: '0.78rem', color: '#b37416', marginTop: 4 }}>
                                  Omisión: {etapa.motivoOmision}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
          )}
        </ModalAdopcion>
      )}

      {/* ============================================================== */}
      {/* MODAL: ACCIÓN DE SEGUIMIENTO (REGISTRAR O REPROGRAMAR)           */}
      {/* ============================================================== */}
      {seguimientoAccionModal && (
        <ModalAdopcion
          titulo={`Gestionar seguimiento · ${seguimientoAccionModal.adopcion?.animal?.nombre || 'animal'}`}
          subtitulo={`${TIPOS_SEGUIMIENTO[seguimientoAccionModal.tipoSeguimiento] || 'Seguimiento'} · ${folioSeguimiento(seguimientoAccionModal)} · Adoptante: ${seguimientoAccionModal.adopcion?.postulante?.nombre || '—'}`}
          icono={<PhoneCall size={20} aria-hidden="true" />}
          ancho="md"
          bloqueado={guardandoSeguimientoAccion}
          onClose={() => setSeguimientoAccionModal(null)}
        >
            {errorSeguimientoAccion && (
              <div className="portal-alert portal-alert-danger" style={{ marginBottom: '14px' }}>
                <AlertTriangle size={15} /> {errorSeguimientoAccion}
              </div>
            )}

            <form onSubmit={handleGuardarAccionSeguimiento}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                    Tipo de Registro
                  </label>
                  <select
                    value={formSeguimiento.accion}
                    onChange={(e) => setFormSeguimiento({ ...formSeguimiento, accion: e.target.value })}
                    className="portal-select"
                    style={{ width: '100%' }}
                  >
                    <option value="REGISTRAR">Contacto Exitoso (Resultado)</option>
                    {seguimientoAccionModal.estado !== 'SIN_CONTACTO' && (
                      <option value="REPROGRAMAR">Intento Fallido y Reprogramar</option>
                    )}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                    Canal de Contacto
                  </label>
                  <select
                    required
                    value={formSeguimiento.canal}
                    onChange={(e) => setFormSeguimiento({ ...formSeguimiento, canal: e.target.value })}
                    className="portal-select"
                    style={{ width: '100%' }}
                  >
                    <option value="">Selecciona canal</option>
                    {Object.entries(CANALES_FORMULARIO).map(([val, lbl]) => (
                      <option key={val} value={val}>{lbl}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                  {formSeguimiento.accion === 'REPROGRAMAR' ? 'Fecha y Hora del Intento' : 'Fecha y Hora del Contacto'}
                </label>
                <input
                  type="datetime-local"
                  step="1"
                  required
                  value={formSeguimiento.fecha}
                  onChange={(e) => setFormSeguimiento({ ...formSeguimiento, fecha: e.target.value })}
                  className="portal-input"
                  style={{ width: '100%' }}
                />
              </div>

              {formSeguimiento.accion === 'REPROGRAMAR' ? (
                <>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                      Nueva Fecha y Hora Programada
                    </label>
                    <input
                      type="datetime-local"
                      step="1"
                      required
                      value={formSeguimiento.fechaReprogramada}
                      onChange={(e) => setFormSeguimiento({ ...formSeguimiento, fechaReprogramada: e.target.value })}
                      className="portal-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                      Motivo del Intento Fallido
                    </label>
                    <input
                      maxLength={100}
                      value={formSeguimiento.resultado}
                      onChange={(e) => setFormSeguimiento({ ...formSeguimiento, resultado: e.target.value })}
                      placeholder="Ej: No contesta teléfono, buzón de voz..."
                      className="portal-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                      Estado del Animal (Salud, adaptación, peso, ánimo)
                    </label>
                    <textarea
                      required
                      minLength={3}
                      maxLength={4000}
                      rows={3}
                      value={formSeguimiento.estadoAnimal}
                      onChange={(e) => setFormSeguimiento({ ...formSeguimiento, estadoAnimal: e.target.value })}
                      placeholder="Indica las condiciones físicas y emocionales observadas..."
                      className="portal-textarea"
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                      Resultado del Seguimiento
                    </label>
                    <input
                      required
                      minLength={3}
                      maxLength={100}
                      value={formSeguimiento.resultado}
                      onChange={(e) => setFormSeguimiento({ ...formSeguimiento, resultado: e.target.value })}
                      placeholder="Ej: Favorable, excelente adaptación, requiere visita presencial..."
                      className="portal-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                </>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                  {formSeguimiento.accion === 'REPROGRAMAR' ? 'Observaciones del intento fallido *' : 'Observaciones adicionales (opcional)'}
                </label>
                <textarea
                  required={formSeguimiento.accion === 'REPROGRAMAR'}
                  minLength={formSeguimiento.accion === 'REPROGRAMAR' ? 3 : undefined}
                  maxLength={4000}
                  rows={2}
                  value={formSeguimiento.observaciones}
                  onChange={(e) => setFormSeguimiento({ ...formSeguimiento, observaciones: e.target.value })}
                  placeholder={formSeguimiento.accion === 'REPROGRAMAR' ? 'Cuenta brevemente qué ocurrió al intentar contactar (mínimo 3 caracteres)...' : 'Detalles adicionales...'}
                  className="portal-textarea"
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setSeguimientoAccionModal(null)}
                  className="portal-btn portal-btn-secondary"
                  disabled={guardandoSeguimientoAccion}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoSeguimientoAccion}
                  className="portal-btn portal-btn-primary"
                >
                  {guardandoSeguimientoAccion ? 'Guardando...' : formSeguimiento.accion === 'REPROGRAMAR' ? 'Reprogramar Intento' : 'Registrar Resultado'}
                </button>
              </div>
            </form>
        </ModalAdopcion>
      )}

      {/* ============================================================== */}
      {/* MODAL: REGISTRAR DEVOLUCIÓN                                     */}
      {/* ============================================================== */}
      {modalDevolucion && (
        <ModalAdopcion
          titulo="Registrar devolución de adopción"
          subtitulo={`${modalDevolucion.animalNombre || 'El animal'} · Adoptante: ${modalDevolucion.postulanteNombre || '—'}`}
          icono={<RotateCcw size={20} aria-hidden="true" />}
          tono="#d1453b"
          ancho="md"
          bloqueado={guardandoDevolucion}
          onClose={() => setModalDevolucion(null)}
        >
            {exitoDevolucion ? (
              <div>
                <div className="portal-alert portal-alert-success" style={{ marginBottom: '16px' }}>
                  <CheckCircle2 size={16} /> Devolución procesada. El animal <strong>{modalDevolucion.animalNombre}</strong> ha reingresado formalmente al refugio con su historial íntegro.
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setModalDevolucion(null)}
                    className="portal-btn portal-btn-primary"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleGuardarDevolucion}>
                <div className="portal-alert portal-alert-warning" style={{ fontSize: '0.84rem', marginBottom: '16px' }}>
                  Al registrar la devolución, el animal retornará a estado «En refugio» y quedará constancia en los antecedentes del adoptante ({modalDevolucion.postulanteNombre}).
                </div>

                {errorDevolucion && (
                  <div className="portal-alert portal-alert-danger" style={{ marginBottom: '14px' }}>
                    <AlertTriangle size={15} /> {errorDevolucion}
                  </div>
                )}

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                    Fecha y Hora del Reingreso / Devolución
                  </label>
                  <input
                    type="datetime-local"
                    step="1"
                    required
                    value={formDevolucion.fecha}
                    onChange={(e) => setFormDevolucion({ ...formDevolucion, fecha: e.target.value })}
                    className="portal-input"
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                    Motivo de la Devolución (Mínimo 5 caracteres)
                  </label>
                  <textarea
                    required
                    minLength={5}
                    maxLength={4000}
                    rows={3}
                    value={formDevolucion.motivo}
                    onChange={(e) => setFormDevolucion({ ...formDevolucion, motivo: e.target.value })}
                    placeholder="Explica la causa reportada por el adoptante o detectada en el seguimiento..."
                    className="portal-textarea"
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                    Estado del Animal al Reingreso (Salud, peso, conducta)
                  </label>
                  <textarea
                    required
                    minLength={3}
                    maxLength={4000}
                    rows={3}
                    value={formDevolucion.estadoAnimal}
                    onChange={(e) => setFormDevolucion({ ...formDevolucion, estadoAnimal: e.target.value })}
                    placeholder="Condiciones en las que el animal llega de vuelta..."
                    className="portal-textarea"
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '6px' }}>
                    Observaciones sobre el Postulante (Opcional)
                  </label>
                  <textarea
                    maxLength={4000}
                    rows={2}
                    value={formDevolucion.observacionesPostulante}
                    onChange={(e) => setFormDevolucion({ ...formDevolucion, observacionesPostulante: e.target.value })}
                    placeholder="Anotaciones para antecedentes del adoptante..."
                    className="portal-textarea"
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setModalDevolucion(null)}
                    className="portal-btn portal-btn-secondary"
                    disabled={guardandoDevolucion}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardandoDevolucion}
                    className="portal-btn portal-btn-danger"
                  >
                    {guardandoDevolucion ? 'Procesando...' : 'Confirmar Devolución y Reingreso'}
                  </button>
                </div>
              </form>
            )}
        </ModalAdopcion>
      )}
    </div>
  );
}
