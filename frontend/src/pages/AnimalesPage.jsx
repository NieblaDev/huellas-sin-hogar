import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Input from '../components/ui/Input.jsx';
import Modal from '../components/ui/Modal.jsx';
import { usePortalFeedback } from '../context/PortalFeedback.jsx';
import AnimalPhoto from '../components/AnimalPhoto';
import { formatearErrorApi } from '../utils/errores';
import React, { useState, useEffect } from 'react';
import {
  Archive,
  ArrowUpDown,
  Bell,
  Calendar,
  ClipboardList,
  Dog,
  DoorOpen,
  FileSpreadsheet,
  FileText,
  Lock,
  Mail,
  PawPrint,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Stethoscope,
  Trash2
} from 'lucide-react';
import { eliminarAnimal, exportarFicha, listarAnimales, listarNotificaciones, obtenerAnimal } from '../services/animal.service.js';

const formatearFechaIngreso = (valor) => {
  if (!valor) return 'Sin fecha';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return 'Sin fecha';
  return fecha.toLocaleDateString('es-CL');
};

export default function AnimalesPage({ onOpenModal, onEditAnimal, reloadKey }) {
  const { avisar, confirmar } = usePortalFeedback();
  const [animales, setAnimales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [search, setSearch] = useState('');
  const [especie, setEspecie] = useState('');
  const [estadoSalud, setEstadoSalud] = useState('');
  const [estadoRegistro, setEstadoRegistro] = useState('ACTIVOS'); // 'ACTIVOS' | 'BAJA' | 'TODOS'
  const [ordenFecha, setOrdenFecha] = useState('desc'); // 'desc' | 'asc'

  // Notificaciones del personal del refugio
  const [notificaciones, setNotificaciones] = useState([]);
  const [notificacionesOpen, setNotificacionesOpen] = useState(false);
  const [avisoReciente, setAvisoReciente] = useState(null);

  // Modal de Ficha del Animal y Exportación de Expediente
  const [fichaSeleccionada, setFichaSeleccionada] = useState(null);
  const [cargandoFicha, setCargandoFicha] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(false);
  const [descargandoId, setDescargandoId] = useState(null);

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  })();

  const rolUsuario = currentUser?.rol || 'VOLUNTARIO_NOVATO';
  const esDireccion = rolUsuario === 'DIRECCION';
  const puedeExportarExpediente = ['DIRECCION', 'PERSONAL_VETERINARIO', 'PERSONAL_ADOPCIONES'].includes(rolUsuario);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => fetchAnimals(controller.signal), 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, especie, estadoSalud, estadoRegistro, ordenFecha, reloadKey]);

  useEffect(() => {
    fetchNotificaciones();
    if (fichaSeleccionada?.id) {
      abrirFichaAnimal(fichaSeleccionada.id, true);
    }
  }, [reloadKey]);

  // Cierra la foto ampliada si se cierra la ficha o con la tecla Escape
  useEffect(() => {
    if (!fichaSeleccionada) setFotoAmpliada(false);
  }, [fichaSeleccionada]);

  useEffect(() => {
    if (!fotoAmpliada) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') setFotoAmpliada(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fotoAmpliada]);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail) {
        setAvisoReciente(e.detail.mensaje || e.detail.titulo);
        fetchNotificaciones();
        setTimeout(() => setAvisoReciente(null), 6500);
      }
    };
    window.addEventListener('refugio:notificacion', handler);
    return () => window.removeEventListener('refugio:notificacion', handler);
  }, []);

  const fetchAnimals = async (signal) => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (especie) params.append('especie', especie);
      if (estadoSalud) params.append('estadoSalud', estadoSalud);
      if (estadoRegistro && estadoRegistro !== 'ACTIVOS') params.append('estado', estadoRegistro);
      if (ordenFecha) params.append('ordenFecha', ordenFecha);

      const res = await listarAnimales(params, signal);
      const data = await res.json();
      if (signal?.aborted) return;
      setAnimales(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!signal?.aborted) console.error(err);
    } finally {
      if (!signal?.aborted) setCargando(false);
    }
  };

  const fetchNotificaciones = async () => {
    try {
      const res = await listarNotificaciones(10);
      if (res.ok) {
        const data = await res.json();
        setNotificaciones(data.notificaciones || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const abrirFichaAnimal = async (animalId, silencioso = false) => {
    if (!silencioso) setCargandoFicha(true);
    try {
      const res = await obtenerAnimal(animalId);
      const data = await res.json();
      if (!res.ok) throw new Error(formatearErrorApi(data, 'Error al cargar la ficha del animal'));
      setFichaSeleccionada(data);
    } catch (err) {
      if (!silencioso) avisar(formatearErrorApi(err), 'error');
    } finally {
      if (!silencioso) setCargandoFicha(false);
    }
  };

  const abrirEdicionFicha = (animal, e) => {
    if (e) e.stopPropagation();
    if (onEditAnimal) {
      onEditAnimal(animal);
    } else if (onOpenModal) {
      onOpenModal(animal);
    }
  };

  const handleExportExpediente = async (animal, formato = 'PDF', e) => {
    if (e) e.stopPropagation();
    if (!puedeExportarExpediente) {
      avisar('La descarga de fichas está disponible solo para el personal del refugio y la Dirección.', 'error');
      return;
    }

    setDescargandoId(`${animal.id}-${formato}`);
    try {
      const res = await exportarFicha(animal.id, formato);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(formatearErrorApi(errData, `No pudimos generar la ficha en ${formato}. Inténtalo nuevamente.`));
      }

      const notifHeader = res.headers.get('X-Notification-Message');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = (animal.nombre || 'animal').toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const ext = formato.toLowerCase() === 'csv' ? 'csv' : 'pdf';
      link.download = `ficha_animal_${safeName}.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      const msgNotif = notifHeader
        ? decodeURIComponent(notifHeader)
        : `La ficha de ${animal.nombre} (${formato}) se descargó correctamente.`;
      setAvisoReciente(msgNotif);
      setTimeout(() => setAvisoReciente(null), 6500);
      fetchNotificaciones();
    } catch (err) {
      avisar(formatearErrorApi(err), 'error');
    } finally {
      setDescargandoId(null);
    }
  };

  const handleDelete = async (id, nombre, e) => {
    if (e) e.stopPropagation();
    if (!await confirmar({
      titulo: 'Dar de baja al animal',
      mensaje: `La ficha de ${nombre} dejará de mostrarse en el catálogo. Su historial se conservará.`,
      accion: 'Dar de baja',
      peligro: true
    })) return;

    try {
      const res = await eliminarAnimal(id);
      if (!res.ok) throw new Error('No pudimos dar de baja al animal. Inténtalo nuevamente.');

      if (estadoRegistro === 'ACTIVOS') {
        setAnimales((prev) => prev.filter((a) => a.id !== id));
      } else {
        fetchAnimals();
      }
      if (fichaSeleccionada?.id === id) {
        setFichaSeleccionada(null);
      }
    } catch (err) {
      avisar(formatearErrorApi(err), 'error');
    }
  };

  const hayFiltrosActivos =
    search.trim() !== '' ||
    especie !== '' ||
    estadoSalud !== '' ||
    estadoRegistro !== 'ACTIVOS' ||
    ordenFecha !== 'desc';

  const restablecerFiltros = () => {
    setSearch('');
    setEspecie('');
    setEstadoSalud('');
    setEstadoRegistro('ACTIVOS');
    setOrdenFecha('desc');
  };

  const badgeMap = {
    NORMAL: { bg: '#e8f0e8', color: '#2f5540', label: 'Normal' },
    CONDICION_ESPECIAL: { bg: 'var(--portal-warning-bg)', color: 'var(--portal-warning-text)', label: 'Condición especial' },
    CRITICO: { bg: '#fbeae8', color: '#d1453b', label: 'Crítico' }
  };

  const limpiarNotaCausal = (nota) => (nota || '').replace(/^\[Ingreso por (Rescate|Abandono|Decomiso)\]\s*/i, '');

  const mensajeVacio =
    estadoRegistro === 'BAJA'
      ? 'No se encontraron animales dados de baja con los filtros aplicados.'
      : estadoRegistro === 'TODOS'
      ? 'No se encontraron animales ingresados con los filtros aplicados.'
      : 'No se encontraron animales ingresados activos con los filtros aplicados.';

  return (
    <div
      className="portal-page-container"
      style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* ENCABEZADO Y ACCIONES DE REGISTRO */}
      <div className="portal-header" style={{ flexShrink: 0, marginBottom: '18px' }}>
        <div>
          <h2 className="portal-header-title">
            <Dog size={26} aria-hidden="true" />
            <span>Animales Ingresados</span>
            <span className="portal-badge portal-badge-neutral" style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              {animales.length}
            </span>
          </h2>
          <p className="portal-header-subtitle">
            Registra los ingresos de perros y gatos del refugio, consulta sus fichas detalladas y gestiona su estado.
          </p>
        </div>

        <div className="portal-header-actions">
          {/* Botón Registrar Ingreso Animal */}
          <Button
            type="button"
            onClick={() => onOpenModal && onOpenModal(null)}
            className="portal-btn portal-btn-primary"
          >
            <Plus size={16} aria-hidden="true" /> Registrar ingreso de animal
          </Button>

          {/* Campanita de novedades y notificaciones */}
          <div style={{ position: 'relative' }}>
            <Button
              type="button"
              onClick={() => setNotificacionesOpen((v) => !v)}
              aria-label="Novedades y notificaciones"
              aria-expanded={notificacionesOpen}
              title="Novedades y notificaciones del refugio"
              style={{
                position: 'relative',
                background: notificacionesOpen ? '#eef3ec' : '#fff',
                border: `var(--portal-border-emphasis) solid ${notificacionesOpen ? '#3f6c52' : '#e9eaed'}`,
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
              {notificaciones.length > 0 && (
                <span
                  style={{
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
                  }}
                >
                  {notificaciones.length}
                </span>
              )}
            </Button>

            {notificacionesOpen && (
              <>
                <div
                  onClick={() => setNotificacionesOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 400 }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '48px',
                    right: 0,
                    width: 'min(400px, calc(100vw - 48px))',
                    background: 'var(--portal-surface)',
                    border: 'var(--portal-border-emphasis) solid var(--portal-border)',
                    borderRadius: '14px',
                    boxShadow: '0 12px 32px rgba(20,24,32,0.14)',
                    zIndex: 401,
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '14px 16px',
                      borderBottom: 'var(--portal-border-emphasis) solid #f0f1f3'
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: '800',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: '#1f2430',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Mail size={15} aria-hidden="true" /> Novedades y Notificaciones
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--portal-text-muted)', fontWeight: '600' }}>
                      {notificaciones.length} reciente(s)
                    </span>
                  </div>

                  <div style={{ maxHeight: '340px', overflowY: 'auto', padding: '10px' }}>
                    {notificaciones.length === 0 ? (
                      <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--portal-text-muted)', fontSize: '0.84rem' }}>
                        <Bell size={24} aria-hidden="true" style={{ marginBottom: '6px', opacity: 0.5 }} />
                        <div>No hay notificaciones recientes.</div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {notificaciones.map((n) => (
                          <div
                            key={n.id}
                            style={{
                              padding: '10px 12px',
                              background: n.tipo === 'INGRESO_ANIMAL' ? '#f5f9f6' : '#edeffb',
                              borderLeft: `4px solid ${n.tipo === 'INGRESO_ANIMAL' ? '#3f6c52' : '#4550c0'}`,
                              borderRadius: '8px',
                              fontSize: '0.8rem'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                              <strong style={{ color: '#1f2430' }}>{n.titulo}</strong>
                              <span style={{ fontSize: '0.7rem', color: 'var(--portal-text-muted)', whiteSpace: 'nowrap' }}>
                                {new Date(n.fechaHora).toLocaleDateString('es-CL')}
                              </span>
                            </div>
                            <div style={{ color: '#555e6d', marginTop: '3px', fontSize: '0.78rem' }}>{n.mensaje}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* BANNER EN TIEMPO REAL DE NOTIFICACIÓN AL PERSONAL DEL REFUGIO */}
      {avisoReciente && (
        <div
          style={{
            background: 'var(--portal-primary-soft)',
            borderLeft: '5px solid #3f6c52',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 2px 8px rgba(20,24,32,0.05)',
            flexShrink: 0
          }}
        >
          <div>
            <strong style={{ color: '#2f5540', fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bell size={15} aria-hidden="true" /> Se avisó al equipo del refugio
            </strong>
            <span style={{ color: '#1f2430', fontSize: '0.82rem' }}>{avisoReciente}</span>
          </div>
          <Button
            type="button"
            onClick={() => setAvisoReciente(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--portal-text-muted)', fontWeight: '700' }}
          >
            ✕
          </Button>
        </div>
      )}

      {/* BARRA DE BÚSQUEDA, FILTROS AVANZADOS, BAJAS Y ORDENAMIENTO POR FECHA DE INGRESO */}
      <Card
        className="portal-card"
        style={{
          padding: '14px 16px',
          marginBottom: '18px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '200px' }}>
            <Search
              size={16}
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--portal-text-light)',
                pointerEvents: 'none'
              }}
            />
            <Input
              type="search"
              placeholder="Buscar animal por nombre..."
              aria-label="Buscar animal por nombre"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '8px',
                border: 'var(--portal-border-emphasis) solid var(--portal-border)',
                fontSize: '0.86rem',
                background: 'var(--portal-surface)'
              }}
            />
          </div>

          <Input as="select"
            value={especie}
            onChange={(e) => setEspecie(e.target.value)}
            aria-label="Filtrar por especie"
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              border: 'var(--portal-border-emphasis) solid var(--portal-border)',
              fontSize: '0.85rem',
              background: 'var(--portal-surface)',
              color: 'var(--portal-text-main)'
            }}
          >
            <option value="">Todas las especies</option>
            <option value="Perro">Perros (Canina)</option>
            <option value="Gato">Gatos (Felina)</option>
          </Input>

          <Input as="select"
            value={estadoSalud}
            onChange={(e) => setEstadoSalud(e.target.value)}
            aria-label="Filtrar por estado de salud"
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              border: 'var(--portal-border-emphasis) solid var(--portal-border)',
              fontSize: '0.85rem',
              background: 'var(--portal-surface)',
              color: 'var(--portal-text-main)'
            }}
          >
            <option value="">Todos los estados de salud</option>
            <option value="NORMAL">Salud: Normal</option>
            <option value="CONDICION_ESPECIAL">Salud: Condición especial</option>
            <option value="CRITICO">Salud: Crítico</option>
          </Input>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <ArrowUpDown size={15} color="var(--portal-text-muted)" aria-hidden="true" />
            <Input as="select"
              value={ordenFecha}
              onChange={(e) => setOrdenFecha(e.target.value)}
              aria-label="Ordenar por fecha de ingreso"
              style={{
                padding: '9px 12px',
                borderRadius: '8px',
                border: 'var(--portal-border-emphasis) solid var(--portal-border)',
                fontSize: '0.85rem',
                background: 'var(--portal-surface)',
                color: 'var(--portal-text-main)',
                fontWeight: 600
              }}
            >
              <option value="desc">Fecha de ingreso: Más recientes primero</option>
              <option value="asc">Fecha de ingreso: Más antiguos primero</option>
            </Input>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            borderTop: 'var(--portal-border-emphasis) solid var(--portal-border-subtle)',
            paddingTop: '10px'
          }}
        >
          {/* Control dedicado para filtrar animales dados de baja */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.76rem',
                fontWeight: 700,
                color: 'var(--portal-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Archive size={14} aria-hidden="true" /> Estado de registro:
            </span>
            <div className="perfil-estado-switch" role="group" aria-label="Filtrar animales activos o dados de baja">
              <Button
                type="button"
                className={estadoRegistro === 'ACTIVOS' ? 'active' : ''}
                onClick={() => setEstadoRegistro('ACTIVOS')}
                aria-pressed={estadoRegistro === 'ACTIVOS'}
              >
                Activos
              </Button>
              <Button
                type="button"
                className={estadoRegistro === 'BAJA' ? 'active' : ''}
                onClick={() => setEstadoRegistro('BAJA')}
                aria-pressed={estadoRegistro === 'BAJA'}
              >
                Dados de baja
              </Button>
              <Button
                type="button"
                className={estadoRegistro === 'TODOS' ? 'active' : ''}
                onClick={() => setEstadoRegistro('TODOS')}
                aria-pressed={estadoRegistro === 'TODOS'}
              >
                Todos
              </Button>
            </div>
          </div>

          {hayFiltrosActivos && (
            <Button
              type="button"
              onClick={restablecerFiltros}
              className="portal-btn portal-btn-secondary"
              style={{ minHeight: '34px', padding: '6px 12px', fontSize: '0.8rem' }}
            >
              <RotateCcw size={14} aria-hidden="true" /> Limpiar filtros
            </Button>
          )}
        </div>
      </Card>

      {/* LISTADO DE ANIMALES INGRESADOS — solo esta zona hace scroll */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '6px', marginRight: '-6px', paddingBottom: '8px' }}>
        {cargando ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--portal-text-muted)' }}>Cargando animales ingresados...</div>
        ) : animales.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px',
              background: 'var(--portal-surface)',
              borderRadius: '14px',
              border: 'var(--portal-border-emphasis) solid var(--portal-border)',
              color: 'var(--portal-text-muted)'
            }}
          >
            {mensajeVacio}
          </div>
        ) : (
          <div className="portal-animal-grid">
            {animales.map((a) => {
              const badge = badgeMap[a.estadoSalud] || badgeMap.NORMAL;
              const esBaja = a.activo === false;
              return (
                <Card
                  key={a.id}
                  onClick={() => abrirFichaAnimal(a.id)}
                  className="portal-animal-card portal-card-selectable"
                  style={esBaja ? { borderColor: '#f3c9c4', background: 'var(--portal-danger-bg)' } : undefined}
                >
                  <div className="portal-animal-media">
                    <AnimalPhoto src={a.fotoUrl} className="portal-animal-photo-cover" />
                    <span
                      style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        background: 'rgba(31,36,48,0.75)',
                        color: '#fff',
                        padding: '3px 9px',
                        borderRadius: '7px',
                        fontSize: '0.68rem',
                        fontWeight: '700'
                      }}
                    >
                      {a.tipoIngreso || 'Rescate'}
                    </span>
                    <span
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: esBaja ? '#fbeae8' : badge.bg,
                        color: esBaja ? '#d1453b' : badge.color,
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontSize: '0.72rem',
                        fontWeight: '800',
                        border: esBaja ? 'var(--portal-border-emphasis) solid #f3c9c4' : 'none'
                      }}
                    >
                      {esBaja ? 'Dado de baja' : badge.label}
                    </span>
                  </div>

                  <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '4px', gap: '4px 8px' }}>
                      <div style={{ minWidth: 0 }}>
                        <h3 className="portal-animal-name">
                          <Button
                            type="button"
                            className="portal-animal-open"
                            aria-label={`Abrir ficha de ${a.nombre}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              abrirFichaAnimal(a.id);
                            }}
                          >
                            {a.nombre}
                          </Button>
                        </h3>
                        {a.estadoAdopcion === 'ADOPTADO' && (
                          <span style={{ color: '#2f5540', fontSize: '.8rem', fontWeight: 700, display: 'block' }}>
                            Adoptado
                          </span>
                        )}
                        <span style={{ fontSize: '0.8rem', color: 'var(--portal-text-muted)' }}>
                          {a.especie} · {a.sexo} · {a.edad || 'Edad desconocida'}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--portal-text-muted)',
                          fontWeight: '600',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          whiteSpace: 'nowrap'
                        }}
                        title="Fecha de ingreso al refugio"
                      >
                        <Calendar size={12} aria-hidden="true" /> {formatearFechaIngreso(a.creadoEn)}
                      </span>
                    </div>

                    {/* Canil asignado en tiempo real */}
                    <div
                      style={{
                        margin: '6px 0',
                        padding: '6px 8px',
                        borderRadius: '8px',
                        background: a.canil ? '#e8f0e8' : '#f8f9fa',
                        border: a.canil ? 'var(--portal-border-emphasis) solid #c9dfcd' : 'var(--portal-border-emphasis) dashed #e9eaed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.76rem'
                      }}
                    >
                      <DoorOpen size={14} aria-hidden="true" />
                      <span>
                        Ubicación: <strong>{a.canil ? `${a.canil.nombre} (${a.canil.sector})` : 'Sin canil asignado'}</strong>
                      </span>
                    </div>

                    <p style={{ fontSize: '0.81rem', color: '#555e6d', margin: '0 0 8px', flex: 1 }}>
                      {limpiarNotaCausal(a.nota) || 'Sin antecedentes clínicos registrados.'}
                    </p>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderTop: 'var(--portal-border-emphasis) solid #f0f1f3',
                        paddingTop: '8px',
                        gap: '6px',
                        flexWrap: 'wrap'
                      }}
                    >
                      <span style={{ fontSize: '0.73rem', color: 'var(--portal-text-muted)' }}>
                        {a.raza || 'Desconocida'} · {a.peso > 0 ? `${a.peso} kg` : 'Peso s/i'}
                      </span>

                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {!esBaja ? (
                          <Button
                            type="button"
                            onClick={(e) => handleDelete(a.id, a.nombre, e)}
                            title="Dar de baja al animal"
                            style={{
                              background: '#fbeae8',
                              border: 'var(--portal-border-emphasis) solid #f3c9c4',
                              color: '#d1453b',
                              padding: '5px 8px',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            Baja
                          </Button>
                        ) : (
                          <span className="portal-badge portal-badge-danger" style={{ fontSize: '0.7rem' }}>
                            Dado de baja
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL DE FICHA DEL ANIMAL */}
      {(fichaSeleccionada || cargandoFicha) && (
        <Modal onClose={() => setFichaSeleccionada(null)} nombre="Ficha del animal" bloqueado={cargandoFicha}
          papel={{ style: {
              background: 'var(--portal-surface)',
              borderRadius: '18px',
              padding: '26px',
              width: '100%',
              maxWidth: '640px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 16px 40px rgba(20,24,32,0.25)'
            } }}>
            {cargandoFicha || !fichaSeleccionada ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--portal-text-muted)' }}>Cargando ficha del animal...</div>
            ) : (
              <>
                {/* Fotografía + datos principales del animal */}
                <div style={{ display: 'flex', gap: '18px', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div
                    onClick={() => fichaSeleccionada.fotoUrl && setFotoAmpliada(true)}
                    title={fichaSeleccionada.fotoUrl ? 'Clic para ampliar la fotografía' : undefined}
                    style={{
                      width: '160px',
                      height: '160px',
                      borderRadius: '14px',
                      background: '#eef0f2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0,
                      cursor: fichaSeleccionada.fotoUrl ? 'zoom-in' : 'default',
                      position: 'relative'
                    }}
                  >
                    {fichaSeleccionada.fotoUrl ? (
                      <>
                        <img
                          src={fichaSeleccionada.fotoUrl}
                          alt={fichaSeleccionada.nombre}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            right: '6px',
                            bottom: '6px',
                            background: 'rgba(20,24,32,0.65)',
                            color: '#fff',
                            fontSize: '0.68rem',
                            fontWeight: '700',
                            padding: '2px 7px',
                            borderRadius: '6px',
                            pointerEvents: 'none'
                          }}
                        >
                          <Search size={12} aria-hidden="true" /> Ampliar
                        </span>
                      </>
                    ) : (
                      <PawPrint size={48} color="#cbd5e1" aria-hidden="true" />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            background: 'var(--portal-primary-soft)',
                            color: '#2f5540',
                            padding: '2px 8px',
                            borderRadius: '6px'
                          }}
                        >
                          Ficha del animal · Ingreso por {fichaSeleccionada.tipoIngreso || 'Rescate'}
                        </span>
                        {fichaSeleccionada.activo === false && (
                          <span className="portal-badge portal-badge-danger" style={{ fontSize: '0.7rem' }}>
                            Dado de baja
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        onClick={() => setFichaSeleccionada(null)}
                        style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--portal-text-muted)', flexShrink: 0 }}
                      >
                        ✕
                      </Button>
                    </div>
                    <h3 style={{ margin: '10px 0 4px', fontSize: '1.5rem', color: '#1f2430' }}>{fichaSeleccionada.nombre}</h3>
                    <span style={{ fontSize: '0.85rem', color: 'var(--portal-text-muted)' }}>
                      {fichaSeleccionada.especie} · {fichaSeleccionada.sexo} · Edad: {fichaSeleccionada.edad || 'Desconocida'}
                    </span>
                  </div>
                </div>

                {/* Datos Generales y Clínicos */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    background: 'var(--portal-surface-muted)',
                    padding: '14px',
                    borderRadius: '12px',
                    marginBottom: '14px',
                    fontSize: '0.82rem'
                  }}
                >
                  <div>
                    <strong style={{ color: 'var(--portal-text-muted)' }}>Raza:</strong> {fichaSeleccionada.raza || 'Desconocida'}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--portal-text-muted)' }}>Peso:</strong>{' '}
                    {fichaSeleccionada.peso > 0 ? `${fichaSeleccionada.peso} kg` : 'No registrado'}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--portal-text-muted)' }}>Microchip:</strong> {fichaSeleccionada.chip || 'Sin microchip'}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--portal-text-muted)' }}>Estado de Salud:</strong>{' '}
                    {(badgeMap[fichaSeleccionada.estadoSalud] || {}).label || fichaSeleccionada.estadoSalud}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--portal-text-muted)' }}>Esterilización:</strong> {fichaSeleccionada.esterilizacion || 'Desconocido'}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--portal-text-muted)' }}>Fecha de Ingreso:</strong>{' '}
                    {formatearFechaIngreso(fichaSeleccionada.creadoEn)}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--portal-text-muted)' }}>Ubicación / Canil:</strong>{' '}
                    {fichaSeleccionada.canil ? `${fichaSeleccionada.canil.nombre} (${fichaSeleccionada.canil.sector})` : 'Sin asignar'}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--portal-text-muted)' }}>Estado de Registro:</strong>{' '}
                    {fichaSeleccionada.activo === false ? 'Dado de baja' : 'Activo'}
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong style={{ color: 'var(--portal-text-muted)' }}>Comportamiento:</strong> {fichaSeleccionada.comportamiento || 'Por evaluar'}
                  </div>
                </div>

                {/* Historial Médico / Notas Clínicas */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--portal-text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Stethoscope size={14} aria-hidden="true" /> Antecedentes Clínicos e Historial Médico
                  </div>
                  <div
                    style={{
                      background: '#faf1de',
                      borderLeft: '4px solid #d99a3d',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontSize: '0.84rem',
                      color: '#1f2430'
                    }}
                  >
                    {limpiarNotaCausal(fichaSeleccionada.nota) || 'Sin antecedentes médicos registrados.'}
                  </div>
                </div>

                {/* Sección de Postulantes / Adopciones con Protección de Datos */}
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--portal-text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <ClipboardList size={14} aria-hidden="true" /> Trazabilidad de Adopciones y Devoluciones
                  </div>
                  {fichaSeleccionada.adopciones && fichaSeleccionada.adopciones.length > 0 && (
                    <div
                      style={{
                        background: '#fbeae8',
                        border: 'var(--portal-border-emphasis) solid #f3c9c4',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        color: '#d1453b',
                        marginBottom: '8px'
                      }}
                    >
                      <Lock size={12} aria-hidden="true" /> Por seguridad y protección de datos personales, la información de contacto de los postulantes no se incluye en
                      los documentos exportados.
                    </div>
                  )}
                  {!fichaSeleccionada.adopciones || fichaSeleccionada.adopciones.length === 0 ? (
                    <div style={{ fontSize: '0.82rem', color: 'var(--portal-text-muted)', padding: '4px 0' }}>
                      No existen solicitudes de adopción asociadas a este animal.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {fichaSeleccionada.adopciones.map((ad) => (
                        <div
                          key={ad.id}
                          style={{
                            padding: '10px 12px',
                            background: '#f5f9f6',
                            border: 'var(--portal-border-emphasis) solid #c9dfcd',
                            borderRadius: '8px',
                            fontSize: '0.8rem'
                          }}
                        >
                          <strong>Solicitud de adopción</strong> — Etapa: <strong>{ad.etapa}</strong> · Devolución:{' '}
                          <strong>{ad.devolucion ? 'Sí' : 'No'}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Botones de Acción del Modal */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: 'var(--portal-border-emphasis) solid #f0f1f3',
                    paddingTop: '14px',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <Button
                      type="button"
                      onClick={(e) => abrirEdicionFicha(fichaSeleccionada, e)}
                      style={{
                        background: '#faf1de',
                        color: '#9c6818',
                        border: 'var(--portal-border-emphasis) solid #f2d59b',
                        padding: '9px 14px',
                        borderRadius: '8px',
                        fontWeight: '700',
                        fontSize: '0.82rem',
                        cursor: 'pointer'
                      }}
                    >
                      <Pencil size={14} aria-hidden="true" /> Editar Ficha del Animal
                    </Button>

                    {puedeExportarExpediente ? (
                      <>
                        <Button
                          type="button"
                          onClick={(e) => handleExportExpediente(fichaSeleccionada, 'PDF', e)}
                          disabled={descargandoId === `${fichaSeleccionada.id}-PDF`}
                          style={{
                            background: '#3f6c52',
                            color: '#fff',
                            border: 'none',
                            padding: '9px 14px',
                            borderRadius: '8px',
                            fontWeight: '700',
                            fontSize: '0.82rem',
                            cursor: 'pointer'
                          }}
                        >
                          {descargandoId === `${fichaSeleccionada.id}-PDF` ? 'Generando PDF...' : <><FileText size={14} aria-hidden="true" /> Descargar Ficha (PDF)</>}
                        </Button>
                        <Button
                          type="button"
                          onClick={(e) => handleExportExpediente(fichaSeleccionada, 'CSV', e)}
                          disabled={descargandoId === `${fichaSeleccionada.id}-CSV`}
                          style={{
                            background: '#4550c0',
                            color: '#fff',
                            border: 'none',
                            padding: '9px 14px',
                            borderRadius: '8px',
                            fontWeight: '700',
                            fontSize: '0.82rem',
                            cursor: 'pointer'
                          }}
                        >
                          {descargandoId === `${fichaSeleccionada.id}-CSV` ? 'Generando CSV...' : <><FileSpreadsheet size={14} aria-hidden="true" /> Descargar Ficha (CSV)</>}
                        </Button>
                      </>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--portal-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Lock size={12} aria-hidden="true" /> La descarga de fichas está disponible para el personal del refugio y la Dirección.
                      </span>
                    )}

                    {fichaSeleccionada.activo !== false && (
                      <Button
                        type="button"
                        onClick={(e) => handleDelete(fichaSeleccionada.id, fichaSeleccionada.nombre, e)}
                        title="Dar de baja al animal"
                        style={{
                          background: '#fbeae8',
                          border: 'var(--portal-border-emphasis) solid #f3c9c4',
                          color: '#d1453b',
                          padding: '9px 14px',
                          borderRadius: '8px',
                          fontSize: '0.82rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Trash2 size={14} aria-hidden="true" /> Dar de Baja
                      </Button>
                    )}
                  </div>

                  {/* <button
                    type="button"
                    onClick={() => setFichaSeleccionada(null)}
                    style={{
                      background: 'var(--portal-surface-muted)',
                      border: 'var(--portal-border-emphasis) solid var(--portal-border)',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Cerrar
                  </button> */}
                </div>
              </>
            )}
          </Modal>
      )}

      {/* VISOR DE FOTOGRAFÍA AMPLIADA */}
      {fotoAmpliada && fichaSeleccionada?.fotoUrl && (
        <Modal onClose={() => setFotoAmpliada(false)} nombre="Fotografía ampliada" fondo="rgba(10,12,16,0.88)" papel={{ style: { background: 'transparent', boxShadow: 'none', overflow: 'visible', width: 'fit-content' } }}>
          <Button
            type="button"
            onClick={() => setFotoAmpliada(false)}
            aria-label="Cerrar fotografía ampliada"
            style={{
              position: 'absolute',
              top: '18px',
              right: '22px',
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              border: 'var(--portal-border-emphasis) solid rgba(255,255,255,0.35)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              fontSize: '1.1rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </Button>

          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', maxWidth: '100%', maxHeight: '100%' }}
          >
            <img
              src={fichaSeleccionada.fotoUrl}
              alt={fichaSeleccionada.nombre}
              style={{
                maxWidth: '90vw',
                maxHeight: '82vh',
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                cursor: 'default'
              }}
            />
            <span style={{ color: '#e9eaed', fontSize: '0.9rem', fontWeight: '700' }}>
              {fichaSeleccionada.nombre}
            </span>
          </div>
        </Modal>
      )}
    </div>
  );
}
