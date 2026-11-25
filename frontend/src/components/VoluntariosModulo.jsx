import { usePortalFeedback } from './ui/PortalFeedback';
import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeftRight,
  Ban,
  BookOpen,
  CalendarDays,
  CircleCheck,
  CircleX,
  ClipboardList,
  Clock,
  Crown,
  Download,
  Handshake,
  Lock,
  Plus,
  ShieldCheck,
  TriangleAlert,
  User,
  Users
} from 'lucide-react';
import { API_URL, getAuthHeaders } from '../api/config';
import { formatearErrorApi } from '../utils/errores';
import { DIAS_MATRIZ, FRANJAS_MATRIZ, exportarMatrizPNG, fechaCortaTurno as fechaCorta } from '../utils/exportarMatriz';

const etiquetaTurno = turno => [turno.diaSemana, fechaCorta(turno.fecha)].filter(Boolean).join(' ');

export default function VoluntariosModulo({ user }) {
  const { avisar, confirmar } = usePortalFeedback();
  const [tabActual, setTabActual] = useState('matriz'); // 'matriz' | 'permutas' | 'bitacora' | 'directorio'
  const [matriz, setMatriz] = useState(null);
  const [semana, setSemana] = useState('');
  const [gestionandoMatriz, setGestionandoMatriz] = useState(false);
  const [mensajeMatriz, setMensajeMatriz] = useState('');
  const [errorMatriz, setErrorMatriz] = useState('');
  const solicitudDatos = useRef(0);
  const semanaActual = useRef('');
  const [turnos, setTurnos] = useState([]);
  const [permutas, setPermutas] = useState([]);
  const [directorio, setDirectorio] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [exportandoMatriz, setExportandoMatriz] = useState(false);
  const [errorExportacion, setErrorExportacion] = useState('');

  // Modales
  const [modalTurnoOpen, setModalTurnoOpen] = useState(false);
  const [modalPermutaOpen, setModalPermutaOpen] = useState(false);
  const [modalBitacoraOpen, setModalBitacoraOpen] = useState(false);
  const [modalAsignarCoordOpen, setModalAsignarCoordOpen] = useState(false);
  const [turnoSeleccionado, setTurnoSeleccionado] = useState(null);

  // Formulario Crear Turno (Dirección)
  const [formTurno, setFormTurno] = useState({
    diaSemana: 'Lunes',
    franja: 'Mañana',
    area: 'Paseos',
    cupoMaximo: 2,
    esCritica: false,
    observaciones: ''
  });

  // Formulario Solicitar Permuta
  const [formPermuta, setFormPermuta] = useState({
    turnoOrigenId: '',
    destinatarioId: '',
    turnoDestinoId: '',
    motivo: ''
  });

  // Formulario Bitácora
  const [formBitacora, setFormBitacora] = useState({
    tareasRealizadas: '',
    incidentes: '',
    observaciones: ''
  });

  // Formulario Asignación por Dirección
  const [voluntarioAAsignarId, setVoluntarioAAsignarId] = useState('');

  const esDireccion = user?.rol === 'DIRECCION';
  const esAvanzado = ['DIRECCION', 'PERSONAL_VETERINARIO', 'VOLUNTARIO_AVANZADO'].includes(user?.rol);

  useEffect(() => {
    cargarDatos(semana);
    return () => { solicitudDatos.current += 1; };
  }, [semana]);

  const cargarDatos = async (semanaParaCargar = semanaActual.current) => {
    const solicitud = ++solicitudDatos.current;
    setCargando(true);
    try {
      const consulta = semanaParaCargar ? `?${new URLSearchParams({ semana: semanaParaCargar })}` : '';
      const [resMatriz, resTurnos, resPermutas, resDirectorio] = await Promise.all([
        fetch(`${API_URL}/turnos/matriz${consulta}`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/turnos`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/turnos/permutas`, { headers: getAuthHeaders() }).catch(() => ({ ok: false })),
        fetch(`${API_URL}/turnos/directorio`, { headers: getAuthHeaders() }).catch(() => ({ ok: false }))
      ]);

      const dataMatriz = await resMatriz.json();
      if (!resMatriz.ok) throw new Error(formatearErrorApi(dataMatriz));
      const [datosTurnos, datosPermutas, datosDirectorio] = await Promise.all(
        [resTurnos, resPermutas, resDirectorio].map(res => res.ok ? res.json() : null)
      );
      if (solicitud !== solicitudDatos.current) return;
      setMatriz(dataMatriz);
      if (datosTurnos) setTurnos(datosTurnos);
      if (datosPermutas) setPermutas(datosPermutas);
      if (datosDirectorio) setDirectorio(datosDirectorio);
    } catch (e) {
      if (solicitud !== solicitudDatos.current) return;
      setMatriz(null);
      setErrorMatriz(formatearErrorApi(e, 'No se pudo cargar la matriz semanal.'));
    } finally {
      if (solicitud === solicitudDatos.current) setCargando(false);
    }
  };

  const seleccionarSemana = fecha => {
    if (fecha === semana || gestionandoMatriz) return;
    setCargando(true);
    setMatriz(null);
    setErrorMatriz('');
    setErrorExportacion('');
    setMensajeMatriz('');
    semanaActual.current = fecha;
    solicitudDatos.current += 1;
    setSemana(fecha);
  };

  const moverSemana = desplazamiento => {
    const dia = new Date(matriz.fechas[0]);
    dia.setUTCDate(dia.getUTCDate() + desplazamiento);
    seleccionarSemana(dia.toISOString().slice(0, 10));
  };

  // 1. Inscripción Individual a un Turno
  const handleInscribirse = async (turno) => {
    try {
      const res = await fetch(`${API_URL}/turnos/${turno.id}/inscribirse`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(formatearErrorApi(data, 'Error al inscribirse en el turno'));
      }
      avisar(`¡Inscripción exitosa! Quedas asignado al turno de ${turno.area} (${turno.diaSemana} - ${turno.franja}).`, 'exito');
      cargarDatos();
    } catch (err) {
      avisar(formatearErrorApi(err), 'error');
    }
  };

  // 2. Desinscribirse de un Turno
  const handleDesinscribirse = async (turnoId, usuarioId = null) => {
    if (!await confirmar({
      titulo: 'Cancelar inscripción',
      mensaje: 'El cupo de esta inscripción volverá a estar disponible en el turno.',
      accion: 'Cancelar inscripción',
      peligro: true
    })) return;
    try {
      const query = usuarioId ? `?usuarioId=${usuarioId}` : '';
      const res = await fetch(`${API_URL}/turnos/${turnoId}/desinscribirse${query}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(formatearErrorApi(data, 'Error al cancelar inscripción'));
      }
      avisar('Inscripción cancelada.', 'exito');
      cargarDatos();
    } catch (err) {
      avisar(formatearErrorApi(err), 'error');
    }
  };

  // 3. Asignación directa por Dirección
  const handleAsignarTurno = async (e) => {
    e.preventDefault();
    if (!voluntarioAAsignarId || !turnoSeleccionado) return;

    try {
      const res = await fetch(`${API_URL}/turnos/${turnoSeleccionado.id}/inscribirse`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ usuarioId: Number(voluntarioAAsignarId) })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(formatearErrorApi(data, 'Error al asignar voluntario'));
      }
      avisar('Voluntario asignado al turno.', 'exito');
      setModalAsignarCoordOpen(false);
      setVoluntarioAAsignarId('');
      cargarDatos();
    } catch (err) {
      avisar(formatearErrorApi(err), 'error');
    }
  };

  const handleExportarMatriz = async () => {
    if (!matriz || exportandoMatriz) return;
    setExportandoMatriz(true);
    setErrorExportacion('');
    try {
      await exportarMatrizPNG(matriz);
    } catch (error) {
      setErrorExportacion(formatearErrorApi(error, 'No se pudo descargar la imagen. Inténtalo nuevamente.'));
    } finally {
      setExportandoMatriz(false);
    }
  };

  const gestionarMatriz = async (limpiar) => {
    const inicio = matriz?.fechas?.[0];
    if (!inicio || cargando || gestionandoMatriz) return;
    const periodo = `${fechaCorta(inicio)} al ${fechaCorta(matriz.fechas[6])}`;
    const pregunta = limpiar
      ? `¿Eliminar todos los turnos en borrador de la semana del ${periodo}? Esta acción no se puede deshacer.`
      : `¿Confirmar la planificación del ${periodo} y habilitar su bitácora?`;
    if (!await confirmar({
      titulo: limpiar ? 'Limpiar matriz semanal' : 'Confirmar planificación semanal',
      mensaje: pregunta,
      accion: limpiar ? 'Limpiar matriz' : 'Confirmar planificación',
      peligro: limpiar
    })) return;
    setGestionandoMatriz(true);
    setErrorMatriz('');
    setMensajeMatriz('');
    try {
      const ruta = limpiar ? 'matriz/limpiar' : 'confirmar-planificacion';
      const res = await fetch(`${API_URL}/turnos/${ruta}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ semana: inicio })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(formatearErrorApi(data, 'No se pudo actualizar la matriz.'));
      }
      setMensajeMatriz(data.mensaje);
      await cargarDatos();
    } catch (err) {
      setErrorMatriz(formatearErrorApi(err));
    } finally {
      setGestionandoMatriz(false);
    }
  };

  // 5. Crear Turno (Dirección)
  const puedeCrearTurno = esDireccion && !cargando && !gestionandoMatriz && Boolean(matriz?.fechas?.length);

  const abrirCrearTurno = (diaSemana = DIAS_MATRIZ[0], franja = FRANJAS_MATRIZ[0].nombre) => {
    if (!puedeCrearTurno) return;
    setFormTurno(prev => ({ ...prev, diaSemana, franja }));
    setTabActual('matriz');
    setModalTurnoOpen(true);
  };

  const handleCrearTurno = async (e) => {
    e.preventDefault();
    const fecha = matriz?.fechas?.[DIAS_MATRIZ.indexOf(formTurno.diaSemana)];
    const franja = FRANJAS_MATRIZ.find(item => item.nombre === formTurno.franja);
    if (!puedeCrearTurno || !fecha || !franja) return;
    const [horaInicio, horaFin] = franja.horario.split(' - ');
    try {
      const res = await fetch(`${API_URL}/turnos`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...formTurno, horaInicio, horaFin, fecha: `${fecha}T00:00:00.000Z` })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(formatearErrorApi(data, 'Error al crear turno'));
      }
      setModalTurnoOpen(false);
      cargarDatos();
    } catch (err) {
      avisar(formatearErrorApi(err), 'error');
    }
  };

  // 6. Solicitar Permuta
  const handleSolicitarPermuta = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        turnoOrigenId: Number(formPermuta.turnoOrigenId),
        destinatarioId: Number(formPermuta.destinatarioId),
        turnoDestinoId: formPermuta.turnoDestinoId ? Number(formPermuta.turnoDestinoId) : null,
        motivo: formPermuta.motivo
      };

      const res = await fetch(`${API_URL}/turnos/permutas`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(formatearErrorApi(data, 'Error al solicitar permuta'));
      }
      avisar('Solicitud de permuta enviada. Se encuentra pendiente de validación y aprobación por el compañero destinatario.', 'exito');
      setModalPermutaOpen(false);
      cargarDatos();
    } catch (err) {
      avisar(formatearErrorApi(err), 'error');
    }
  };

  // 7. Responder a Permuta (Aprobar / Rechazar)
  const handleResponderPermuta = async (permutaId, accion) => {
    const aprobar = accion === 'APROBAR';
    const confirmacion = await confirmar({
      titulo: aprobar ? 'Aprobar permuta' : 'Rechazar permuta',
      mensaje: aprobar
        ? 'Al aprobar la permuta se actualizarán las asignaciones de los turnos.'
        : 'Al rechazar la permuta se conservarán las asignaciones actuales.',
      accion: aprobar ? 'Aprobar permuta' : 'Rechazar permuta',
      peligro: !aprobar
    });
    if (!confirmacion) return;

    try {
      const res = await fetch(`${API_URL}/turnos/permutas/${permutaId}/responder`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ accion, observacion: `Respuesta de permuta: ${accion}` })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(formatearErrorApi(data, 'Error al procesar respuesta'));
      }
      avisar(accion === 'APROBAR' ? '¡Permuta aprobada por ambas partes! Los turnos fueron intercambiados automáticamente en la matriz.' : 'Permuta rechazada.', 'exito');
      cargarDatos();
    } catch (err) {
      avisar(formatearErrorApi(err), 'error');
    }
  };

  // 8. Registrar Bitácora de Turno (Inscripción Previa Obligatoria)
  const handleGuardarBitacora = async (e) => {
    e.preventDefault();
    if (!turnoSeleccionado) return;

    try {
      const res = await fetch(`${API_URL}/turnos/${turnoSeleccionado.id}/bitacora`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formBitacora)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(formatearErrorApi(data, 'Error al registrar bitácora'));
      }
      avisar('Registro de asistencia y bitácora guardado exitosamente.', 'exito');
      setModalBitacoraOpen(false);
      setFormBitacora({ tareasRealizadas: '', incidentes: '', observaciones: '' });
      cargarDatos();
    } catch (err) {
      avisar(formatearErrorApi(err), 'error');
    }
  };

  // Mis turnos asignados
  const misTurnos = turnos.filter(t => (t.inscripciones || []).some(i => i.usuarioId === user?.id));

  return (
    <div className="portal-page-container">
      {/* ENCABEZADO */}
      <div className="portal-header">
        <div>
          <h2 className="portal-header-title">
            <Handshake size={26} aria-hidden="true" />
            <span>Voluntarios y Matriz de Turnos</span>
          </h2>
          <p className="portal-header-subtitle">
            Matriz interactiva semanal, autogestión de inscripciones, validación de permutas por ambas partes y bitácora de servicio.
          </p>
        </div>

        <div className="portal-header-actions">
          {esDireccion && (
            <>
              <button
                type="button"
                onClick={() => abrirCrearTurno()}
                disabled={!puedeCrearTurno}
                className="portal-btn portal-btn-primary"
              >
                <Plus size={16} aria-hidden="true" /> Crear Turno
              </button>
            </>
          )}
        </div>
      </div>

      {/* TABS DE SECCIÓN — SUBNAVEGACIÓN ESTÁNDAR */}
      <div className="portal-subtabs">
        {[
          { key: 'matriz', label: 'Matriz Semanal Interactiva', icon: CalendarDays, count: null },
          { key: 'permutas', label: 'Gestión de Permutas', icon: ArrowLeftRight, count: permutas.filter(p => p.estado === 'PENDIENTE' && p.destinatarioId === user?.id).length },
          { key: 'bitacora', label: 'Bitácora de Turnos', icon: ClipboardList, count: misTurnos.length },
          { key: 'directorio', label: 'Directorio de Voluntarios', icon: Users, count: directorio.length }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setTabActual(tab.key)}
            className={`portal-subtab-btn ${tabActual === tab.key ? 'active' : ''}`}
          >
            <tab.icon size={15} aria-hidden="true" />
            <span>{tab.label}</span>
            {tab.count !== null && tab.count > 0 && (
              <span style={{
                background: tabActual === tab.key ? '#fff' : '#d1453b',
                color: tabActual === tab.key ? 'var(--portal-primary)' : '#fff',
                fontSize: '0.72rem', padding: '1px 6px',
                borderRadius: '10px', fontWeight: '800'
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 1: MATRIZ SEMANAL INTERACTIVA                          */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {tabActual === 'matriz' && (
        <div>
          <section className="portal-card" aria-label="Semana de turnos" style={{ marginBottom: '16px' }}>
            <div className="portal-header-actions">
              <button type="button" className="portal-btn portal-btn-secondary" disabled={!matriz?.fechas?.length || gestionandoMatriz} onClick={() => moverSemana(-7)}>Semana anterior</button>
              <button type="button" className="portal-btn portal-btn-secondary" disabled={!semana || gestionandoMatriz} onClick={() => seleccionarSemana('')}>Semana actual</button>
              <button type="button" className="portal-btn portal-btn-secondary" disabled={!matriz?.fechas?.length || gestionandoMatriz} onClick={() => moverSemana(7)}>Semana siguiente</button>
              <label>
                {'Ir a una semana '}
                <input type="date" className="portal-input" value={matriz?.fechas?.[0] || (semana === 'sin-fecha' ? '' : semana)} disabled={gestionandoMatriz} onChange={e => seleccionarSemana(e.target.value)} />
              </label>
              {turnos.some(turno => !turno.fecha) && (
                <button type="button" className="portal-btn portal-btn-secondary" disabled={semana === 'sin-fecha' || gestionandoMatriz} onClick={() => seleccionarSemana('sin-fecha')}>Turnos sin fecha</button>
              )}
            </div>
            <p style={{ margin: '12px 0 0' }} role="status">
              {cargando ? 'Cargando semana…' : matriz?.fechas?.length
                ? `Semana del ${fechaCorta(matriz.fechas[0])} al ${fechaCorta(matriz.fechas[6])}`
                : semana === 'sin-fecha' ? 'Turnos anteriores sin fecha asignada' : ''}
            </p>
            {esDireccion && matriz?.fechas?.length > 0 && matriz.estadisticas.totalTurnos === 0 && (
              <p style={{ marginBottom: 0 }}>Esta semana está vacía. Usa «Crear turno» para empezar a planificarla.</p>
            )}
          </section>
          {mensajeMatriz && <p role="status" className="portal-alert portal-alert-success">{mensajeMatriz}</p>}
          {errorMatriz && <p role="alert" className="portal-alert portal-alert-danger">{errorMatriz}</p>}
          {/* Leyenda de la matriz */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '16px', flexWrap: 'wrap', gap: '10px', fontSize: '0.82rem', color: '#7c8592'
          }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#e8f0e8', border: '1px solid #c7dfc7' }}></span>
                Turno Cubierto
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#fff9f4', border: '1px solid #f2dfbe' }}></span>
                Turno Descubierto (Vacante)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#fbeae8', border: '1px solid #f3c9c4' }}></span>
                <ShieldCheck size={14} aria-hidden="true" /> Tarea Crítica (Solo Avanzados)
              </span>
            </div>

            <div style={{ fontWeight: '700', color: '#1f2430' }}>
              Estado Planificación: <span style={{ color: matriz?.estadisticas?.planificacionConfirmada ? '#2f5540' : '#b37416' }}>
                {matriz?.estadisticas?.planificacionConfirmada ? <><CircleCheck size={14} aria-hidden="true" /> CONFIRMADA</> : <><ClipboardList size={14} aria-hidden="true" /> EN PLANIFICACIÓN (Borrador)</>}
              </span>
            </div>
          </div>

          {/* Matriz interactiva de turnos */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e9eaed', overflowX: 'auto', padding: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '10px', minWidth: '980px' }}>
              <thead>
                <tr>
                  <th style={{ width: '140px', padding: '10px', fontSize: '0.85rem', fontWeight: '800', color: '#7c8592', textAlign: 'center' }}>
                    Franja Horaria
                  </th>
                  {DIAS_MATRIZ.map((dia, indice) => (
                    <th key={dia} style={{ padding: '10px', fontSize: '0.9rem', fontWeight: '800', color: '#1f2430', textAlign: 'center' }}>
                      {dia}
                      {matriz?.fechas?.[indice] && <div style={{ color: 'var(--portal-text-muted)', fontWeight: 600 }}>{fechaCorta(matriz.fechas[indice])}</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FRANJAS_MATRIZ.map(({ nombre: franja, horario }) => (
                  <tr key={franja}>
                    <td style={{
                      verticalAlign: 'top', padding: '12px 8px', background: '#f8f9fa',
                      borderRadius: '10px', textAlign: 'center', border: '1px solid #e9eaed'
                    }}>
                      <div style={{ fontWeight: '800', color: '#1f2430', fontSize: '0.9rem' }}>{franja}</div>
                      <div style={{ fontSize: '0.74rem', color: '#7c8592', marginTop: '4px' }}>
                        {horario}
                      </div>
                    </td>

                    {DIAS_MATRIZ.map(dia => {
                      const turnosDia = (matriz?.turnosPorFranja?.[franja]?.[dia] || []);

                      return (
                        <td key={dia} style={{ verticalAlign: 'top', minWidth: '135px' }}>
                          {turnosDia.length === 0 ? (
                            puedeCrearTurno ? (
                              <button
                                type="button"
                                className="portal-turno-vacio"
                                aria-label={`Crear turno para ${dia}, ${franja}`}
                                onClick={() => abrirCrearTurno(dia, franja)}
                              >
                                <Plus size={14} aria-hidden="true" /> Sin turnos
                              </button>
                            ) : (
                              <div className="portal-turno-vacio">Sin turnos</div>
                            )
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {turnosDia.map(turno => {
                                const inscritos = turno.inscripciones || [];
                                const estaCubierto = inscritos.length > 0;
                                const cuposDisponibles = turno.cupoMaximo - inscritos.length;
                                const lleno = cuposDisponibles <= 0;
                                const usuarioInscrito = inscritos.some(i => i.usuarioId === user?.id);

                                // Validar tareas críticas
                                const esCritico = turno.esCritica ||
                                  turno.area.toLowerCase().includes('veterinaria') ||
                                  turno.area.toLowerCase().includes('clínica');

                                const puedeInscribirsePorRol = !esCritico || esAvanzado;

                                // Validar cruce de horario
                                const tieneCruce = !usuarioInscrito && turnos.some(t =>
                                  t.id !== turno.id &&
                                  (turno.fecha ? fechaCorta(t.fecha) === fechaCorta(turno.fecha) : !t.fecha && t.diaSemana === turno.diaSemana) &&
                                  t.franja === turno.franja &&
                                  (t.inscripciones || []).some(i => i.usuarioId === user?.id)
                                );

                                return (
                                  <div
                                    key={turno.id}
                                    style={{
                                      padding: '12px', borderRadius: '10px', border: `1.5px solid ${usuarioInscrito ? '#3f6c52' : (esCritico ? '#f3c9c4' : (estaCubierto ? '#c7dfc7' : '#f2dfbe'))}`,
                                      background: usuarioInscrito ? '#eef3ec' : (esCritico ? '#fff8f7' : (estaCubierto ? '#ffffff' : '#fffdf9')),
                                      boxShadow: '0 2px 5px rgba(0,0,0,0.03)', position: 'relative'
                                    }}
                                  >
                                    {/* Cabecera del Turno */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                                      <div style={{ fontWeight: '800', fontSize: '0.84rem', color: '#1f2430' }}>
                                        {turno.area}
                                      </div>
                                      {esCritico && (
                                        <span title="Tarea Crítica: Reservada a Personal Avanzado">
                                          <ShieldCheck size={14} aria-hidden="true" />
                                        </span>
                                      )}
                                    </div>

                                    {/* Aforo / Cupo */}
                                    <div style={{ fontSize: '0.74rem', color: lleno ? '#d1453b' : '#7c8592', fontWeight: '700', marginBottom: '8px' }}>
                                      Aforo: {inscritos.length} / {turno.cupoMaximo} {lleno ? '(Lleno)' : `(${cuposDisponibles} disp.)`}
                                    </div>

                                    {/* Lista de voluntarios inscritos */}
                                    <div style={{ marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      {inscritos.length === 0 ? (
                                        <div style={{ fontSize: '0.74rem', color: '#b37416', fontWeight: '700', fontStyle: 'italic' }}>
                                          <TriangleAlert size={13} aria-hidden="true" /> Turno Descubierto
                                        </div>
                                      ) : (
                                        inscritos.map(ins => (
                                          <div
                                            key={ins.id}
                                            style={{
                                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                              padding: '4px 6px', background: ins.usuarioId === user?.id ? '#dbeadb' : '#f0f1f3',
                                              borderRadius: '6px', fontSize: '0.74rem', fontWeight: '700'
                                            }}
                                          >
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                              {ins.usuarioId === user?.id ? <><User size={12} aria-hidden="true" /> Tú</> : ins.usuario.nombre}
                                            </span>
                                            {esDireccion && (
                                              <button
                                                onClick={() => handleDesinscribirse(turno.id, ins.usuarioId)}
                                                title="Quitar del turno"
                                                style={{ background: 'transparent', border: 'none', color: '#d1453b', cursor: 'pointer', fontSize: '0.75rem', padding: '0 2px' }}
                                              >
                                                ✕
                                              </button>
                                            )}
                                          </div>
                                        ))
                                      )}
                                    </div>

                                    {/* Botón de Autogestión Individual de Inscripción */}
                                    <div>
                                      {usuarioInscrito ? (
                                        <button
                                          onClick={() => handleDesinscribirse(turno.id)}
                                          style={{
                                            width: '100%', background: '#fbeae8', border: '1px solid #f3c9c4',
                                            color: '#d1453b', padding: '6px', borderRadius: '6px', fontSize: '0.75rem',
                                            fontWeight: '700', cursor: 'pointer'
                                          }}
                                        >
                                          Cancelar mi inscripción
                                        </button>
                                      ) : tieneCruce ? (
                                        <div style={{ fontSize: '0.7rem', color: '#d1453b', fontWeight: '700', textAlign: 'center' }}>
                                          <Ban size={12} aria-hidden="true" /> Cruce de horario
                                        </div>
                                      ) : !puedeInscribirsePorRol ? (
                                        <div style={{ fontSize: '0.7rem', color: '#b37416', fontWeight: '700', textAlign: 'center' }}>
                                          <Lock size={12} aria-hidden="true" /> Solo Personal Avanzado
                                        </div>
                                      ) : lleno ? (
                                        <div style={{ fontSize: '0.7rem', color: '#7c8592', fontWeight: '600', textAlign: 'center' }}>
                                          Cupo Lleno
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => handleInscribirse(turno)}
                                          style={{
                                            width: '100%', background: '#3f6c52', border: 'none',
                                            color: '#fff', padding: '6px', borderRadius: '6px', fontSize: '0.75rem',
                                            fontWeight: '800', cursor: 'pointer'
                                          }}
                                        >
                                          <Plus size={14} aria-hidden="true" /> Inscribirme
                                        </button>
                                      )}
                                    </div>

                                    {/* Opción de asignación directa para Dirección */}
                                    {esDireccion && !lleno && (
                                      <button
                                        onClick={() => {
                                          setTurnoSeleccionado(turno);
                                          setModalAsignarCoordOpen(true);
                                        }}
                                        style={{
                                          width: '100%', marginTop: '6px', background: 'transparent',
                                          border: '1px dashed #7c8592', color: '#57606a', padding: '4px',
                                          borderRadius: '6px', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer'
                                        }}
                                      >
                                        Asignar a otro...
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '16px' }}>
            <button
              type="button"
              onClick={handleExportarMatriz}
              disabled={!matriz || cargando || exportandoMatriz}
              className="portal-btn portal-btn-secondary"
            >
              <Download size={15} aria-hidden="true" />
              {exportandoMatriz ? 'Preparando imagen…' : 'Descargar matriz como PNG'}
            </button>
            {esDireccion && matriz?.fechas?.length > 0 && (
              <button
                type="button"
                className="portal-btn portal-btn-secondary"
                disabled={cargando || gestionandoMatriz || !matriz.estadisticas.totalTurnos || matriz.estadisticas.planificacionConfirmada}
                onClick={() => gestionarMatriz(true)}
              >
                Limpiar matriz
              </button>
            )}
            {esDireccion && matriz?.fechas?.length > 0 && (
              <button
                type="button"
                onClick={() => gestionarMatriz(false)}
                disabled={cargando || gestionandoMatriz || !matriz.estadisticas.totalTurnos || matriz.estadisticas.planificacionConfirmada}
                className="portal-btn portal-btn-primary"
                style={{ marginLeft: 'auto' }}
              >
                <Lock size={15} aria-hidden="true" /> Confirmar planificación semanal
              </button>
            )}
          </div>
          {errorExportacion && <p role="alert" className="portal-alert portal-alert-danger">{errorExportacion}</p>}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 2: GESTIÓN DE PERMUTAS DE TURNOS                        */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {tabActual === 'permutas' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1f2430', margin: 0 }}>
              Permutas de Turnos (Aprobadas por Ambas Partes)
            </h3>
            <button
              onClick={() => {
                if (misTurnos.length === 0) return avisar('Debes tener al menos un turno asignado para solicitar una permuta.');
                setModalPermutaOpen(true);
              }}
              style={{
                background: '#3f6c52', color: '#fff', border: 'none', borderRadius: '8px',
                padding: '8px 16px', fontWeight: '700', fontSize: '0.84rem', cursor: 'pointer'
              }}
            >
              + Nueva Solicitud de Permuta
            </button>
          </div>

          {permutas.length === 0 ? (
            <div style={{ background: '#fff', padding: '40px', textAlign: 'center', color: '#7c8592', borderRadius: '12px', border: '1px solid #e9eaed' }}>
              No existen solicitudes de permuta registradas.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {permutas.map(p => {
                const soyDestinatario = p.destinatarioId === user?.id;
                const soySolicitante = p.solicitanteId === user?.id;
                const pendiente = p.estado === 'PENDIENTE';

                return (
                  <div
                    key={p.id}
                    style={{
                      background: '#fff', borderRadius: '12px', border: '1px solid #e9eaed',
                      padding: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      flexWrap: 'wrap', gap: '14px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: '800', fontSize: '0.94rem', color: '#1f2430' }}>
                          {p.solicitante.nombre} ➔ {p.destinatario.nombre}
                        </span>
                        <span style={{
                          padding: '3px 8px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '800',
                          background: p.estado === 'APROBADA' ? '#e8f0e8' : (p.estado === 'RECHAZADA' ? '#fbeae8' : '#fff4e5'),
                          color: p.estado === 'APROBADA' ? '#2f5540' : (p.estado === 'RECHAZADA' ? '#d1453b' : '#b37416')
                        }}>
                          {p.estado}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.82rem', color: '#57606a', marginTop: '6px' }}>
                        <strong>Turno ofrecido:</strong> {etiquetaTurno(p.turnoOrigen)} ({p.turnoOrigen.franja}) en {p.turnoOrigen.area}
                        {p.turnoDestino && <span> · <strong>Turno solicitado:</strong> {etiquetaTurno(p.turnoDestino)} ({p.turnoDestino.franja}) en {p.turnoDestino.area}</span>}
                      </div>

                      <div style={{ fontSize: '0.78rem', color: '#7c8592', marginTop: '4px', fontStyle: 'italic' }}>
                        Motivo: "{p.motivo}"
                      </div>
                    </div>

                    {/* Acciones de resolución para la persona destinataria y Dirección */}
                    <div>
                      {pendiente && (soyDestinatario || esDireccion) ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleResponderPermuta(p.id, 'APROBAR')}
                            style={{
                              background: '#3f6c52', color: '#fff', border: 'none', borderRadius: '6px',
                              padding: '8px 14px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer'
                            }}
                          >
                            <CircleCheck size={15} aria-hidden="true" /> Aprobar Permuta
                          </button>
                          <button
                            onClick={() => handleResponderPermuta(p.id, 'RECHAZAR')}
                            style={{
                              background: '#fbeae8', color: '#d1453b', border: '1px solid #f3c9c4', borderRadius: '6px',
                              padding: '8px 14px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer'
                            }}
                          >
                            <CircleX size={15} aria-hidden="true" /> Rechazar
                          </button>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.8rem', color: '#7c8592', fontWeight: '600' }}>
                          {pendiente ? <><Clock size={13} aria-hidden="true" /> Esperando aprobación de {p.destinatario.nombre}</> : `Resuelto el ${new Date(p.fechaResolucion || p.fechaSolicitud).toLocaleDateString()}`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 3: BITÁCORA DE TURNOS (INSCRIPCIÓN PREVIA OBLIGATORIA) */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {tabActual === 'bitacora' && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1f2430', margin: 0 }}>
              Bitácora Operativa de Servicio
            </h3>
            <p style={{ color: '#7c8592', fontSize: '0.86rem', margin: '4px 0 0' }}>
              La bitácora se habilita exclusivamente para voluntarios con <strong>inscripción previa obligatoria</strong> y turnos confirmados.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Mis turnos para registrar bitácora */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e9eaed', padding: '20px' }}>
              <div style={{ fontWeight: '800', fontSize: '1rem', color: '#1f2430', marginBottom: '14px' }}>
                <ClipboardList size={16} aria-hidden="true" /> Mis Turnos Confirmados
              </div>

              {misTurnos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#7c8592', fontSize: '0.88rem' }}>
                  No tienes turnos confirmados asignados actualmente. Inscríbete en la Matriz Semanal para habilitar el registro en la bitácora.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {misTurnos.map(t => (
                    <div
                      key={t.id}
                      style={{
                        padding: '14px', borderRadius: '10px', border: '1px solid #e9eaed',
                        background: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '800', color: '#1f2430', fontSize: '0.9rem' }}>
                          {t.area}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#7c8592' }}>
                          {etiquetaTurno(t)} · {t.franja} ({t.horaInicio} - {t.horaFin})
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setTurnoSeleccionado(t);
                          setModalBitacoraOpen(true);
                        }}
                        style={{
                          background: '#3f6c52', color: '#fff', border: 'none', borderRadius: '6px',
                          padding: '8px 14px', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer'
                        }}
                      >
                        + Llenar Bitácora
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Historial de Bitácoras Registradas */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e9eaed', padding: '20px' }}>
              <div style={{ fontWeight: '800', fontSize: '1rem', color: '#1f2430', marginBottom: '14px' }}>
                <BookOpen size={16} aria-hidden="true" /> Registros Recientes en Bitácora
              </div>

              {turnos.flatMap(t => t.bitacoras || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#7c8592', fontSize: '0.88rem' }}>
                  Aún no hay notas registradas en la bitácora de la semana.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
                  {turnos.flatMap(t => (t.bitacoras || []).map(b => ({ ...b, turnoArea: t.area, turnoDia: etiquetaTurno(t) }))).map((b, i) => (
                    <div key={i} style={{ padding: '12px', borderRadius: '8px', background: '#f8f9fa', border: '1px solid #e9eaed' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: '800', color: '#1f2430' }}>
                        <span>{b.usuario?.nombre || 'Voluntario'}</span>
                        <span style={{ color: '#7c8592', fontWeight: '600' }}>{new Date(b.fechaHora).toLocaleDateString()}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#3f6c52', fontWeight: '700', marginTop: '2px' }}>
                        {b.turnoDia} · {b.turnoArea}
                      </div>
                      <div style={{ fontSize: '0.84rem', color: '#1f2430', marginTop: '6px' }}>
                        {b.tareasRealizadas}
                      </div>
                      {b.incidentes && (
                        <div style={{ fontSize: '0.78rem', color: '#d1453b', marginTop: '4px', fontWeight: '600' }}>
                          <TriangleAlert size={13} aria-hidden="true" /> Incidente: {b.incidentes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 4: DIRECTORIO DE VOLUNTARIOS                           */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {tabActual === 'directorio' && (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e9eaed', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #e9eaed' }}>
                <th style={{ padding: '14px 18px', fontWeight: '800', color: '#1f2430' }}>Nombre y Contacto</th>
                <th style={{ padding: '14px 18px', fontWeight: '800', color: '#1f2430' }}>Rango Operativo</th>
                <th style={{ padding: '14px 18px', fontWeight: '800', color: '#1f2430' }}>Turnos Confirmados</th>
                <th style={{ padding: '14px 18px', fontWeight: '800', color: '#1f2430' }}>Áreas Asignadas</th>
              </tr>
            </thead>
            <tbody>
              {directorio.map(v => (
                <tr key={v.id} style={{ borderBottom: '1px solid #f0f1f3' }}>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ fontWeight: '800', color: '#1f2430' }}>{v.nombre}</div>
                    <div style={{ fontSize: '0.78rem', color: '#7c8592' }}>{v.email}</div>
                  </td>

                  <td style={{ padding: '14px 18px' }}>
                    <span style={{
                      padding: '4px 8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '700',
                      background: v.esAvanzado ? '#e8f0e8' : '#f0f1f3',
                      color: v.esAvanzado ? '#2f5540' : '#57606a'
                    }}>
                      {v.rolEtiqueta}
                    </span>
                  </td>

                  <td style={{ padding: '14px 18px', fontWeight: '800', color: '#1f2430' }}>
                    {v.turnosAsignadosCount} turno(s)
                  </td>

                  <td style={{ padding: '14px 18px' }}>
                    {v.turnos && v.turnos.length > 0 ? (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {v.turnos.map((t, idx) => (
                          <span key={idx} style={{ padding: '3px 6px', background: '#eef3ec', color: '#2f5540', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700' }}>
                            {etiquetaTurno(t)} ({t.area})
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: '#a3aab5', fontSize: '0.8rem' }}>Sin turnos asignados</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: REGISTRAR EN BITÁCORA */}
      {modalBitacoraOpen && turnoSeleccionado && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{ background: '#fff', borderRadius: '16px', maxWidth: '500px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1f2430', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <ClipboardList size={19} aria-hidden="true" /> Bitácora de Turno
            </h3>
            <p style={{ fontSize: '0.84rem', color: '#7c8592', marginBottom: '16px' }}>
              Turno: <strong>{turnoSeleccionado.area}</strong> ({turnoSeleccionado.diaSemana} · {turnoSeleccionado.franja})
            </p>

            <form onSubmit={handleGuardarBitacora}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                  Tareas Realizadas *
                </label>
                <textarea
                  rows="4"
                  required
                  placeholder="Describa las actividades, animales atendidos, rondas..."
                  value={formBitacora.tareasRealizadas}
                  onChange={e => setFormBitacora(prev => ({ ...prev, tareasRealizadas: e.target.value }))}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                  Incidentes o Novedades (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Canil 4 con cerrojo trabado, animal con rechazo a comida..."
                  value={formBitacora.incidentes}
                  onChange={e => setFormBitacora(prev => ({ ...prev, incidentes: e.target.value }))}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                  Observaciones Generales
                </label>
                <input
                  type="text"
                  placeholder="Notas adicionales..."
                  value={formBitacora.observaciones}
                  onChange={e => setFormBitacora(prev => ({ ...prev, observaciones: e.target.value }))}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalBitacoraOpen(false)}
                  style={{ background: '#f0f1f3', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: '700', cursor: 'pointer', color: '#57606a' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ background: '#3f6c52', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: '800', cursor: 'pointer' }}
                >
                  Confirmar Bitácora
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SOLICITAR PERMUTA */}
      {modalPermutaOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{ background: '#fff', borderRadius: '16px', maxWidth: '500px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1f2430', marginBottom: '14px' }}>
              ⇄ Solicitar Permuta de Turno
            </h3>

            <form onSubmit={handleSolicitarPermuta}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                  Turno que ofreces permutar *
                </label>
                <select
                  value={formPermuta.turnoOrigenId}
                  onChange={e => setFormPermuta(prev => ({ ...prev, turnoOrigenId: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                >
                  {misTurnos.map(t => (
                    <option key={t.id} value={t.id}>
                      {etiquetaTurno(t)} ({t.franja}) — {t.area}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                  Voluntario Destinatario *
                </label>
                <select
                  value={formPermuta.destinatarioId}
                  onChange={e => setFormPermuta(prev => ({ ...prev, destinatarioId: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                >
                  <option value="">— Seleccionar voluntario —</option>
                  {directorio.filter(v => v.id !== user?.id).map(v => (
                    <option key={v.id} value={v.id}>
                      {v.nombre} ({v.rolEtiqueta})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                  Motivo de la Permuta *
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="Explica la razón de la solicitud..."
                  value={formPermuta.motivo}
                  onChange={e => setFormPermuta(prev => ({ ...prev, motivo: e.target.value }))}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalPermutaOpen(false)}
                  style={{ background: '#f0f1f3', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: '700', cursor: 'pointer', color: '#57606a' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ background: '#3f6c52', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: '800', cursor: 'pointer' }}
                >
                  Enviar Solicitud
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASIGNAR VOLUNTARIO DIRECTAMENTE (DIRECCIÓN) */}
      {modalAsignarCoordOpen && turnoSeleccionado && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{ background: '#fff', borderRadius: '16px', maxWidth: '440px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1f2430', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Crown size={18} aria-hidden="true" /> Asignar Voluntario a Turno
            </h3>
            <p style={{ fontSize: '0.84rem', color: '#7c8592', marginBottom: '14px' }}>
              Turno: <strong>{turnoSeleccionado.area}</strong> ({turnoSeleccionado.diaSemana} · {turnoSeleccionado.franja})
            </p>

            <form onSubmit={handleAsignarTurno}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '6px' }}>
                  Seleccionar Voluntario *
                </label>
                <select
                  value={voluntarioAAsignarId}
                  onChange={e => setVoluntarioAAsignarId(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                >
                  <option value="">— Elegir del directorio —</option>
                  {directorio.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.nombre} ({v.rolEtiqueta})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalAsignarCoordOpen(false)}
                  style={{ background: '#f0f1f3', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: '700', cursor: 'pointer', color: '#57606a' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ background: '#3f6c52', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: '800', cursor: 'pointer' }}
                >
                  Confirmar Asignación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREAR TURNO (DIRECCIÓN) */}
      {modalTurnoOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{ background: '#fff', borderRadius: '16px', maxWidth: '480px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1f2430', marginBottom: '14px' }}>
              + Crear Turno en Matriz
            </h3>

            <form onSubmit={handleCrearTurno}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                    Día de la Semana *
                  </label>
                  <select
                    value={formTurno.diaSemana}
                    onChange={e => setFormTurno(prev => ({ ...prev, diaSemana: e.target.value }))}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                  >
                    {DIAS_MATRIZ.map((d, indice) => (
                      <option key={d} value={d}>{d} {fechaCorta(matriz?.fechas?.[indice])}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                    Franja Horaria *
                  </label>
                  <select
                    value={formTurno.franja}
                    onChange={e => setFormTurno(prev => ({ ...prev, franja: e.target.value }))}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                  >
                    {FRANJAS_MATRIZ.map(({ nombre, horario }) => (
                      <option key={nombre} value={nombre}>{nombre} ({horario})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                  Área de Servicio *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Paseos, Limpieza, Atención Veterinaria..."
                  value={formTurno.area}
                  onChange={e => setFormTurno(prev => ({ ...prev, area: e.target.value }))}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                    Cupo Máximo (Aforo) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formTurno.cupoMaximo}
                    onChange={e => setFormTurno(prev => ({ ...prev, cupoMaximo: Number(e.target.value) }))}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '22px' }}>
                  <input
                    type="checkbox"
                    id="chkCritica"
                    checked={formTurno.esCritica}
                    onChange={e => setFormTurno(prev => ({ ...prev, esCritica: e.target.checked }))}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <label htmlFor="chkCritica" style={{ fontSize: '0.84rem', fontWeight: '700', color: '#1f2430', cursor: 'pointer' }}>
                    Tarea Crítica (Avanzados)
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalTurnoOpen(false)}
                  style={{ background: '#f0f1f3', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: '700', cursor: 'pointer', color: '#57606a' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ background: '#3f6c52', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: '800', cursor: 'pointer' }}
                >
                  Crear Turno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
