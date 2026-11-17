import React, { useState, useEffect } from 'react';
import {
  Bell,
  ClipboardList,
  DoorOpen,
  Map,
  MapPin,
  PawPrint,
  Plus,
  Send,
  ShieldCheck,
  Siren,
  Trash2,
  TriangleAlert,
  X
} from 'lucide-react';
import { API_URL, getAuthHeaders } from '../api/config';
import AnimalSelect from './ui/AnimalSelect';

const ETIQUETAS_TIPO_TRASLADO = {
  INTERNO_CANIL: 'Movimiento interno entre caniles',
  PROTECTORA_ALIADA: 'Traslado a protectora aliada',
  HOGAR_TEMPORAL: 'Traslado a hogar temporal'
};

const ESTADOS_TRASLADO = {
  COMPLETADO: { etiqueta: 'Completado', bg: '#e8f0e8', color: '#2f5540' },
  APROBADO: { etiqueta: 'Aprobado', bg: '#e8f0e8', color: '#2f5540' },
  PENDIENTE_APROBACION: { etiqueta: 'Pendiente de aprobación', bg: '#faf1de', color: '#b37416' },
  RECHAZADO: { etiqueta: 'Rechazado', bg: '#fbeae8', color: '#d1453b' }
};

const ESTADOS_CANIL = {
  LIBRE: { etiqueta: 'Libre', bg: '#e8f0e8', color: '#2f5540' },
  OCUPADO: { etiqueta: 'Ocupado', bg: '#faf1de', color: '#b37416' },
  CUARENTENA: { etiqueta: 'Cuarentena', bg: '#fbeae8', color: '#d1453b' },
  MANTENIMIENTO: { etiqueta: 'Mantenimiento', bg: '#eef2f7', color: '#4b5b70' }
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

export default function CanilesModulo({ user }) {
  const [caniles, setCaniles] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [animales, setAnimales] = useState([]);
  const [traslados, setTraslados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState('mapa'); // 'mapa' | 'traslados' | 'solicitar'
  const [filtroEstado, setFiltroEstado] = useState('TODOS'); // 'TODOS' | 'LIBRE' | 'OCUPADO' | 'CUARENTENA'
  const [filtroSector, setFiltroSector] = useState('TODOS');
  const [avisosOpen, setAvisosOpen] = useState(false);

  // Formulario Agregar Canil
  const [agregarCanilOpen, setAgregarCanilOpen] = useState(false);
  const [nuevoCanil, setNuevoCanil] = useState({ sector: '' });
  const [sectorMode, setSectorMode] = useState('select'); // 'select' | 'nuevo'
  const [errorNuevoCanil, setErrorNuevoCanil] = useState(null);
  const [creandoCanil, setCreandoCanil] = useState(false);

  // Confirmación Eliminar Canil
  const [eliminarCanil, setEliminarCanil] = useState(null);
  const [eliminarConfirmOpen, setEliminarConfirmOpen] = useState(false);
  const [eliminandoCanil, setEliminandoCanil] = useState(false);

  // Modal de Gestión de Canil
  const [modalCanilOpen, setModalCanilOpen] = useState(false);
  const [selectedCanil, setSelectedCanil] = useState(null);
  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [enCuarentena, setEnCuarentena] = useState(false);
  const [motivoMovimiento, setMotivoMovimiento] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState(null);
  const [mensajeExito, setMensajeExito] = useState(null);
  const [sectorEdicion, setSectorEdicion] = useState('');
  const [sectorModo, setSectorModo] = useState('select'); // 'select' | 'nuevo'

  // Formulario Solicitud de Traslado Externo (Protectora o Hogar Temporal)
  const [trasladoExterno, setTrasladoExterno] = useState({
    animalId: '',
    tipo: 'PROTECTORA_ALIADA',
    destinoNombre: '',
    destinoContacto: '',
    destinoDireccion: '',
    motivo: ''
  });
  const [errorExterno, setErrorExterno] = useState(null);

  // Detalle y aprobación de traslados
  const [detalleTraslado, setDetalleTraslado] = useState(null);
  const [comentarioAprobacion, setComentarioAprobacion] = useState('');
  const [errorAprobacion, setErrorAprobacion] = useState(null);
  const [procesandoAprobacion, setProcesandoAprobacion] = useState(false);

  // Sectores ya registrados (se derivan de los caniles existentes, por lo que
  // quedan guardados en la base de datos al crear cada canil).
  const sectoresExistentes = React.useMemo(
    () => [...new Set(caniles.map(c => c.sector).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [caniles]
  );

  // Próximo número de canil a partir del mayor "Canil N" existente.
  const getProximoNumeroCanil = () => {
    const numeros = caniles
      .map(c => {
        const match = String(c.nombre || '').match(/(\d+)\s*$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);
    return (numeros.length ? Math.max(...numeros) : caniles.length) + 1;
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Si el sector filtrado deja de existir (por ejemplo, al cambiarlo de sector),
  // volvemos automáticamente a "Todos" para no dejar la vista vacía.
  useEffect(() => {
    if (filtroSector !== 'TODOS' && !sectoresExistentes.includes(filtroSector)) {
      setFiltroSector('TODOS');
    }
  }, [filtroSector, sectoresExistentes]);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [resCaniles, resAnimals, resTraslados] = await Promise.all([
        fetch(`${API_URL}/caniles`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/animals`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/caniles/traslados`, { headers: getAuthHeaders() })
      ]);

      if (resCaniles.ok) {
        const dataCaniles = await resCaniles.json();
        setCaniles(dataCaniles.caniles || []);
        setResumen(dataCaniles.resumen || null);
      }
      if (resAnimals.ok) {
        const dataAnimals = await resAnimals.json();
        setAnimales(dataAnimals || []);
      }
      if (resTraslados.ok) {
        const dataT = await resTraslados.json();
        setTraslados(dataT || []);
      }
    } catch (err) {
      console.error('Error al cargar datos de caniles:', err);
    } finally {
      setCargando(false);
    }
  };

  const handleOpenModal = (canil) => {
    const animalActualId = canil.animalAlojado ? canil.animalAlojado.id.toString() : '';
    setSelectedCanil(canil);
    setSelectedAnimalId(animalActualId);
    setEnCuarentena(canil.estado === 'CUARENTENA');
    setMotivoMovimiento('');
    setErrorModal(null);
    setSectorEdicion(canil.sector || '');
    setSectorModo(canil.sector ? 'select' : 'nuevo');
    setModalCanilOpen(true);
  };

  const handleGuardarGestionCanil = async (e) => {
    e.preventDefault();
    setErrorModal(null);

    if (!selectedCanil) return;

    const animalActualId = selectedCanil.animalAlojado ? selectedCanil.animalAlojado.id.toString() : '';
    const animalSeleccionado = selectedAnimalId || '';
    const estadoActual = selectedCanil.estado;
    const estadoDeseado = animalSeleccionado ? (enCuarentena ? 'CUARENTENA' : 'OCUPADO') : 'LIBRE';
    const cambiaAnimal = animalSeleccionado !== animalActualId;
    const cambiaCuarentena = Boolean(animalSeleccionado) && ((estadoActual === 'CUARENTENA') !== enCuarentena);
    const debeActualizarOcupacion = cambiaAnimal || cambiaCuarentena;
    const sectorLimpio = sectorEdicion.trim();
    const cambiaSector = sectorLimpio !== (selectedCanil.sector || '');

    if (!sectorLimpio) {
      setErrorModal('Selecciona un sector existente o escribe uno nuevo');
      return;
    }
    if (!debeActualizarOcupacion && !cambiaSector) {
      setErrorModal('No hay cambios para guardar');
      return;
    }
    if (cambiaAnimal && animalActualId && animalSeleccionado) {
      setErrorModal('Este canil ya tiene un animal. Libéralo antes de asignar otro.');
      return;
    }
    if (
      debeActualizarOcupacion &&
      animalSeleccionado &&
      enCuarentena &&
      (cambiaAnimal || estadoActual !== 'CUARENTENA') &&
      !motivoMovimiento.trim()
    ) {
      setErrorModal('El motivo es obligatorio para poner el canil en cuarentena');
      return;
    }

    setGuardando(true);
    const mensajes = [];

    try {
      if (debeActualizarOcupacion) {
        const res = await fetch(`${API_URL}/caniles/asignar`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            canilId: selectedCanil.id,
            animalId: animalSeleccionado ? parseInt(animalSeleccionado) : null,
            motivo: motivoMovimiento.trim() || null,
            estado: estadoDeseado
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al actualizar la ocupación del canil');
        mensajes.push(data.mensaje);
      }

      if (cambiaSector) {
        const res = await fetch(`${API_URL}/caniles/${selectedCanil.id}/sector`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ sector: sectorLimpio })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al actualizar el sector');
        mensajes.push(data.mensaje);
      }

      setMensajeExito(mensajes.filter(Boolean).join(' · ') || 'Canil actualizado correctamente');
      setTimeout(() => setMensajeExito(null), 4000);
      setModalCanilOpen(false);
      await cargarDatos();
    } catch (err) {
      setErrorModal(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleSolicitarExterno = async (e) => {
    e.preventDefault();
    setErrorExterno(null);

    if (!trasladoExterno.animalId) {
      setErrorExterno('Debes seleccionar un animal');
      return;
    }
    if (!trasladoExterno.motivo.trim()) {
      setErrorExterno('El motivo del traslado es obligatorio');
      return;
    }
    if (!trasladoExterno.destinoNombre.trim()) {
      setErrorExterno('Indica la protectora aliada u hogar de acogida');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/caniles/traslados`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...trasladoExterno,
          animalId: parseInt(trasladoExterno.animalId)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al solicitar traslado');

      setMensajeExito('Traslado registrado. Notificado a Directora para aprobación.');
      setTimeout(() => setMensajeExito(null), 4000);
      setTrasladoExterno({
        animalId: '',
        tipo: 'PROTECTORA_ALIADA',
        destinoNombre: '',
        destinoContacto: '',
        destinoDireccion: '',
        motivo: ''
      });
      setTab('traslados');
      await cargarDatos();
    } catch (err) {
      setErrorExterno(err.message);
    }
  };

  const handleOpenAgregarCanil = () => {
    // Preferir el sector del último canil creado; si no hay, el primero disponible.
    const ultimoCanil = [...caniles].sort((a, b) => b.id - a.id)[0];
    const sectorPorDefecto = ultimoCanil?.sector || sectoresExistentes[0] || '';
    setNuevoCanil({ sector: sectorPorDefecto });
    setSectorMode(sectorPorDefecto ? 'select' : 'nuevo');
    setErrorNuevoCanil(null);
    setAgregarCanilOpen(true);
  };

  const handleCrearCanil = async (e) => {
    e.preventDefault();
    setErrorNuevoCanil(null);

    if (!nuevoCanil.sector.trim()) {
      setErrorNuevoCanil('Selecciona un sector existente o escribe uno nuevo');
      return;
    }

    // Nombre y código automáticos: "Canil 12", "Canil 13", ...
    const numero = getProximoNumeroCanil();
    const nombre = `Canil ${numero}`;
    let codigo = `C-${String(numero).padStart(2, '0')}`;
    const codigosExistentes = new Set(caniles.map(c => c.codigo));
    let sufijo = 0;
    while (codigosExistentes.has(codigo)) {
      sufijo += 1;
      codigo = `C-${String(numero).padStart(2, '0')}-${sufijo}`;
    }

    setCreandoCanil(true);
    try {
      const res = await fetch(`${API_URL}/caniles`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          codigo,
          nombre,
          sector: nuevoCanil.sector.trim(),
          capacidad: 1,
          estado: 'LIBRE'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear canil');

      setMensajeExito(data.message || 'Canil creado con éxito');
      setTimeout(() => setMensajeExito(null), 4000);
      setAgregarCanilOpen(false);
      setNuevoCanil({ sector: '' });
      setSectorMode('select');
      setErrorNuevoCanil(null);
      await cargarDatos();
    } catch (err) {
      setErrorNuevoCanil(err.message);
    } finally {
      setCreandoCanil(false);
    }
  };

  const handleConfirmarEliminarCanil = async () => {
    if (!eliminarCanil) return;
    setEliminandoCanil(true);
    try {
      const res = await fetch(`${API_URL}/caniles/${eliminarCanil.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar canil');

      setMensajeExito(data.mensaje || 'Canil eliminado correctamente');
      setTimeout(() => setMensajeExito(null), 4000);
      setEliminarConfirmOpen(false);
      setEliminarCanil(null);
      await cargarDatos();
    } catch (err) {
      alert(err.message);
    } finally {
      setEliminandoCanil(false);
    }
  };

  const handleGestionarAprobacion = async (trasladoId, aprobar, comentario = '') => {
    setErrorAprobacion(null);
    const comentarioLimpio = comentario.trim();

    if (!aprobar && !comentarioLimpio) {
      setErrorAprobacion('Debes indicar el motivo del rechazo.');
      return;
    }

    setProcesandoAprobacion(true);
    try {
      const res = await fetch(`${API_URL}/caniles/traslados/${trasladoId}/aprobacion`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ aprobar, comentario: comentarioLimpio || null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar aprobación');

      setMensajeExito(data.message || (aprobar ? 'Traslado aprobado correctamente' : 'Traslado rechazado'));
      setTimeout(() => setMensajeExito(null), 4000);
      setDetalleTraslado(null);
      setComentarioAprobacion('');
      setErrorAprobacion(null);
      await cargarDatos();
    } catch (err) {
      setErrorAprobacion(err.message);
    } finally {
      setProcesandoAprobacion(false);
    }
  };

  const esDirectora = user?.rol === 'DIRECTORA';

  const trasladosPendientes = traslados.filter(t => t.estado === 'PENDIENTE_APROBACION');
  const avisosCaniles = [
    ...(resumen?.alertaSobrecupo
      ? [{
          tipo: 'CRITICA',
          titulo: 'Sobrecupo crítico en caniles',
          mensaje: `La ocupación alcanzó el ${resumen.porcentajeOcupacion}%. Solo quedan ${resumen.libres} caniles libres.`,
          tab: 'mapa'
        }]
      : []),
    ...(resumen && !resumen.alertaSobrecupo && resumen.libres === 0
      ? [{
          tipo: 'ALERTA',
          titulo: 'Sin caniles libres',
          mensaje: 'No hay espacios disponibles para alojar o reubicar animales.',
          tab: 'mapa'
        }]
      : []),
    ...(esDirectora && trasladosPendientes.length > 0
      ? [{
          tipo: 'ALERTA',
          titulo: 'Traslados pendientes de aprobación',
          mensaje: `${trasladosPendientes.length} solicitud(es) esperan la revisión de la Directora.`,
          tab: 'traslados'
        }]
      : [])
  ];

  const canilesDelSector = filtroSector === 'TODOS'
    ? caniles
    : caniles.filter(c => c.sector === filtroSector);
  const contarCanilesPorEstado = (estado) => canilesDelSector.filter(c => c.estado === estado).length;
  const filtrosCaniles = [
    { valor: 'TODOS', etiqueta: 'Todos', cantidad: canilesDelSector.length },
    { valor: 'LIBRE', etiqueta: 'Libres', cantidad: contarCanilesPorEstado('LIBRE') },
    { valor: 'OCUPADO', etiqueta: 'Ocupados', cantidad: contarCanilesPorEstado('OCUPADO') },
    { valor: 'CUARENTENA', etiqueta: 'Cuarentena', cantidad: contarCanilesPorEstado('CUARENTENA') }
  ];
  const canilesFiltrados = filtroEstado === 'TODOS'
    ? canilesDelSector
    : canilesDelSector.filter(c => c.estado === filtroEstado);

  const abrirDetalleTraslado = (traslado) => {
    setDetalleTraslado(traslado);
    setComentarioAprobacion('');
    setErrorAprobacion(null);
  };

  const cerrarDetalleTraslado = () => {
    setDetalleTraslado(null);
    setComentarioAprobacion('');
    setErrorAprobacion(null);
  };

  const detalleEstadoInfo = detalleTraslado
    ? (ESTADOS_TRASLADO[detalleTraslado.estado] || {
        etiqueta: detalleTraslado.estado.replace('_', ' '),
        bg: '#e9eaed',
        color: '#7c8592'
      })
    : null;
  const detalleEsInterno = detalleTraslado?.tipo === 'INTERNO_CANIL';
  const detalleOrigen = detalleTraslado
    ? (detalleTraslado.canilOrigen?.nombre || (detalleEsInterno ? 'Ingreso al refugio' : 'Refugio Huellas Sin Hogar'))
    : '';
  const detalleDestino = detalleTraslado
    ? (detalleEsInterno ? (detalleTraslado.canilDestino?.nombre || '—') : (detalleTraslado.destinoNombre || '—'))
    : '';
  const puedeAprobarTraslado = esDirectora && detalleTraslado?.estado === 'PENDIENTE_APROBACION';
  const estadoCanilSeleccionado = selectedCanil
    ? (ESTADOS_CANIL[selectedCanil.estado] || {
        etiqueta: String(selectedCanil.estado || 'Sin estado').replace('_', ' '),
        bg: '#e9eaed',
        color: '#7c8592'
      })
    : null;
  const animalActualModalId = selectedCanil?.animalAlojado ? selectedCanil.animalAlojado.id.toString() : '';
  const animalDistintoEnCanilOcupado = Boolean(selectedCanil?.animalAlojado) &&
    Boolean(selectedAnimalId) &&
    selectedAnimalId !== animalActualModalId;
  const cambiaOcupacionModal = selectedAnimalId !== animalActualModalId ||
    (Boolean(selectedAnimalId) && ((selectedCanil?.estado === 'CUARENTENA') !== enCuarentena));
  const motivoCuarentenaRequerido = Boolean(selectedAnimalId) &&
    enCuarentena &&
    (selectedAnimalId !== animalActualModalId || selectedCanil?.estado !== 'CUARENTENA');
  const mostrarMotivoModal = Boolean(selectedAnimalId) && (cambiaOcupacionModal || enCuarentena);
  const hayCambiosModal = Boolean(selectedCanil) && (
    selectedAnimalId !== animalActualModalId ||
    (Boolean(selectedAnimalId) && ((selectedCanil.estado === 'CUARENTENA') !== enCuarentena)) ||
    sectorEdicion.trim() !== (selectedCanil.sector || '')
  );

  return (
    <div className="portal-page-container" style={{ paddingTop: 0 }}>
      {/* ENCABEZADO Y SUBPESTAÑAS STICKY */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 60,
          background: '#f3f4f6',
          paddingTop: 'clamp(16px, 2vw, 24px)',
          paddingBottom: '16px',
          marginBottom: '8px',
        }}
      >
      <div className="portal-header" style={{ marginBottom: '16px' }}>
        <div>
          <h2 className="portal-header-title">
            <DoorOpen size={26} aria-hidden="true" />
            <span>Módulo de Caniles y Traslados</span>
          </h2>
          <p className="portal-header-subtitle">
            Mapa visual de espacios, reubicaciones internas y traslados a protectoras / hogares temporales
          </p>
        </div>

        <div className="portal-header-actions">
          {/* Botón Agregar Canil */}
          <button
            type="button"
            onClick={handleOpenAgregarCanil}
            className="portal-btn portal-btn-primary"
          >
            <Plus size={16} aria-hidden="true" /> Agregar Canil
          </button>

          {/* Campanita de avisos, estilo dashboard */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setAvisosOpen(v => !v)}
              aria-label="Avisos de caniles"
              aria-expanded={avisosOpen}
              title="Avisos de caniles"
              style={{
                position: 'relative',
                background: avisosOpen ? '#eef3ec' : '#fff',
                border: `1.5px solid ${avisosOpen ? '#3f6c52' : '#e9eaed'}`,
                borderRadius: '8px',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <Bell size={20} aria-hidden="true" />
              {avisosCaniles.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  minWidth: '18px',
                  height: '18px',
                  padding: '0 4px',
                  borderRadius: '9px',
                  background: '#d1453b',
                  color: '#fff',
                  fontSize: '0.68rem',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box'
                }}>
                  {avisosCaniles.length}
                </span>
              )}
            </button>

            {avisosOpen && (
              <>
                <div
                  onClick={() => setAvisosOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 400 }}
                />
                <div style={{
                  position: 'absolute',
                  top: '48px',
                  right: 0,
                  width: 'min(380px, calc(100vw - 48px))',
                  background: '#fff',
                  border: '1px solid #e9eaed',
                  borderRadius: '14px',
                  boxShadow: '0 12px 32px rgba(20,24,32,0.14)',
                  zIndex: 401,
                  overflow: 'hidden'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 16px',
                    borderBottom: '1px solid #f0f1f3'
                  }}>
                    <span style={{
                      fontSize: '0.78rem',
                      fontWeight: '800',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      color: '#1f2430'
                    }}>
                      Avisos de Caniles
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#7c8592', fontWeight: '600' }}>
                      {avisosCaniles.length} activo(s)
                    </span>
                  </div>

                  <div style={{ maxHeight: '340px', overflowY: 'auto', padding: '10px' }}>
                    {avisosCaniles.length === 0 ? (
                      <div style={{ padding: '18px 12px', textAlign: 'center', color: '#7c8592', fontSize: '0.84rem' }}>
                        <ShieldCheck size={22} aria-hidden="true" style={{ marginBottom: '6px' }} />
                        <div>No hay avisos de caniles en este momento.</div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {avisosCaniles.map((aviso, idx) => {
                          const esCritica = aviso.tipo === 'CRITICA';
                          const Icono = esCritica ? Siren : TriangleAlert;
                          const color = esCritica ? '#d1453b' : '#b37416';
                          const bg = esCritica ? '#fbeae8' : '#faf1de';

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setAvisosOpen(false);
                                setTab(aviso.tab);
                              }}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                background: bg,
                                border: 'none',
                                borderLeft: `4px solid ${color}`,
                                borderRadius: '9px',
                                padding: '12px 14px',
                                cursor: 'pointer',
                                display: 'block',
                                minHeight: 0
                              }}
                            >
                              <span style={{
                                color,
                                fontSize: '0.86rem',
                                fontWeight: '800',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                marginBottom: '3px'
                              }}>
                                <Icono size={14} aria-hidden="true" /> {aviso.titulo}
                              </span>
                              <span style={{ fontSize: '0.78rem', color: '#555e6d', lineHeight: 1.35, display: 'block' }}>
                                {aviso.mensaje}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Pestañas Subnavegación */}
      <div className="portal-subtabs" style={{ marginBottom: 0 }}>
        <button
          onClick={() => setTab('mapa')}
          className={`portal-subtab-btn ${tab === 'mapa' ? 'active' : ''}`}
        >
          <Map size={15} aria-hidden="true" /> Mapa de Caniles
        </button>
        <button
          onClick={() => setTab('traslados')}
          className={`portal-subtab-btn ${tab === 'traslados' ? 'active' : ''}`}
        >
          <ClipboardList size={15} aria-hidden="true" /> Bitácora de Traslados
        </button>
        <button
          onClick={() => setTab('solicitar')}
          className={`portal-subtab-btn ${tab === 'solicitar' ? 'active' : ''}`}
        >
          <Send size={15} aria-hidden="true" /> Solicitar Traslado Externo
        </button>
      </div>
      </div>


      {mensajeExito && (
        <div className="portal-alert portal-alert-success" style={{ marginBottom: '18px', fontWeight: '600' }}>
          ✓ {mensajeExito}
        </div>
      )}

      {/* MODAL AGREGAR CANIL */}
      {agregarCanilOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-agregar-canil"
          onClick={(e) => { if (e.target === e.currentTarget) setAgregarCanilOpen(false); }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(20,24,32,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px'
          }}
        >
          <div style={{
            background: '#fff', borderRadius: '18px', padding: '26px', width: '100%', maxWidth: '640px',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 12px 36px rgba(20,24,32,0.2)',
            boxSizing: 'border-box'
          }}>
            <h3 id="titulo-agregar-canil" style={{ margin: '0 0 8px', color: '#1f2430', display: 'flex', alignItems: 'center', gap: '7px' }}><Plus size={19} aria-hidden="true" /> Agregar Nuevo Canil</h3>
          <p style={{ color: '#7c8592', fontSize: '0.84rem', margin: '0 0 18px' }}>
            Completa los datos del nuevo canil. Quedará disponible como LIBRE para asignar animales.
          </p>

          {errorNuevoCanil && (
            <div style={{ background: '#fbeae8', color: '#d1453b', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.82rem' }}>
              {errorNuevoCanil}
            </div>
          )}

          <form onSubmit={handleCrearCanil}>
            {/* Nombre y capacidad automáticos */}
            <div style={{
              background: '#f8f9fa', border: '1px solid #e9eaed', borderRadius: '10px',
              padding: '12px 14px', marginBottom: '14px', fontSize: '0.84rem', color: '#555e6d'
            }}>
              Se creará <strong>Canil {getProximoNumeroCanil()}</strong> · Capacidad: <strong>1 animal</strong>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                Sector *
              </label>
              <select
                value={sectorMode === 'nuevo' ? '__nuevo__' : nuevoCanil.sector}
                onChange={e => {
                  if (e.target.value === '__nuevo__') {
                    setSectorMode('nuevo');
                    setNuevoCanil({ sector: '' });
                  } else {
                    setSectorMode('select');
                    setNuevoCanil({ sector: e.target.value });
                  }
                }}
                style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed' }}
              >
                <option value="__nuevo__">— Crear un nuevo sector —</option>
                {sectoresExistentes.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {sectorMode === 'nuevo' && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                  Nuevo sector *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Patio Principal"
                  value={nuevoCanil.sector}
                  onChange={e => setNuevoCanil({ sector: e.target.value })}
                  style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed', boxSizing: 'border-box' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setAgregarCanilOpen(false)}
                style={{ padding: '9px 16px', background: 'transparent', border: '1.5px solid #e9eaed', borderRadius: '8px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={creandoCanil}
                style={{ padding: '9px 20px', background: '#3f6c52', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
              >
                {creandoCanil ? 'Creando...' : 'Crear Canil'}
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* CONTENIDO SEGÚN TAB */}
      {tab === 'mapa' && (
        <div>
          {/* KPI CARDS RESUMEN */}
          {resumen && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
              <div style={{ background: '#fff', borderRadius: '14px', padding: '16px 20px', border: '1px solid #e9eaed' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#7c8592', textTransform: 'uppercase' }}>Caniles Libres</span>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#3f6c52', marginTop: '4px' }}>{resumen.libres}</div>
                <span style={{ fontSize: '0.78rem', color: '#7c8592' }}>Disponibles para ingreso</span>
              </div>
              <div style={{ background: '#fff', borderRadius: '14px', padding: '16px 20px', border: '1px solid #e9eaed' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#7c8592', textTransform: 'uppercase' }}>Caniles Ocupados</span>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#b37416', marginTop: '4px' }}>{resumen.ocupados}</div>
                <span style={{ fontSize: '0.78rem', color: '#7c8592' }}>Con animal alojado</span>
              </div>
              <div style={{ background: '#fff', borderRadius: '14px', padding: '16px 20px', border: '1px solid #e9eaed' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#7c8592', textTransform: 'uppercase' }}>En Cuarentena</span>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#d1453b', marginTop: '4px' }}>{resumen.cuarentena}</div>
                <span style={{ fontSize: '0.78rem', color: '#7c8592' }}>Observación médica</span>
              </div>
              <div style={{ background: '#fff', borderRadius: '14px', padding: '16px 20px', border: '1px solid #e9eaed' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#7c8592', textTransform: 'uppercase' }}>Ocupación Total</span>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: resumen.alertaSobrecupo ? '#d1453b' : '#1f2430', marginTop: '4px' }}>
                  {resumen.porcentajeOcupacion}%
                </div>
                <span style={{ fontSize: '0.78rem', color: resumen.alertaSobrecupo ? '#d1453b' : '#7c8592' }}>
                  {resumen.alertaSobrecupo ? <><TriangleAlert size={13} aria-hidden="true" /> &gt; 90% (Sobrecupo)</> : 'Operación normal'}
                </span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.9rem', color: '#7c8592', fontWeight: '600' }}>
              Haz clic en cualquier canil para reubicar, asignar o liberar un animal.
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', background: '#e8f0e8', color: '#2f5540', padding: '4px 10px', borderRadius: '6px', fontWeight: '700' }}>● LIBRE</span>
              <span style={{ fontSize: '0.75rem', background: '#faf1de', color: '#b37416', padding: '4px 10px', borderRadius: '6px', fontWeight: '700' }}>● OCUPADO</span>
              <span style={{ fontSize: '0.75rem', background: '#fbeae8', color: '#d1453b', padding: '4px 10px', borderRadius: '6px', fontWeight: '700' }}>● CUARENTENA</span>
            </div>
          </div>

          {/* FILTROS POR ESTADO Y SECTOR */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {filtrosCaniles.map(filtro => {
                const activo = filtroEstado === filtro.valor;
                return (
                  <button
                    key={filtro.valor}
                    type="button"
                    onClick={() => setFiltroEstado(filtro.valor)}
                    aria-pressed={activo}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '9999px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      transition: 'all 0.18s',
                      border: activo ? '1.5px solid #3f6c52' : '1.5px solid #e9eaed',
                      background: activo ? '#3f6c52' : '#fff',
                      color: activo ? '#fff' : '#555e6d',
                      minHeight: '36px'
                    }}
                  >
                    {filtro.etiqueta} <span style={{ opacity: activo ? 0.85 : 0.6 }}>({filtro.cantidad})</span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label
                htmlFor="filtro-sector-caniles"
                style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592' }}
              >
                <MapPin size={14} aria-hidden="true" /> Sector
              </label>
              <select
                id="filtro-sector-caniles"
                value={filtroSector}
                onChange={e => setFiltroSector(e.target.value)}
                style={{
                  padding: '7px 30px 7px 10px',
                  borderRadius: '8px',
                  border: '1.5px solid #e9eaed',
                  background: '#fff',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  color: '#555e6d',
                  minHeight: '36px',
                  cursor: 'pointer'
                }}
              >
                <option value="TODOS">Todos los sectores ({caniles.length})</option>
                {sectoresExistentes.map(sector => (
                  <option key={sector} value={sector}>{sector}</option>
                ))}
              </select>
            </div>
          </div>

          {canilesFiltrados.length === 0 ? (
            <div style={{
              background: '#fff', borderRadius: '14px', border: '1px dashed #d8dde4', padding: '32px 20px',
              textAlign: 'center', color: '#7c8592', fontSize: '0.88rem'
            }}>
              No hay caniles que coincidan con el filtro seleccionado.
            </div>
          ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '16px'
          }}>
            {canilesFiltrados.map(canil => {
              const ocupado = canil.estado === 'OCUPADO';
              const libre = canil.estado === 'LIBRE';

              const borderColor = libre ? '#3f6c52' : ocupado ? '#d99a3d' : '#d1453b';
              const badgeBg = libre ? '#e8f0e8' : ocupado ? '#faf1de' : '#fbeae8';
              const badgeColor = libre ? '#2f5540' : ocupado ? '#b37416' : '#d1453b';

              return (
                <div
                  key={canil.id}
                  onClick={() => handleOpenModal(canil)}
                  style={{
                    background: '#fff',
                    borderRadius: '14px',
                    border: '1px solid #e9eaed',
                    borderTop: `4px solid ${borderColor}`,
                    padding: '16px',
                    boxShadow: '0 2px 8px rgba(20,24,32,0.04)',
                    cursor: 'pointer',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    position: 'relative'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(20,24,32,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(20,24,32,0.04)'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <strong style={{ fontSize: '0.98rem', color: '#1f2430' }}>{canil.nombre}</strong>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: '800', background: badgeBg, color: badgeColor,
                      padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase'
                    }}>
                      {canil.estado}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: '#7c8592', marginBottom: '10px' }}>
                    Sector: <strong>{canil.sector}</strong>
                  </div>

                  {canil.animalAlojado ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8f9fa', padding: '10px', borderRadius: '10px' }}>
                      <div style={{
                        width: '42px', height: '42px', borderRadius: '8px', background: '#e9eaed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0
                      }}>
                        {canil.animalAlojado.fotoUrl ? (
                          <img src={canil.animalAlojado.fotoUrl} alt={canil.animalAlojado.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <PawPrint size={20} color="#7c8592" aria-hidden="true" />
                        )}
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: '800', fontSize: '0.88rem', color: '#1f2430', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {canil.animalAlojado.nombre}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#7c8592' }}>
                          {canil.animalAlojado.especie} · {canil.animalAlojado.sexo} · {canil.animalAlojado.estadoSalud}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px', color: '#a3aab5',
                      fontSize: '0.82rem', padding: '14px 10px', background: '#fafbfc', borderRadius: '10px'
                    }}>
                      <DoorOpen size={16} aria-hidden="true" /> Canil disponible (Capacidad libre)
                    </div>
                  )}

                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* TAB BITÁCORA DE TRASLADOS */}
      {tab === 'traslados' && (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e9eaed', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', color: '#1f2430' }}>Historial y Estado de Traslados</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: '1.5px solid #e9eaed', textAlign: 'left', color: '#7c8592' }}>
                  <th style={{ padding: '10px' }}>Fecha</th>
                  <th style={{ padding: '10px' }}>Animal</th>
                  <th style={{ padding: '10px' }}>Tipo</th>
                  <th style={{ padding: '10px' }}>Origen / Destino</th>
                  <th style={{ padding: '10px' }}>Responsable</th>
                  <th style={{ padding: '10px' }}>Estado</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {traslados.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#a3aab5' }}>
                      No se registran movimientos ni traslados aún
                    </td>
                  </tr>
                ) : (
                  traslados.map(t => {
                    const estadoInfo = ESTADOS_TRASLADO[t.estado] || {
                      etiqueta: t.estado.replace('_', ' '),
                      bg: '#e9eaed',
                      color: '#7c8592'
                    };

                    return (
                      <tr
                        key={t.id}
                        onClick={() => abrirDetalleTraslado(t)}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f8faf8'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        style={{ borderBottom: '1px solid #f0f1f3', cursor: 'pointer' }}
                      >
                        <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                          {formatearFecha(t.fechaRegistro)}
                        </td>
                        <td style={{ padding: '10px', fontWeight: '700' }}>{t.animal?.nombre || '—'}</td>
                        <td style={{ padding: '10px' }}>{t.tipo.replace('_', ' ')}</td>
                        <td style={{ padding: '10px' }}>
                          {t.tipo === 'INTERNO_CANIL' ? (
                            <span>{t.canilOrigen?.nombre || 'Ingreso'} → {t.canilDestino?.nombre || '—'}</span>
                          ) : (
                            <span><strong>{t.destinoNombre || '—'}</strong> {t.destinoContacto ? `(${t.destinoContacto})` : ''}</span>
                          )}
                        </td>
                        <td style={{ padding: '10px' }}>{t.responsable?.nombre || '—'}</td>
                        <td style={{ padding: '10px' }}>
                          <span style={{
                            fontSize: '0.72rem', fontWeight: '700', padding: '3px 8px', borderRadius: '6px',
                            background: estadoInfo.bg, color: estadoInfo.color
                          }}>
                            {estadoInfo.etiqueta}
                          </span>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirDetalleTraslado(t);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#3f6c52',
                              fontWeight: '700',
                              fontSize: '0.76rem',
                              cursor: 'pointer',
                              padding: '4px 2px',
                              minHeight: 0
                            }}
                          >
                            {esDirectora && t.estado === 'PENDIENTE_APROBACION' ? 'Revisar' : 'Ver detalle'} →
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB SOLICITAR TRASLADO EXTERNO */}
      {tab === 'solicitar' && (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e9eaed', padding: '26px', maxWidth: '640px', margin: '0 auto' }}>
          <h3 style={{ margin: '0 0 8px', color: '#1f2430' }}>Solicitar Traslado Externo</h3>
          <p style={{ color: '#7c8592', fontSize: '0.84rem', margin: '0 0 18px' }}>
            Para traslados hacia protectoras aliadas u hogares temporales. Requiere aprobación obligatoria por la Directora.
          </p>

          {errorExterno && (
            <div style={{ background: '#fbeae8', color: '#d1453b', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.82rem' }}>
              {errorExterno}
            </div>
          )}

          <form onSubmit={handleSolicitarExterno}>
            <div style={{ marginBottom: '12px' }}>
              <label htmlFor="traslado-externo-animal" style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                Animal a Trasladar *
              </label>
              <AnimalSelect
                id="traslado-externo-animal"
                animales={animales}
                value={trasladoExterno.animalId}
                onChange={(animalId) => setTrasladoExterno(prev => ({ ...prev, animalId }))}
                placeholder="— Seleccionar animal —"
                searchPlaceholder="Buscar por nombre, especie o canil..."
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                Tipo de Destino *
              </label>
              <select
                value={trasladoExterno.tipo}
                onChange={e => setTrasladoExterno({ ...trasladoExterno, tipo: e.target.value })}
                style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed' }}
              >
                <option value="PROTECTORA_ALIADA">Protectora Aliada</option>
                <option value="HOGAR_TEMPORAL">Hogar Temporal (Acogida)</option>
              </select>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                Nombre de la Protectora o Encargado del Hogar *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Fundación Patitas Felices / Familia Morales"
                value={trasladoExterno.destinoNombre}
                onChange={e => setTrasladoExterno({ ...trasladoExterno, destinoNombre: e.target.value })}
                style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                  Teléfono / Contacto
                </label>
                <input
                  type="text"
                  placeholder="+56 9 ..."
                  value={trasladoExterno.destinoContacto}
                  onChange={e => setTrasladoExterno({ ...trasladoExterno, destinoContacto: e.target.value })}
                  style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                  Dirección
                </label>
                <input
                  type="text"
                  placeholder="Comuna, calle..."
                  value={trasladoExterno.destinoDireccion}
                  onChange={e => setTrasladoExterno({ ...trasladoExterno, destinoDireccion: e.target.value })}
                  style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                Motivo del Traslado (Obligatorio) *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Ej: Sobrecupo temporal / Necesidad de socialización en hogar / Tratamiento especializado en protectora"
                value={trasladoExterno.motivo}
                onChange={e => setTrasladoExterno({ ...trasladoExterno, motivo: e.target.value })}
                style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setTab('mapa')}
                style={{ padding: '9px 16px', background: 'transparent', border: '1.5px solid #e9eaed', borderRadius: '8px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{ padding: '9px 20px', background: '#3f6c52', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
              >
                Registrar Solicitud
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DETALLE DE TRASLADO */}
      {detalleTraslado && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-detalle-traslado"
          onClick={(e) => { if (e.target === e.currentTarget) cerrarDetalleTraslado(); }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(20,24,32,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '16px'
          }}
        >
          <div style={{
            background: '#fff', borderRadius: '18px', padding: '26px', width: '100%', maxWidth: '720px',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 12px 36px rgba(20,24,32,0.2)',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '18px' }}>
              <div>
                <h3 id="titulo-detalle-traslado" style={{ margin: '0 0 4px', color: '#1f2430', display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <ClipboardList size={19} aria-hidden="true" /> Detalle del traslado
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#7c8592' }}>
                  Solicitud de traslado
                </p>
              </div>
              <span style={{
                fontSize: '0.74rem', fontWeight: '800', padding: '6px 10px', borderRadius: '8px',
                background: detalleEstadoInfo.bg, color: detalleEstadoInfo.color, whiteSpace: 'nowrap'
              }}>
                {detalleEstadoInfo.etiqueta}
              </span>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px', background: '#f8f9fa',
              borderRadius: '12px', padding: '12px', marginBottom: '18px'
            }}>
              <div style={{
                width: '54px', height: '54px', borderRadius: '10px', background: '#e9eaed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0
              }}>
                {detalleTraslado.animal?.fotoUrl ? (
                  <img
                    src={detalleTraslado.animal.fotoUrl}
                    alt={detalleTraslado.animal.nombre}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <PawPrint size={26} color="#7c8592" aria-hidden="true" />
                )}
              </div>
              <div>
                <div style={{ fontWeight: '800', fontSize: '1rem', color: '#1f2430' }}>
                  {detalleTraslado.animal?.nombre || 'Animal'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#7c8592', marginTop: '2px' }}>
                  {[detalleTraslado.animal?.especie, detalleTraslado.animal?.sexo, detalleTraslado.animal?.estadoSalud]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px', marginBottom: '18px'
            }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: '#7c8592', textTransform: 'uppercase' }}>
                  Fecha de registro
                </span>
                <div style={{ fontSize: '0.86rem', color: '#1f2430', marginTop: '3px' }}>
                  {formatearFecha(detalleTraslado.fechaRegistro, true)}
                </div>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: '#7c8592', textTransform: 'uppercase' }}>
                  Tipo de traslado
                </span>
                <div style={{ fontSize: '0.86rem', color: '#1f2430', marginTop: '3px' }}>
                  {ETIQUETAS_TIPO_TRASLADO[detalleTraslado.tipo] || detalleTraslado.tipo.replace(/_/g, ' ')}
                </div>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: '#7c8592', textTransform: 'uppercase' }}>
                  Responsable
                </span>
                <div style={{ fontSize: '0.86rem', color: '#1f2430', marginTop: '3px' }}>
                  {detalleTraslado.responsable?.nombre || '—'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#7c8592' }}>
                  {detalleTraslado.responsable?.rol || ''}
                </div>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: '#7c8592', textTransform: 'uppercase' }}>
                  Estado
                </span>
                <div style={{ fontSize: '0.86rem', color: '#1f2430', marginTop: '3px' }}>
                  {detalleEstadoInfo.etiqueta}
                </div>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: '#7c8592', textTransform: 'uppercase' }}>
                  Origen
                </span>
                <div style={{ fontSize: '0.86rem', color: '#1f2430', marginTop: '3px' }}>
                  {detalleOrigen}
                </div>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: '#7c8592', textTransform: 'uppercase' }}>
                  Destino
                </span>
                <div style={{ fontSize: '0.86rem', color: '#1f2430', marginTop: '3px' }}>
                  {detalleDestino}
                </div>
              </div>
            </div>

            {!detalleEsInterno && (detalleTraslado.destinoContacto || detalleTraslado.destinoDireccion) && (
              <div style={{
                background: '#f8f9fa', borderRadius: '10px', padding: '12px 14px',
                marginBottom: '18px', fontSize: '0.82rem', color: '#555e6d'
              }}>
                <strong style={{ display: 'block', marginBottom: '4px', color: '#1f2430' }}>Datos del destino externo</strong>
                {detalleTraslado.destinoContacto && <div>Contacto: {detalleTraslado.destinoContacto}</div>}
                {detalleTraslado.destinoDireccion && <div>Dirección: {detalleTraslado.destinoDireccion}</div>}
              </div>
            )}

            <div style={{ marginBottom: '18px' }}>
              <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: '#7c8592', textTransform: 'uppercase', marginBottom: '6px' }}>
                Motivo del traslado
              </span>
              <div style={{
                background: '#fff', border: '1px solid #e9eaed', borderRadius: '10px',
                padding: '12px 14px', fontSize: '0.86rem', color: '#1f2430',
                whiteSpace: 'pre-wrap', lineHeight: 1.5
              }}>
                {detalleTraslado.motivo || 'Sin motivo registrado.'}
              </div>
            </div>

            <div style={{ background: '#f8f9fa', borderRadius: '12px', padding: '16px', marginBottom: '18px' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#1f2430', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={16} aria-hidden="true" /> Aprobación de la Directora
              </h4>

              {detalleTraslado.estado === 'PENDIENTE_APROBACION' ? (
                puedeAprobarTraslado ? (
                  <>
                    <p style={{ margin: '0 0 10px', fontSize: '0.82rem', color: '#7c8592' }}>
                      Revisa la solicitud y registra tu decisión.
                    </p>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                      Comentario o motivo de rechazo
                    </label>
                    <textarea
                      rows={3}
                      value={comentarioAprobacion}
                      onChange={e => setComentarioAprobacion(e.target.value)}
                      disabled={procesandoAprobacion}
                      placeholder="Opcional para aprobar. Obligatorio para rechazar."
                      style={{
                        width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed',
                        boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit'
                      }}
                    />
                    <div style={{ fontSize: '0.72rem', color: '#7c8592', marginTop: '5px' }}>
                      El comentario es obligatorio solo si rechazas la solicitud.
                    </div>
                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.84rem', color: '#7c8592' }}>
                    Esta solicitud está pendiente de revisión por la Directora.
                  </p>
                )
              ) : detalleTraslado.aprobadoPor ? (
                <div style={{ fontSize: '0.84rem', color: '#1f2430' }}>
                  <div>
                    <strong>{detalleTraslado.estado === 'RECHAZADO' ? 'Rechazado por' : 'Aprobado por'}:</strong>{' '}
                    {detalleTraslado.aprobadoPor.nombre}
                  </div>
                  <div style={{ color: '#7c8592', marginTop: '3px' }}>
                    {formatearFecha(detalleTraslado.fechaAprobacion, true)}
                  </div>
                  {detalleTraslado.comentarioAprobacion && (
                    <div style={{ marginTop: '8px' }}>
                      <strong>Comentario:</strong> {detalleTraslado.comentarioAprobacion}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.84rem', color: '#7c8592' }}>
                  Movimiento interno registrado automáticamente. No requiere aprobación.
                </p>
              )}
            </div>

            {errorAprobacion && (
              <div style={{
                background: '#fbeae8', color: '#d1453b', padding: '10px 14px',
                borderRadius: '8px', marginBottom: '14px', fontSize: '0.82rem'
              }}>
                {errorAprobacion}
              </div>
            )}

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: '10px', flexWrap: 'wrap', paddingTop: '16px', borderTop: '1px solid #f0f1f3'
            }}>
              <button
                type="button"
                onClick={cerrarDetalleTraslado}
                style={{
                  padding: '9px 16px', background: 'transparent', border: '1.5px solid #e9eaed',
                  borderRadius: '8px', cursor: 'pointer', fontWeight: '600'
                }}
              >
                Cerrar
              </button>

              {puedeAprobarTraslado && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={procesandoAprobacion}
                    onClick={() => handleGestionarAprobacion(detalleTraslado.id, false, comentarioAprobacion)}
                    style={{
                      padding: '9px 16px', background: '#fbeae8', border: '1px solid #f3c9c4',
                      color: '#d1453b', borderRadius: '8px', fontWeight: '700',
                      cursor: procesandoAprobacion ? 'not-allowed' : 'pointer',
                      opacity: procesandoAprobacion ? 0.65 : 1
                    }}
                  >
                    {procesandoAprobacion ? 'Procesando...' : 'Rechazar solicitud'}
                  </button>
                  <button
                    type="button"
                    disabled={procesandoAprobacion}
                    onClick={() => handleGestionarAprobacion(detalleTraslado.id, true, comentarioAprobacion)}
                    style={{
                      padding: '9px 20px', background: '#3f6c52', border: 'none',
                      color: '#fff', borderRadius: '8px', fontWeight: '700',
                      cursor: procesandoAprobacion ? 'not-allowed' : 'pointer',
                      opacity: procesandoAprobacion ? 0.65 : 1
                    }}
                  >
                    {procesandoAprobacion ? 'Procesando...' : 'Aprobar traslado'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL ASIGNAR / REUBICAR CANIL */}
      {modalCanilOpen && selectedCanil && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-gestion-canil"
          onClick={(e) => { if (e.target === e.currentTarget) setModalCanilOpen(false); }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(20,24,32,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px'
          }}
        >
          <div className="canil-modal">
            <div className="canil-modal-header">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0 }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '11px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#eef3ec', color: '#3f6c52'
                }}>
                  <DoorOpen size={22} aria-hidden="true" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <span style={{
                    display: 'block', fontSize: '0.68rem', fontWeight: '800',
                    letterSpacing: '0.07em', textTransform: 'uppercase', color: '#94a3b8'
                  }}>
                    Gestión de canil
                  </span>
                  <h3 id="titulo-gestion-canil" style={{
                    margin: '2px 0 8px', color: '#1f2430', fontSize: '1.3rem', lineHeight: 1.2
                  }}>
                    {selectedCanil.nombre}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '4px 9px', borderRadius: '9999px',
                      background: estadoCanilSeleccionado.bg, color: estadoCanilSeleccionado.color,
                      fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase'
                    }}>
                      {estadoCanilSeleccionado.etiqueta}
                    </span>
                    <span className="canil-modal-chip">
                      <MapPin size={12} aria-hidden="true" /> {selectedCanil.sector || 'Sin sector'}
                    </span>
                    <span className="canil-modal-chip">
                      Capacidad: {selectedCanil.capacidad} animal
                    </span>
                    {selectedCanil.animalAlojado && (
                      <span className="canil-modal-chip" style={{ color: '#3f6c52', borderColor: '#dbe7df' }}>
                        <PawPrint size={12} aria-hidden="true" /> {selectedCanil.animalAlojado.nombre}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalCanilOpen(false)}
                aria-label="Cerrar gestión de canil"
                title="Cerrar"
                style={{
                  width: '34px', height: '34px', minHeight: 0, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#f8f9fa', border: '1px solid #e9eaed', borderRadius: '8px',
                  color: '#64748b', cursor: 'pointer'
                }}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>

            <div className="canil-modal-body">
              <form onSubmit={handleGuardarGestionCanil}>
                {errorModal && (
                  <div style={{ background: '#fbeae8', color: '#d1453b', padding: '10px 12px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.82rem' }}>
                    {errorModal}
                  </div>
                )}

                <div style={{ marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <label htmlFor="canil-animal-alojado" style={{ fontSize: '0.78rem', fontWeight: '700', color: '#7c8592' }}>
                      Animal en el canil
                    </label>
                    {selectedCanil.animalAlojado && selectedAnimalId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAnimalId('');
                          setEnCuarentena(false);
                        }}
                        style={{
                          padding: 0, minHeight: 0, background: 'transparent', border: 'none',
                          color: '#d1453b', fontSize: '0.74rem', fontWeight: '700', cursor: 'pointer'
                        }}
                      >
                        Liberar canil
                      </button>
                    )}
                  </div>

                  <AnimalSelect
                    id="canil-animal-alojado"
                    animales={animales}
                    value={selectedAnimalId}
                    onChange={(animalId) => {
                      setSelectedAnimalId(animalId);
                      if (!animalId) setEnCuarentena(false);
                    }}
                    placeholder="— Ninguno (Dejar canil LIBRE) —"
                    allowClear
                    clearLabel="Ninguno (Dejar canil LIBRE)"
                    searchPlaceholder="Buscar por nombre, especie o canil..."
                  />

                  <p style={{ margin: '7px 0 0', fontSize: '0.74rem', color: '#8a94a3', lineHeight: 1.4 }}>
                    Para mover un animal a otro canil, ábrelo desde el canil de destino y selecciónalo aquí.
                  </p>

                  {animalDistintoEnCanilOcupado && (
                    <div style={{
                      marginTop: '8px', padding: '8px 10px', borderRadius: '7px',
                      background: '#faf1de', color: '#b37416', fontSize: '0.75rem'
                    }}>
                      Este canil ya tiene un animal. Libéralo antes de asignar otro.
                    </div>
                  )}
                </div>

                {selectedAnimalId && (
                  <label style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                    padding: '11px 14px', borderRadius: '10px', marginBottom: '16px', cursor: 'pointer',
                    background: enCuarentena ? '#fdf2f2' : '#f8f9fa',
                    border: `1.5px solid ${enCuarentena ? '#f3c9c4' : '#e9eaed'}`
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                      <TriangleAlert size={17} color={enCuarentena ? '#d1453b' : '#7c8592'} aria-hidden="true" />
                      <span>
                        <strong style={{ display: 'block', fontSize: '0.82rem', color: '#1f2430' }}>En cuarentena</strong>
                        <small style={{ fontSize: '0.72rem', color: '#7c8592' }}>Activa la observación médica de este animal.</small>
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={enCuarentena}
                      onChange={e => setEnCuarentena(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: '#d1453b', cursor: 'pointer', flexShrink: 0 }}
                    />
                  </label>
                )}

                {mostrarMotivoModal && (
                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                      {motivoCuarentenaRequerido ? 'Motivo de cuarentena *' : 'Motivo del movimiento (opcional)'}
                    </label>
                    <textarea
                      rows={motivoCuarentenaRequerido ? 3 : 2}
                      required={motivoCuarentenaRequerido}
                      placeholder={motivoCuarentenaRequerido ? 'Indica el motivo de la cuarentena' : 'Ej: ingreso, reubicación, sobrecupo'}
                      value={motivoMovimiento}
                      onChange={e => setMotivoMovimiento(e.target.value)}
                      style={{
                        width: '100%', padding: '9px', borderRadius: '8px', boxSizing: 'border-box',
                        border: `1.5px solid ${motivoCuarentenaRequerido ? '#d1453b' : '#e9eaed'}`
                      }}
                    />
                  </div>
                )}

                <div style={{ marginBottom: '18px' }}>
                  <label htmlFor="editar-sector-canil" style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                    Sector del canil *
                  </label>
                  <select
                    id="editar-sector-canil"
                    value={sectorModo === 'nuevo' ? '__nuevo__' : sectorEdicion}
                    onChange={e => {
                      if (e.target.value === '__nuevo__') {
                        setSectorModo('nuevo');
                        setSectorEdicion('');
                      } else {
                        setSectorModo('select');
                        setSectorEdicion(e.target.value);
                      }
                    }}
                    style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed' }}
                  >
                    <option value="__nuevo__">— Crear un nuevo sector —</option>
                    {sectoresExistentes.map(sector => (
                      <option key={sector} value={sector}>{sector}</option>
                    ))}
                  </select>

                  {sectorModo === 'nuevo' && (
                    <input
                      type="text"
                      required
                      maxLength={100}
                      placeholder="Nombre del nuevo sector"
                      value={sectorEdicion}
                      onChange={e => setSectorEdicion(e.target.value)}
                      style={{
                        width: '100%', padding: '9px', borderRadius: '8px', marginTop: '8px',
                        border: '1.5px solid #e9eaed', boxSizing: 'border-box'
                      }}
                    />
                  )}
                </div>

                <div style={{
                  background: '#f8f9fa', padding: '10px 14px', borderRadius: '8px',
                  fontSize: '0.78rem', color: '#7c8592'
                }}>
                  Responsable: <strong>{user?.nombre}</strong> ({user?.rol})
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setModalCanilOpen(false)}
                    style={{ padding: '9px 16px', background: 'transparent', border: '1.5px solid #e9eaed', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardando || !hayCambiosModal}
                    style={{
                      padding: '9px 20px', background: '#3f6c52', color: '#fff', border: 'none',
                      borderRadius: '8px', fontWeight: '700',
                      cursor: guardando || !hayCambiosModal ? 'not-allowed' : 'pointer',
                      opacity: guardando || !hayCambiosModal ? 0.6 : 1
                    }}
                  >
                    {guardando ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
            </div>

            <div className="canil-modal-footer">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '30px', height: '30px', borderRadius: '8px',
                  background: selectedCanil.estado === 'LIBRE' ? '#fbeae8' : '#f1f3f5',
                  color: selectedCanil.estado === 'LIBRE' ? '#d1453b' : '#94a3b8',
                  flexShrink: 0
                }}>
                  <TriangleAlert size={15} aria-hidden="true" />
                </span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong style={{ fontSize: '0.78rem', color: '#555e6d' }}>Zona de peligro</strong>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    {selectedCanil.estado === 'LIBRE'
                      ? 'Este canil está libre y puede eliminarse.'
                      : 'Solo se pueden eliminar caniles que estén LIBRES.'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={selectedCanil.estado !== 'LIBRE'}
                  onClick={() => {
                    setModalCanilOpen(false);
                    setEliminarCanil(selectedCanil);
                    setEliminarConfirmOpen(true);
                  }}
                  style={{
                    padding: '8px 14px',
                    background: selectedCanil.estado !== 'LIBRE' ? '#e9eaed' : '#fbeae8',
                    border: `1px solid ${selectedCanil.estado !== 'LIBRE' ? '#e9eaed' : '#f3c9c4'}`,
                    borderRadius: '8px',
                    color: selectedCanil.estado !== 'LIBRE' ? '#a3aab5' : '#d1453b',
                    fontSize: '0.78rem', fontWeight: '700',
                    cursor: selectedCanil.estado !== 'LIBRE' ? 'not-allowed' : 'pointer',
                    opacity: selectedCanil.estado !== 'LIBRE' ? 0.6 : 1
                  }}
                >
                  <Trash2 size={14} aria-hidden="true" /> Eliminar canil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN ELIMINAR CANIL */}
      {eliminarConfirmOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(20,24,32,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '16px'
        }}>
          <div style={{
            background: '#fff', borderRadius: '18px', padding: '26px', width: '100%', maxWidth: '480px',
            boxShadow: '0 12px 36px rgba(20,24,32,0.2)'
          }}>
            <h3 style={{ margin: '0 0 6px', color: '#d1453b', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Trash2 size={20} aria-hidden="true" /> Eliminar Canil
            </h3>
            <p style={{ color: '#7c8592', fontSize: '0.88rem', margin: '0 0 18px' }}>
              ¿Estás seguro de que deseas eliminar este canil? Esta acción no se puede deshacer.
            </p>
            <div style={{ background: '#fafbfc', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.86rem', color: '#555e6d' }}>
              <strong>Canil a eliminar:</strong> {eliminarCanil?.nombre || ''}
            </div>
            {eliminandoCanil && (
              <div style={{ textAlign: 'center', color: '#7c8592', fontSize: '0.84rem' }}>Eliminando...</div>
            )}
            {!eliminandoCanil && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={() => setEliminarConfirmOpen(false)}
                  style={{ padding: '9px 16px', background: 'transparent', border: '1.5px solid #e9eaed', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmarEliminarCanil}
                  style={{ padding: '9px 20px', background: '#d1453b', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Eliminar Canil
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
