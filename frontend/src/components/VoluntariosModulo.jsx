import React, { useState, useEffect } from 'react';
import { API_URL, getAuthHeaders } from '../api/config';

export default function VoluntariosModulo({ user }) {
  const [tabActual, setTabActual] = useState('matriz'); // 'matriz' | 'permutas' | 'bitacora' | 'directorio'
  const [matriz, setMatriz] = useState(null);
  const [turnos, setTurnos] = useState([]);
  const [permutas, setPermutas] = useState([]);
  const [directorio, setDirectorio] = useState([]);
  const [alertasDescubiertos, setAlertasDescubiertos] = useState({ totalDescubiertos: 0, turnos: [] });
  const [cargando, setCargando] = useState(true);

  // Modales
  const [modalTurnoOpen, setModalTurnoOpen] = useState(false);
  const [modalPermutaOpen, setModalPermutaOpen] = useState(false);
  const [modalBitacoraOpen, setModalBitacoraOpen] = useState(false);
  const [modalAsignarCoordOpen, setModalAsignarCoordOpen] = useState(false);
  const [turnoSeleccionado, setTurnoSeleccionado] = useState(null);

  // Formulario Crear Turno (Coordinador)
  const [formTurno, setFormTurno] = useState({
    diaSemana: 'Lunes',
    franja: 'Mañana',
    area: 'Paseos',
    cupoMaximo: 2,
    esCritica: false,
    horaInicio: '08:00',
    horaFin: '13:00',
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

  // Formulario Asignación por Coordinador
  const [voluntarioAAsignarId, setVoluntarioAAsignarId] = useState('');

  const esCoordinador = ['DIRECTORA', 'COORDINADOR'].includes(user?.rol);
  const esAvanzado = ['DIRECTORA', 'COORDINADOR', 'VETERINARIA', 'VOLUNTARIO_AVANZADO'].includes(user?.rol);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [resMatriz, resTurnos, resPermutas, resDescubiertos, resDirectorio] = await Promise.all([
        fetch(`${API_URL}/turnos/matriz`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/turnos`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/turnos/permutas`, { headers: getAuthHeaders() }).catch(() => ({ ok: false })),
        fetch(`${API_URL}/turnos/alertas-descubiertos`, { headers: getAuthHeaders() }).catch(() => ({ ok: false })),
        fetch(`${API_URL}/turnos/directorio`, { headers: getAuthHeaders() }).catch(() => ({ ok: false }))
      ]);

      if (resMatriz.ok) {
        const dataMatriz = await resMatriz.json();
        setMatriz(dataMatriz);
      }
      if (resTurnos.ok) {
        const dataTurnos = await resTurnos.json();
        setTurnos(dataTurnos || []);
      }
      if (resPermutas && resPermutas.ok) {
        const dataPermutas = await resPermutas.json();
        setPermutas(dataPermutas || []);
      }
      if (resDescubiertos && resDescubiertos.ok) {
        const dataDesc = await resDescubiertos.json();
        setAlertasDescubiertos(dataDesc || { totalDescubiertos: 0, turnos: [] });
      }
      if (resDirectorio && resDirectorio.ok) {
        const dataDir = await resDirectorio.json();
        setDirectorio(dataDir || []);
      }
    } catch (e) {
      console.error('Error al cargar datos de turnos:', e);
    } finally {
      setCargando(false);
    }
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
        throw new Error(data.error || 'Error al inscribirse en el turno');
      }
      alert(`¡Inscripción exitosa! Quedas asignado al turno de ${turno.area} (${turno.diaSemana} - ${turno.franja}).`);
      cargarDatos();
    } catch (err) {
      alert(err.message);
    }
  };

  // 2. Desinscribirse de un Turno
  const handleDesinscribirse = async (turnoId, usuarioId = null) => {
    if (!window.confirm('¿Confirmas que deseas cancelar esta inscripción al turno?')) return;
    try {
      const query = usuarioId ? `?usuarioId=${usuarioId}` : '';
      const res = await fetch(`${API_URL}/turnos/${turnoId}/desinscribirse${query}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al cancelar inscripción');
      }
      alert('Inscripción cancelada.');
      cargarDatos();
    } catch (err) {
      alert(err.message);
    }
  };

  // 3. Asignación directa por parte del Coordinador
  const handleAsignarPorCoordinador = async (e) => {
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
        throw new Error(data.error || 'Error al asignar voluntario');
      }
      alert('Voluntario asignado al turno por el Coordinador.');
      setModalAsignarCoordOpen(false);
      setVoluntarioAAsignarId('');
      cargarDatos();
    } catch (err) {
      alert(err.message);
    }
  };

  // 4. Confirmar Planificación Semanal (Coordinador)
  const handleConfirmarPlanificacion = async () => {
    if (!window.confirm('¿Confirmar la planificación semanal de turnos? Esto fijará la matriz y habilitará la bitácora operativa.')) return;
    try {
      const res = await fetch(`${API_URL}/turnos/confirmar-planificacion`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al confirmar planificación');
      }
      alert(data.mensaje);
      cargarDatos();
    } catch (err) {
      alert(err.message);
    }
  };

  // 5. Crear Turno (Coordinador)
  const handleCrearTurno = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/turnos`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formTurno)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al crear turno');
      }
      alert('Nuevo turno añadido a la matriz semanal');
      setModalTurnoOpen(false);
      cargarDatos();
    } catch (err) {
      alert(err.message);
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
        throw new Error(data.error || 'Error al solicitar permuta');
      }
      alert('Solicitud de permuta enviada. Se encuentra pendiente de validación y aprobación por el compañero destinatario.');
      setModalPermutaOpen(false);
      cargarDatos();
    } catch (err) {
      alert(err.message);
    }
  };

  // 7. Responder a Permuta (Aprobar / Rechazar)
  const handleResponderPermuta = async (permutaId, accion) => {
    const confirmacion = window.confirm(`¿Confirmas que deseas ${accion === 'APROBAR' ? 'APROBAR' : 'RECHAZAR'} esta permuta de turno?`);
    if (!confirmacion) return;

    try {
      const res = await fetch(`${API_URL}/turnos/permutas/${permutaId}/responder`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ accion, observacion: `Respuesta de permuta: ${accion}` })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar respuesta');
      }
      alert(accion === 'APROBAR' ? '¡Permuta aprobada por ambas partes! Los turnos fueron intercambiados automáticamente en la matriz.' : 'Permuta rechazada.');
      cargarDatos();
    } catch (err) {
      alert(err.message);
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
        throw new Error(data.error || 'Error al registrar bitácora');
      }
      alert('Registro de asistencia y bitácora guardado exitosamente.');
      setModalBitacoraOpen(false);
      setFormBitacora({ tareasRealizadas: '', incidentes: '', observaciones: '' });
      cargarDatos();
    } catch (err) {
      alert(err.message);
    }
  };

  // Mis turnos asignados
  const misTurnos = turnos.filter(t => (t.inscripciones || []).some(i => i.usuarioId === user?.id));

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '28px 24px' }}>
      {/* ENCABEZADO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.8rem' }}>🤝</span>
            <h2 style={{ fontSize: '1.65rem', fontWeight: '800', color: '#1f2430', margin: 0 }}>
              Voluntarios y Matriz de Turnos
            </h2>
          </div>
          <p style={{ color: '#7c8592', fontSize: '0.9rem', margin: '6px 0 0' }}>
            Matriz interactiva semanal, autogestión de inscripciones, validación de permutas por ambas partes y bitácora de servicio.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Rol del usuario */}
          <div style={{
            padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700',
            background: esCoordinador ? '#edf4fc' : (esAvanzado ? '#e8f0e8' : '#f0f1f3'),
            color: esCoordinador ? '#3478c4' : (esAvanzado ? '#2f5540' : '#57606a'),
            border: `1px solid ${esCoordinador ? '#cbe0f8' : (esAvanzado ? '#c7dfc7' : '#dcdfe4')}`
          }}>
            {esCoordinador ? '👑 Rol: Coordinador de Matriz' : (esAvanzado ? '⭐ Personal Avanzado Habilitado' : '🌱 Voluntario Novato')}
          </div>

          {/* Botones de acción del Coordinador */}
          {esCoordinador && (
            <>
              <button
                onClick={handleConfirmarPlanificacion}
                style={{
                  background: '#3f6c52', color: '#fff', border: 'none', borderRadius: '8px',
                  padding: '10px 16px', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <span>🔒</span> Confirmar Planificación Semanal
              </button>

              <button
                onClick={() => setModalTurnoOpen(true)}
                style={{
                  background: '#ffffff', color: '#1f2430', border: '1.5px solid #dcdfe4', borderRadius: '8px',
                  padding: '10px 16px', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <span>+</span> Crear Turno
              </button>
            </>
          )}

          <button
            onClick={() => {
              if (misTurnos.length === 0) return alert('Debes tener al menos un turno asignado para solicitar una permuta.');
              setFormPermuta({
                turnoOrigenId: misTurnos[0].id,
                destinatarioId: '',
                turnoDestinoId: '',
                motivo: ''
              });
              setModalPermutaOpen(true);
            }}
            style={{
              background: '#ffffff', color: '#3f6c52', border: '1.5px solid #3f6c52', borderRadius: '8px',
              padding: '10px 16px', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer'
            }}
          >
            ⇄ Solicitar Permuta
          </button>
        </div>
      </div>

      {/* BANNER DE ALERTAS DE TURNOS DESCUBIERTOS EN TIEMPO REAL */}
      {alertasDescubiertos.totalDescubiertos > 0 && (
        <div style={{
          background: '#fff9f4', border: '1.5px solid #f2dfbe', borderRadius: '12px',
          padding: '16px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '1.6rem' }}>📢</span>
            <div>
              <div style={{ fontWeight: '800', color: '#b37416', fontSize: '0.96rem' }}>
                Alerta de Cobertura: {alertasDescubiertos.totalDescubiertos} turno(s) descubiertos requieren atención
              </div>
              <div style={{ fontSize: '0.84rem', color: '#7c8592', marginTop: '2px' }}>
                Turnos sin voluntarios asignados esta semana: {alertasDescubiertos.turnos.slice(0, 3).map(t => `${t.diaSemana} (${t.area})`).join(', ')}...
              </div>
            </div>
          </div>
          <span style={{
            padding: '6px 12px', borderRadius: '8px', background: '#faf1de',
            color: '#b37416', fontWeight: '800', fontSize: '0.8rem', border: '1px solid #f2dfbe'
          }}>
            Inscripción Abierta
          </span>
        </div>
      )}

      {/* TABS DE SECCIÓN */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e9eaed', marginBottom: '24px' }}>
        {[
          { key: 'matriz', label: '📅 Matriz Semanal Interactiva', count: null },
          { key: 'permutas', label: '⇄ Gestión de Permutas', count: permutas.filter(p => p.estado === 'PENDIENTE' && p.destinatarioId === user?.id).length },
          { key: 'bitacora', label: '📝 Bitácora de Turnos', count: misTurnos.length },
          { key: 'directorio', label: '👥 Directorio de Voluntarios', count: directorio.length }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setTabActual(tab.key)}
            style={{
              padding: '12px 18px', background: 'transparent', border: 'none',
              borderBottom: tabActual === tab.key ? '3px solid #3f6c52' : '3px solid transparent',
              color: tabActual === tab.key ? '#3f6c52' : '#7c8592',
              fontWeight: '800', fontSize: '0.92rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <span>{tab.label}</span>
            {tab.count !== null && tab.count > 0 && (
              <span style={{
                background: '#d1453b', color: '#fff', fontSize: '0.72rem', padding: '2px 7px',
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
                🛡️ Tarea Crítica (Solo Avanzados)
              </span>
            </div>

            <div style={{ fontWeight: '700', color: '#1f2430' }}>
              Estado Planificación: <span style={{ color: matriz?.estadisticas?.planificacionConfirmada ? '#2f5540' : '#b37416' }}>
                {matriz?.estadisticas?.planificacionConfirmada ? '✅ CONFIRMADA' : '📝 EN PLANIFICACIÓN (Borrador)'}
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
                  {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(dia => (
                    <th key={dia} style={{ padding: '10px', fontSize: '0.9rem', fontWeight: '800', color: '#1f2430', textAlign: 'center' }}>
                      {dia}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['Mañana', 'Tarde'].map(franja => (
                  <tr key={franja}>
                    <td style={{
                      verticalAlign: 'top', padding: '12px 8px', background: '#f8f9fa',
                      borderRadius: '10px', textAlign: 'center', border: '1px solid #e9eaed'
                    }}>
                      <div style={{ fontWeight: '800', color: '#1f2430', fontSize: '0.9rem' }}>{franja}</div>
                      <div style={{ fontSize: '0.74rem', color: '#7c8592', marginTop: '4px' }}>
                        {franja === 'Mañana' ? '08:00 - 13:00' : '14:00 - 19:00'}
                      </div>
                    </td>

                    {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(dia => {
                      const turnosDia = (matriz?.turnosPorFranja?.[franja]?.[dia] || []);

                      return (
                        <td key={dia} style={{ verticalAlign: 'top', minWidth: '135px' }}>
                          {turnosDia.length === 0 ? (
                            <div style={{
                              padding: '16px 8px', textAlign: 'center', color: '#a3aab5',
                              border: '1px dashed #dcdfe4', borderRadius: '10px', fontSize: '0.78rem'
                            }}>
                              Sin turnos
                            </div>
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
                                  t.diaSemana === turno.diaSemana &&
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
                                        <span title="Tarea Crítica: Reservada a Personal Avanzado" style={{ fontSize: '0.8rem' }}>
                                          🛡️
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
                                          ⚠️ Turno Descubierto
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
                                              {ins.usuarioId === user?.id ? '👤 Tú' : ins.usuario.nombre}
                                            </span>
                                            {esCoordinador && (
                                              <button
                                                onClick={() => handleDesinscribirse(turno.id, ins.usuarioId)}
                                                title="Remover voluntario (Coordinador)"
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
                                          ⛔ Cruce de horario
                                        </div>
                                      ) : !puedeInscribirsePorRol ? (
                                        <div style={{ fontSize: '0.7rem', color: '#b37416', fontWeight: '700', textAlign: 'center' }}>
                                          🔒 Solo Personal Avanzado
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
                                          + Inscribirme
                                        </button>
                                      )}
                                    </div>

                                    {/* Opción de asignación extra para el Coordinador */}
                                    {esCoordinador && !lleno && (
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
                if (misTurnos.length === 0) return alert('Debes tener al menos un turno asignado para solicitar una permuta.');
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
                        <strong>Turno ofrecido:</strong> {p.turnoOrigen.diaSemana} ({p.turnoOrigen.franja}) en {p.turnoOrigen.area}
                        {p.turnoDestino && <span> · <strong>Turno solicitado:</strong> {p.turnoDestino.diaSemana} ({p.turnoDestino.franja}) en {p.turnoDestino.area}</span>}
                      </div>

                      <div style={{ fontSize: '0.78rem', color: '#7c8592', marginTop: '4px', fontStyle: 'italic' }}>
                        Motivo: "{p.motivo}"
                      </div>
                    </div>

                    {/* Acciones de resolución si soy destinatario o coordinador */}
                    <div>
                      {pendiente && (soyDestinatario || esCoordinador) ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleResponderPermuta(p.id, 'APROBAR')}
                            style={{
                              background: '#3f6c52', color: '#fff', border: 'none', borderRadius: '6px',
                              padding: '8px 14px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer'
                            }}
                          >
                            ✅ Aprobar Permuta
                          </button>
                          <button
                            onClick={() => handleResponderPermuta(p.id, 'RECHAZAR')}
                            style={{
                              background: '#fbeae8', color: '#d1453b', border: '1px solid #f3c9c4', borderRadius: '6px',
                              padding: '8px 14px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer'
                            }}
                          >
                            ❌ Rechazar
                          </button>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.8rem', color: '#7c8592', fontWeight: '600' }}>
                          {pendiente ? '⏳ Esperando aprobación de ' + p.destinatario.nombre : `Resuelto el ${new Date(p.fechaResolucion || p.fechaSolicitud).toLocaleDateString()}`}
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
                📋 Mis Turnos Confirmados
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
                          {t.diaSemana} · {t.franja} ({t.horaInicio} - {t.horaFin})
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
                📖 Registros Recientes en Bitácora
              </div>

              {turnos.flatMap(t => t.bitacoras || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#7c8592', fontSize: '0.88rem' }}>
                  Aún no hay notas registradas en la bitácora de la semana.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
                  {turnos.flatMap(t => (t.bitacoras || []).map(b => ({ ...b, turnoArea: t.area, turnoDia: t.diaSemana }))).map((b, i) => (
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
                          ⚠️ Incidente: {b.incidentes}
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
                      {v.rol}
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
                            {t.diaSemana} ({t.area})
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
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1f2430', marginBottom: '8px' }}>
              📝 Bitácora de Turno
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
                      {t.diaSemana} ({t.franja}) — {t.area}
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
                      {v.nombre} ({v.rol})
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

      {/* MODAL: ASIGNAR VOLUNTARIO DIRECTAMENTE (COORDINADOR) */}
      {modalAsignarCoordOpen && turnoSeleccionado && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{ background: '#fff', borderRadius: '16px', maxWidth: '440px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1f2430', marginBottom: '8px' }}>
              👑 Asignar Voluntario a Turno
            </h3>
            <p style={{ fontSize: '0.84rem', color: '#7c8592', marginBottom: '14px' }}>
              Turno: <strong>{turnoSeleccionado.area}</strong> ({turnoSeleccionado.diaSemana} · {turnoSeleccionado.franja})
            </p>

            <form onSubmit={handleAsignarPorCoordinador}>
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
                      {v.nombre} ({v.rol})
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

      {/* MODAL: CREAR TURNO (COORDINADOR) */}
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
                    {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => (
                      <option key={d} value={d}>{d}</option>
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
                    <option value="Mañana">Mañana (08:00 - 13:00)</option>
                    <option value="Tarde">Tarde (14:00 - 19:00)</option>
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
