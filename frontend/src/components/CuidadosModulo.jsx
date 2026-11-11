import React, { useState, useEffect } from 'react';
import { API_URL, getAuthHeaders } from '../api/config';

export default function CuidadosModulo({ user }) {
  const [tareas, setTareas] = useState([]);
  const [animales, setAnimales] = useState([]);
  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [historialAnimal, setHistorialAnimal] = useState(null);
  const [tabCuidados, setTabCuidados] = useState('panel'); // 'panel' | 'historial' | 'nuevo'
  const [cargando, setCargando] = useState(true);
  const [observacionModal, setObservacionModal] = useState({ open: false, tareaId: null, texto: '' });

  const hoyISO = new Date().toISOString().split('T')[0];
  const [formCuidado, setFormCuidado] = useState({
    contexto: 'EVALUACION_CLINICA',
    categoria: 'DIETA_ESPECIAL',
    criticidad: 'ALTA',
    titulo: '',
    instruccion: '',
    franjaHoraria: 'Ambas',
    fechaInicio: hoyISO,
    fechaFin: hoyISO
  });

  const tienePermisoMedico = ['VETERINARIA', 'DIRECTORA'].includes(user?.rol);

  useEffect(() => {
    cargarInicial();
  }, []);

  const cargarInicial = async () => {
    setCargando(true);
    try {
      const [resTareas, resAnimales] = await Promise.all([
        fetch(`${API_URL}/cuidados/tareas`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/animals`, { headers: getAuthHeaders() })
      ]);
      const dataTareas = await resTareas.json();
      const dataAnimales = await resAnimales.json();
      setTareas(dataTareas.tareas || []);
      setAnimales(dataAnimales || []);
      if (dataAnimales?.length > 0 && !selectedAnimalId) {
        setSelectedAnimalId(dataAnimales[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  };

  const cargarHistorial = async (id) => {
    setSelectedAnimalId(id);
    setTabCuidados('historial');
    try {
      const res = await fetch(`${API_URL}/cuidados/animal/${id}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar historial');
      setHistorialAnimal(data);
    } catch (e) {
      alert(e.message);
    }
  };

  const handleCrearIndicacion = async (e) => {
    e.preventDefault();
    if (!selectedAnimalId) return alert('Seleccione un animal con ficha activa');

    try {
      const res = await fetch(`${API_URL}/cuidados/indicaciones`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          animalId: Number(selectedAnimalId),
          contexto: formCuidado.contexto,
          categoria: formCuidado.categoria,
          criticidad: formCuidado.criticidad,
          titulo: formCuidado.titulo,
          instruccion: formCuidado.instruccion,
          franjaHoraria: formCuidado.franjaHoraria,
          fechaInicio: new Date(`${formCuidado.fechaInicio}T00:00:00`).toISOString(),
          fechaFin: new Date(`${formCuidado.fechaFin}T23:59:59`).toISOString()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detalles?.[0]?.mensaje || data.error || 'Error al registrar indicación');
      }

      alert('Indicación registrada en el historial del animal y publicada en el panel de tareas del turno.');
      setFormCuidado({
        contexto: 'EVALUACION_CLINICA',
        categoria: 'DIETA_ESPECIAL',
        criticidad: 'ALTA',
        titulo: '',
        instruccion: '',
        franjaHoraria: 'Ambas',
        fechaInicio: hoyISO,
        fechaFin: hoyISO
      });
      await cargarInicial();
      await cargarHistorial(selectedAnimalId);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCompletar = async () => {
    const { tareaId, texto } = observacionModal;
    try {
      const res = await fetch(`${API_URL}/cuidados/completar`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          indicacionId: tareaId,
          observaciones: texto || 'Cumplido en ronda de turno.'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar cumplimiento');

      alert('Tarea marcada como completada en la bitácora del turno.');
      setObservacionModal({ open: false, tareaId: null, texto: '' });
      cargarInicial();
    } catch (err) {
      alert(err.message);
    }
  };

  const criticidadEstilos = {
    CRITICA: { bg: '#fbeae8', border: '#e57373', text: '#b71c1c', badge: '🔴 CRITICIDAD CRÍTICA' },
    ALTA: { bg: '#fff3e0', border: '#ffb74d', text: '#e65100', badge: '🟠 CRITICIDAD ALTA' },
    MEDIA: { bg: '#fffbf2', border: '#fae2b8', text: '#b7791f', badge: '🟡 CRITICIDAD MEDIA' },
    BAJA: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', badge: '🟢 CRITICIDAD BAJA' }
  };

  const contextoLabel = {
    EVALUACION_CLINICA: 'Evaluación Clínica',
    CIRUGIA: 'Post-Cirugía',
    INGRESO_REFUGIO: 'Ingreso al Refugio'
  };

  if (cargando) {
    return (
      <div className="portal-page-container" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--portal-text-muted)' }}>
        <div style={{ fontSize: '1.8rem', marginBottom: '12px' }}>⏳</div>
        <strong>Cargando módulo de necesidades y cuidados...</strong>
      </div>
    );
  }

  return (
    <div className="portal-page-container">
      <div className="portal-header">
        <div>
          <h2 className="portal-header-title">
            <span>📋</span>
            <span>Necesidades Diarias y Notas de Cuidado</span>
          </h2>
          <p className="portal-header-subtitle">
            Indicaciones operativas médicas publicadas en el panel del turno e historial por animal
          </p>
        </div>
      </div>

      {/* Subnavegación */}
      <div className="portal-subtabs">
        <button
          onClick={() => setTabCuidados('panel')}
          className={`portal-subtab-btn ${tabCuidados === 'panel' ? 'active' : ''}`}
        >
          📌 Panel de Tareas del Turno ({tareas.length})
        </button>

        <button
          onClick={() => { if (selectedAnimalId) cargarHistorial(selectedAnimalId); else setTabCuidados('historial'); }}
          className={`portal-subtab-btn ${tabCuidados === 'historial' ? 'active' : ''}`}
        >
          🗂️ Historial de Cuidados por Animal
        </button>

        {tienePermisoMedico && (
          <button
            onClick={() => setTabCuidados('nuevo')}
            className={`portal-subtab-btn ${tabCuidados === 'nuevo' ? 'active' : ''}`}
          >
            ➕ Registrar Indicación de Cuidado
          </button>
        )}
      </div>

      {/* PESTAÑA 1: PANEL DE TAREAS DEL TURNO (PARA CUMPLIMIENTO DE VOLUNTARIOS) */}
      {tabCuidados === 'panel' && (
        tareas.length === 0 ? (
          <div style={{ background: '#fff', padding: '32px', borderRadius: '14px', border: '1px solid #e9eaed', textAlign: 'center', color: '#7c8592' }}>
            No hay indicaciones vigentes publicadas para el turno de hoy.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '18px' }}>
            {tareas.map((t) => {
              const style = criticidadEstilos[t.criticidad] || criticidadEstilos.MEDIA;
              return (
                <div
                  key={t.id}
                  style={{
                    background: '#fff', borderRadius: '14px', border: `1.5px solid ${style.border}`,
                    padding: '18px', display: 'flex', flexDirection: 'column'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
                    <span style={{ background: style.bg, color: style.text, padding: '4px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '800' }}>
                      {style.badge}
                    </span>
                    <span style={{ fontSize: '0.74rem', background: '#eef0f2', padding: '3px 8px', borderRadius: '4px', fontWeight: '700' }}>
                      {t.franjaHoraria}
                    </span>
                  </div>

                  <div style={{ margin: '6px 0' }}>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#1f2430' }}>{t.animal.nombre} ({t.animal.especie})</h4>
                    <span style={{ fontSize: '0.78rem', color: '#7c8592' }}>
                      🚪 Canil: {t.animal.canil ? `${t.animal.canil.nombre} (${t.animal.canil.sector})` : 'Sin canil asignado'}
                    </span>
                  </div>

                  <div style={{ background: '#fafbfc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #f0f1f3', margin: '10px 0' }}>
                    <div style={{ fontSize: '0.72rem', color: '#3f6c52', fontWeight: '700', marginBottom: '4px' }}>
                      {contextoLabel[t.contexto] || t.contexto} · Vigente hasta {new Date(t.fechaFin).toLocaleDateString()}
                    </div>
                    <strong style={{ fontSize: '0.88rem', color: '#1f2430', display: 'block', marginBottom: '4px' }}>{t.titulo}</strong>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#555e6d', lineHeight: '1.4' }}>{t.instruccion}</p>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: '#7c8592', marginBottom: '12px' }}>
                    Indicada por: <strong>{t.emitidaPor}</strong>
                  </div>

                  <div style={{ marginTop: 'auto', borderTop: '1px solid #f0f1f3', paddingTop: '12px' }}>
                    {t.atendidoHoy ? (
                      <div style={{ background: '#e8f0e8', color: '#2f5540', padding: '8px 10px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700' }}>
                        ✓ Cumplida por {t.detalleAtencion.por} ({new Date(t.detalleAtencion.hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                      </div>
                    ) : (
                      <button
                        onClick={() => setObservacionModal({ open: true, tareaId: t.id, texto: '' })}
                        style={{
                          width: '100%', padding: '9px', borderRadius: '8px', border: 'none', fontWeight: '700',
                          cursor: 'pointer', background: '#3f6c52', color: '#fff'
                        }}
                      >
                        Marcar Cumplimiento en Turno
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* PESTAÑA 2: HISTORIAL DE CUIDADOS POR ANIMAL */}
      {tabCuidados === 'historial' && (
        <div style={{ background: '#fff', borderRadius: '14px', padding: '22px', border: '1px solid #e9eaed' }}>
          <div style={{ marginBottom: '18px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '700', display: 'block', marginBottom: '6px' }}>
              Seleccionar Animal con Ficha Activa:
            </label>
            <select
              value={selectedAnimalId}
              onChange={(e) => cargarHistorial(e.target.value)}
              style={{ padding: '10px', borderRadius: '8px', border: '1.5px solid #e9eaed', width: '100%', maxWidth: '360px', background: '#fff' }}
            >
              {animales.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre} ({a.especie})</option>
              ))}
            </select>
          </div>

          {historialAnimal && (
            <div>
              <h3 style={{ borderBottom: '1px solid #f0f1f3', paddingBottom: '8px', color: '#1f2430' }}>
                Historial de Indicaciones — {historialAnimal.animal.nombre}
              </h3>
              {historialAnimal.indicaciones.length === 0 ? (
                <p style={{ color: '#7c8592', fontSize: '0.86rem' }}>Este animal no registra indicaciones de cuidado aún.</p>
              ) : (
                historialAnimal.indicaciones.map((ind) => (
                  <div key={ind.id} style={{ background: '#f8f9fa', padding: '14px', borderRadius: '10px', marginBottom: '12px', border: '1px solid #e9eaed' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <strong>{ind.titulo}</strong>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#3f6c52' }}>
                        {ind.criticidad} · {contextoLabel[ind.contexto] || ind.contexto}
                      </span>
                    </div>
                    <p style={{ margin: '6px 0', fontSize: '0.85rem', color: '#333' }}>{ind.instruccion}</p>
                    <div style={{ fontSize: '0.76rem', color: '#7c8592' }}>
                      Vigencia: {new Date(ind.fechaInicio).toLocaleDateString()} al {new Date(ind.fechaFin).toLocaleDateString()} · Franja: {ind.franjaHoraria} · Registrada por: {ind.creadoPor?.nombre}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 3: FORMULARIO DE CUIDADOS (SOLO PERMISOS MÉDICOS AUTORIZADOS) */}
      {tabCuidados === 'nuevo' && tienePermisoMedico && (
        <form onSubmit={handleCrearIndicacion} style={{ background: '#fff', borderRadius: '14px', padding: '24px', border: '1px solid #e9eaed', maxWidth: '640px' }}>
          <h3 style={{ margin: '0 0 16px', color: '#1f2430' }}>Formulario de Cuidados e Indicaciones Operativas</h3>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '4px' }}>Animal (Ficha Activa):</label>
            <select
              value={selectedAnimalId}
              onChange={(e) => setSelectedAnimalId(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e9eaed', background: '#fff' }}
            >
              {animales.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre} ({a.especie})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '4px' }}>Momento / Contexto:</label>
              <select
                value={formCuidado.contexto}
                onChange={(e) => setFormCuidado({ ...formCuidado, contexto: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e9eaed', background: '#fff' }}
              >
                <option value="EVALUACION_CLINICA">Evaluación Clínica</option>
                <option value="CIRUGIA">Cirugía</option>
                <option value="INGRESO_REFUGIO">Ingreso al Refugio</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '4px' }}>Nivel de Criticidad:</label>
              <select
                value={formCuidado.criticidad}
                onChange={(e) => setFormCuidado({ ...formCuidado, criticidad: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e9eaed', background: '#fff' }}
              >
                <option value="CRITICA">Crítica</option>
                <option value="ALTA">Alta</option>
                <option value="MEDIA">Media</option>
                <option value="BAJA">Baja</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '4px' }}>Categoría de Cuidado:</label>
              <select
                value={formCuidado.categoria}
                onChange={(e) => setFormCuidado({ ...formCuidado, categoria: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e9eaed', background: '#fff' }}
              >
                <option value="DIETA_ESPECIAL">Dieta Especial</option>
                <option value="MEDICACION_ORAL">Medicación Oral</option>
                <option value="RESTRICCION_FISICA">Restricción Física</option>
                <option value="HIGIENE_CURACION">Higiene y Curación</option>
                <option value="OBSERVACION_CONDUCTA">Observación de Conducta</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '4px' }}>Franja de Turno:</label>
              <select
                value={formCuidado.franjaHoraria}
                onChange={(e) => setFormCuidado({ ...formCuidado, franjaHoraria: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e9eaed', background: '#fff' }}
              >
                <option value="Mañana">Mañana</option>
                <option value="Tarde">Tarde</option>
                <option value="Ambas">Ambas</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '4px' }}>Fecha de Inicio:</label>
              <input
                type="date"
                required
                value={formCuidado.fechaInicio}
                onChange={(e) => setFormCuidado({ ...formCuidado, fechaInicio: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e9eaed', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '4px' }}>Fecha de Término:</label>
              <input
                type="date"
                required
                value={formCuidado.fechaFin}
                onChange={(e) => setFormCuidado({ ...formCuidado, fechaFin: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e9eaed', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '4px' }}>Título de la Indicación:</label>
            <input
              type="text"
              required
              placeholder="Ej: Reposo absoluto post-esterilización / Dieta blanda"
              value={formCuidado.titulo}
              onChange={(e) => setFormCuidado({ ...formCuidado, titulo: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e9eaed', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '4px' }}>Nota de Cuidado Especial / Instrucciones:</label>
            <textarea
              required
              rows={4}
              placeholder="Describa exactamente qué debe hacer el voluntario en el canil..."
              value={formCuidado.instruccion}
              onChange={(e) => setFormCuidado({ ...formCuidado, instruccion: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e9eaed', boxSizing: 'border-box' }}
            />
          </div>

          <button type="submit" style={{ background: '#3f6c52', color: '#fff', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer' }}>
            Registrar y Publicar en Turno
          </button>
        </form>
      )}

      {/* Modal para registrar cumplimiento en bitácora */}
      {observacionModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', maxWidth: '440px', width: '90%' }}>
            <h3 style={{ margin: '0 0 10px', color: '#1f2430' }}>Registrar Cumplimiento en Turno</h3>
            <p style={{ fontSize: '0.84rem', color: '#7c8592', margin: '0 0 14px' }}>
              La tarea quedará registrada en la bitácora del turno a nombre de {user?.nombre}.
            </p>
            <textarea
              placeholder="Observaciones del voluntario (ej: Comió toda la ración, herida limpia...)"
              rows={3}
              value={observacionModal.texto}
              onChange={(e) => setObservacionModal({ ...observacionModal, texto: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e9eaed', marginBottom: '14px', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setObservacionModal({ open: false, tareaId: null, texto: '' })}
                style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #e9eaed', background: '#fff', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCompletar}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#3f6c52', color: '#fff', fontWeight: '700', cursor: 'pointer' }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}