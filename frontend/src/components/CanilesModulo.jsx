import React, { useState, useEffect } from 'react';
import { API_URL, getAuthHeaders } from '../api/config';

export default function CanilesModulo({ user }) {
  const [caniles, setCaniles] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [animales, setAnimales] = useState([]);
  const [traslados, setTraslados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState('mapa'); // 'mapa' | 'traslados' | 'solicitar'

  // Modal de Asignación / Reubicación de Canil
  const [modalCanilOpen, setModalCanilOpen] = useState(false);
  const [selectedCanil, setSelectedCanil] = useState(null);
  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [motivoMovimiento, setMotivoMovimiento] = useState('');
  const [estadoCanil, setEstadoCanil] = useState('OCUPADO');
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState(null);
  const [mensajeExito, setMensajeExito] = useState(null);

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

  useEffect(() => {
    cargarDatos();
  }, []);

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
    setSelectedCanil(canil);
    setSelectedAnimalId(canil.animalAlojado ? canil.animalAlojado.id.toString() : '');
    setEstadoCanil(canil.estado === 'LIBRE' ? 'OCUPADO' : canil.estado);
    setMotivoMovimiento('');
    setErrorModal(null);
    setModalCanilOpen(true);
  };

  const handleGuardarAsignacion = async (e) => {
    e.preventDefault();
    setErrorModal(null);

    if (!motivoMovimiento.trim()) {
      setErrorModal('El motivo del movimiento es obligatorio');
      return;
    }

    setGuardando(true);
    try {
      const body = {
        canilId: selectedCanil.id,
        animalId: selectedAnimalId ? parseInt(selectedAnimalId) : null,
        motivo: motivoMovimiento.trim(),
        estado: selectedAnimalId ? estadoCanil : 'LIBRE'
      };

      const res = await fetch(`${API_URL}/caniles/asignar`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar asignación');

      setMensajeExito(data.mensaje);
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

  const handleGestionarAprobacion = async (trasladoId, aprobar) => {
    const comentario = window.prompt(aprobar ? 'Comentario de aprobación (opcional):' : 'Motivo del rechazo:');
    if (!aprobar && !comentario) return;

    try {
      const res = await fetch(`${API_URL}/caniles/traslados/${trasladoId}/aprobacion`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ aprobar, comentario })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar aprobación');

      setMensajeExito(data.message);
      setTimeout(() => setMensajeExito(null), 4000);
      await cargarDatos();
    } catch (err) {
      alert(err.message);
    }
  };

  const esDirectora = user?.rol === 'DIRECTORA';

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '24px' }}>
      {/* ALERTA VISUAL DE SOBRECUPO (>90%) */}
      {resumen?.alertaSobrecupo && (
        <div style={{
          background: '#fbeae8', border: '2px solid #d1453b', borderRadius: '12px',
          padding: '16px 20px', marginBottom: '22px', display: 'flex', alignItems: 'center', gap: '14px',
          boxShadow: '0 4px 14px rgba(209,69,59,0.15)'
        }}>
          <span style={{ fontSize: '1.8rem' }}>🚨</span>
          <div>
            <strong style={{ color: '#d1453b', fontSize: '1.05rem', display: 'block' }}>
              ¡ALERTA CRÍTICA DE SOBRECUPO EN CANILES! Ocupación al {resumen.porcentajeOcupacion}%
            </strong>
            <span style={{ color: '#7c8592', fontSize: '0.86rem' }}>
              El refugio supera el 90% de capacidad operativa. Solo quedan {resumen.libres} caniles libres.
              Se recomienda priorizar traslados a protectoras aliadas o activar red de hogares temporales.
            </span>
          </div>
        </div>
      )}

      {mensajeExito && (
        <div style={{
          background: '#e8f0e8', border: '1px solid #3f6c52', color: '#2f5540',
          borderRadius: '9px', padding: '12px 18px', marginBottom: '18px', fontWeight: '600'
        }}>
          ✓ {mensajeExito}
        </div>
      )}

      {/* ENCABEZADO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#1f2430', margin: 0 }}>Módulo de Caniles y Traslados</h2>
          <p style={{ color: '#7c8592', fontSize: '0.88rem', margin: '4px 0 0' }}>
            Mapa visual de espacios, reubicaciones internas y traslados a protectoras / hogares temporales
          </p>
        </div>

        {/* Pestañas */}
        <div style={{ display: 'flex', gap: '8px', background: '#fff', padding: '4px', borderRadius: '10px', border: '1px solid #e9eaed' }}>
          <button
            onClick={() => setTab('mapa')}
            style={{
              padding: '8px 16px', borderRadius: '7px', border: 'none', fontWeight: '700', fontSize: '0.84rem', cursor: 'pointer',
              background: tab === 'mapa' ? '#3f6c52' : 'transparent', color: tab === 'mapa' ? '#fff' : '#7c8592'
            }}
          >
            🗺️ Mapa de Caniles
          </button>
          <button
            onClick={() => setTab('traslados')}
            style={{
              padding: '8px 16px', borderRadius: '7px', border: 'none', fontWeight: '700', fontSize: '0.84rem', cursor: 'pointer',
              background: tab === 'traslados' ? '#3f6c52' : 'transparent', color: tab === 'traslados' ? '#fff' : '#7c8592'
            }}
          >
            📋 Bitácora de Traslados
          </button>
          <button
            onClick={() => setTab('solicitar')}
            style={{
              padding: '8px 16px', borderRadius: '7px', border: 'none', fontWeight: '700', fontSize: '0.84rem', cursor: 'pointer',
              background: tab === 'solicitar' ? '#3f6c52' : 'transparent', color: tab === 'solicitar' ? '#fff' : '#7c8592'
            }}
          >
            ➕ Solicitar Traslado Externo
          </button>
        </div>
      </div>

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
            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#d1453b', marginTop: '4px' }}>{resumen.ocupados}</div>
            <span style={{ fontSize: '0.78rem', color: '#7c8592' }}>Con animal alojado</span>
          </div>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '16px 20px', border: '1px solid #e9eaed' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#7c8592', textTransform: 'uppercase' }}>En Cuarentena</span>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#d99a3d', marginTop: '4px' }}>{resumen.cuarentena}</div>
            <span style={{ fontSize: '0.78rem', color: '#7c8592' }}>Observación médica</span>
          </div>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '16px 20px', border: '1px solid #e9eaed' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#7c8592', textTransform: 'uppercase' }}>Ocupación Total</span>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: resumen.alertaSobrecupo ? '#d1453b' : '#1f2430', marginTop: '4px' }}>
              {resumen.porcentajeOcupacion}%
            </div>
            <span style={{ fontSize: '0.78rem', color: resumen.alertaSobrecupo ? '#d1453b' : '#7c8592' }}>
              {resumen.alertaSobrecupo ? '⚠️ > 90% (Sobrecupo)' : 'Operación normal'}
            </span>
          </div>
        </div>
      )}

      {/* CONTENIDO SEGÚN TAB */}
      {tab === 'mapa' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.9rem', color: '#7c8592', fontWeight: '600' }}>
              Haz clic en cualquier canil para reubicar, asignar o liberar un animal.
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', background: '#e8f0e8', color: '#2f5540', padding: '4px 10px', borderRadius: '6px', fontWeight: '700' }}>● LIBRE</span>
              <span style={{ fontSize: '0.75rem', background: '#fbeae8', color: '#d1453b', padding: '4px 10px', borderRadius: '6px', fontWeight: '700' }}>● OCUPADO</span>
              <span style={{ fontSize: '0.75rem', background: '#faf1de', color: '#d99a3d', padding: '4px 10px', borderRadius: '6px', fontWeight: '700' }}>● CUARENTENA</span>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '16px'
          }}>
            {caniles.map(canil => {
              const ocupado = canil.estado === 'OCUPADO';
              const libre = canil.estado === 'LIBRE';
              const cuarentena = canil.estado === 'CUARENTENA';

              const borderColor = libre ? '#3f6c52' : ocupado ? '#d1453b' : '#d99a3d';
              const badgeBg = libre ? '#e8f0e8' : ocupado ? '#fbeae8' : '#faf1de';
              const badgeColor = libre ? '#2f5540' : ocupado ? '#d1453b' : '#d99a3d';

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
                    <strong style={{ fontSize: '0.98rem', color: '#1f2430' }}>{canil.nombre} ({canil.codigo})</strong>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: '800', background: badgeBg, color: badgeColor,
                      padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase'
                    }}>
                      {canil.estado}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: '#7c8592', marginBottom: '10px' }}>
                    Sector: <strong>{canil.sector}</strong> · {canil.tipo}
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
                          <span style={{ fontSize: '1.2rem' }}>🐾</span>
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
                      <span>🚪</span> Canil disponible (Capacidad libre)
                    </div>
                  )}

                  <div style={{ marginTop: '12px', textAlign: 'right' }}>
                    <span style={{ fontSize: '0.74rem', color: '#3f6c52', fontWeight: '700' }}>Gestionar movimiento →</span>
                  </div>
                </div>
              );
            })}
          </div>
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
                  <th style={{ padding: '10px' }}>Motivo</th>
                  <th style={{ padding: '10px' }}>Responsable</th>
                  <th style={{ padding: '10px' }}>Estado</th>
                  {esDirectora && <th style={{ padding: '10px', textAlign: 'center' }}>Acción Directora</th>}
                </tr>
              </thead>
              <tbody>
                {traslados.length === 0 ? (
                  <tr>
                    <td colSpan={esDirectora ? 8 : 7} style={{ textAlign: 'center', padding: '24px', color: '#a3aab5' }}>
                      No se registran movimientos ni traslados aún
                    </td>
                  </tr>
                ) : (
                  traslados.map(t => {
                    const badgeState = {
                      COMPLETADO: { bg: '#e8f0e8', color: '#2f5540' },
                      APROBADO: { bg: '#e8f0e8', color: '#2f5540' },
                      PENDIENTE_APROBACION: { bg: '#faf1de', color: '#d99a3d' },
                      RECHAZADO: { bg: '#fbeae8', color: '#d1453b' }
                    }[t.estado] || { bg: '#e9eaed', color: '#7c8592' };

                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid #f0f1f3' }}>
                        <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                          {new Date(t.fechaRegistro).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '10px', fontWeight: '700' }}>{t.animal?.nombre}</td>
                        <td style={{ padding: '10px' }}>{t.tipo.replace('_', ' ')}</td>
                        <td style={{ padding: '10px' }}>
                          {t.tipo === 'INTERNO_CANIL' ? (
                            <span>{t.canilOrigen?.nombre || 'Ingreso'} → {t.canilDestino?.nombre}</span>
                          ) : (
                            <span><strong>{t.destinoNombre}</strong> {t.destinoContacto ? `(${t.destinoContacto})` : ''}</span>
                          )}
                        </td>
                        <td style={{ padding: '10px', maxWidth: '200px' }}>{t.motivo}</td>
                        <td style={{ padding: '10px' }}>{t.responsable?.nombre}</td>
                        <td style={{ padding: '10px' }}>
                          <span style={{
                            fontSize: '0.72rem', fontWeight: '700', padding: '3px 8px', borderRadius: '6px',
                            background: badgeState.bg, color: badgeState.color
                          }}>
                            {t.estado.replace('_', ' ')}
                          </span>
                        </td>
                        {esDirectora && (
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            {t.estado === 'PENDIENTE_APROBACION' ? (
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => handleGestionarAprobacion(t.id, true)}
                                  style={{ background: '#3f6c52', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.75rem' }}
                                >
                                  Aprobar
                                </button>
                                <button
                                  onClick={() => handleGestionarAprobacion(t.id, false)}
                                  style={{ background: '#d1453b', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.75rem' }}
                                >
                                  Rechazar
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: '#7c8592' }}>
                                {t.aprobadoPor ? `Por ${t.aprobadoPor.nombre}` : '—'}
                              </span>
                            )}
                          </td>
                        )}
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
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                Animal a Trasladar *
              </label>
              <select
                value={trasladoExterno.animalId}
                onChange={e => setTrasladoExterno({ ...trasladoExterno, animalId: e.target.value })}
                required
                style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed' }}
              >
                <option value="">— Seleccionar animal —</option>
                {animales.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} ({a.especie} - {a.canil ? a.canil.nombre : 'Sin canil'})
                  </option>
                ))}
              </select>
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

      {/* MODAL ASIGNAR / REUBICAR CANIL */}
      {modalCanilOpen && selectedCanil && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(20,24,32,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px'
        }}>
          <div style={{
            background: '#fff', borderRadius: '18px', padding: '26px', width: '100%', maxWidth: '480px',
            boxShadow: '0 12px 36px rgba(20,24,32,0.2)'
          }}>
            <h3 style={{ margin: '0 0 6px', color: '#1f2430' }}>
              🚪 Gestionar Canil #{selectedCanil.nombre}
            </h3>
            <p style={{ color: '#7c8592', fontSize: '0.84rem', margin: '0 0 16px' }}>
              Sector: <strong>{selectedCanil.sector}</strong> · Capacidad máxima: {selectedCanil.capacidad} animal
            </p>

            {errorModal && (
              <div style={{ background: '#fbeae8', color: '#d1453b', padding: '10px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.82rem' }}>
                {errorModal}
              </div>
            )}

            <form onSubmit={handleGuardarAsignacion}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                  Animal Alojado
                </label>
                <select
                  value={selectedAnimalId}
                  onChange={e => setSelectedAnimalId(e.target.value)}
                  style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed' }}
                >
                  <option value="">— Ninguno (Dejar canil LIBRE) —</option>
                  {animales.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} ({a.especie} · {a.canil ? `Actual: ${a.canil.nombre}` : 'Sin canil'})
                    </option>
                  ))}
                </select>
              </div>

              {selectedAnimalId && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                    Estado del Canil
                  </label>
                  <select
                    value={estadoCanil}
                    onChange={e => setEstadoCanil(e.target.value)}
                    style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed' }}
                  >
                    <option value="OCUPADO">OCUPADO (Normal)</option>
                    <option value="CUARENTENA">CUARENTENA (Aislamiento médico)</option>
                  </select>
                </div>
              )}

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                  Motivo del Movimiento (Obligatorio) *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ej: Ingreso inicial al refugio / Movido por recomendación médica / Reorganización por sobrecupo"
                  value={motivoMovimiento}
                  onChange={e => setMotivoMovimiento(e.target.value)}
                  style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{
                background: '#f8f9fa', padding: '10px 14px', borderRadius: '8px',
                fontSize: '0.78rem', color: '#7c8592', marginBottom: '16px'
              }}>
                Responsable del movimiento: <strong>{user?.nombre}</strong> ({user?.rol})
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalCanilOpen(false)}
                  style={{ padding: '9px 16px', background: 'transparent', border: '1.5px solid #e9eaed', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  style={{ padding: '9px 20px', background: '#3f6c52', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                >
                  {guardando ? 'Guardando...' : 'Confirmar Movimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
