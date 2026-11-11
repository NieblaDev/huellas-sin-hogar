import React, { useState, useEffect } from 'react';
import { API_URL, getAuthHeaders } from '../api/config';

export default function SaludModulo({ user }) {
  const [alertas, setAlertas] = useState(null);
  const [animales, setAnimales] = useState([]);
  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [historial, setHistorial] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [tabSalud, setTabSalud] = useState('alertas'); // 'alertas' | 'historial' | 'nueva_vacuna' | 'nueva_atencion'

  // Estados de formularios
  const [vacunaForm, setVacunaForm] = useState({
    nombreVacuna: '',
    dosis: '1ra Dosis',
    lote: '',
    fechaVencimiento: '',
    observaciones: ''
  });

  const [atencionForm, setAtencionForm] = useState({
    motivo: 'Revisión periódica',
    diagnostico: '',
    temperatura: '',
    pesoActual: ''
  });

  const esVeterinariaODirectora = ['VETERINARIA', 'DIRECTORA'].includes(user?.rol);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [resAlertas, resAnimales] = await Promise.all([
        fetch(`${API_URL}/salud/alertas`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/animals`, { headers: getAuthHeaders() })
      ]);
      const dataAlertas = await resAlertas.json();
      const dataAnimales = await resAnimales.json();
      setAlertas(dataAlertas);
      setAnimales(dataAnimales || []);
      if (dataAnimales?.length > 0) setSelectedAnimalId(dataAnimales[0].id);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  };

  const verHistorialAnimal = async (id) => {
    setSelectedAnimalId(id);
    setTabSalud('historial');
    try {
      const res = await fetch(`${API_URL}/salud/historial/${id}`, { headers: getAuthHeaders() });
      const data = await res.json();
      setHistorial(data);
    } catch (e) {
      alert('Error al cargar historial clínico del animal');
    }
  };

  const handleGuardarVacuna = async (e) => {
    e.preventDefault();
    if (!selectedAnimalId) return alert('Seleccione un animal');
    try {
      const res = await fetch(`${API_URL}/salud/vacunas`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          animalId: Number(selectedAnimalId),
          nombreVacuna: vacunaForm.nombreVacuna,
          dosis: vacunaForm.dosis,
          lote: vacunaForm.lote || null,
          fechaVencimiento: new Date(vacunaForm.fechaVencimiento).toISOString(),
          observaciones: vacunaForm.observaciones
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar vacuna');
      alert('Vacuna registrada correctamente en la ficha y alerta configurada.');
      setVacunaForm({ nombreVacuna: '', dosis: '1ra Dosis', lote: '', fechaVencimiento: '', observaciones: '' });
      cargarDatos();
      verHistorialAnimal(selectedAnimalId);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleGuardarAtencion = async (e) => {
    e.preventDefault();
    if (!selectedAnimalId) return alert('Seleccione un animal');
    try {
      const res = await fetch(`${API_URL}/salud/atenciones`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          animalId: Number(selectedAnimalId),
          motivo: atencionForm.motivo,
          diagnostico: atencionForm.diagnostico,
          temperatura: atencionForm.temperatura ? Number(atencionForm.temperatura) : null,
          pesoActual: atencionForm.pesoActual ? Number(atencionForm.pesoActual) : null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar atención');
      alert('Atención médica registrada exitosamente en la ficha del animal.');
      setAtencionForm({ motivo: 'Revisión periódica', diagnostico: '', temperatura: '', pesoActual: '' });
      cargarDatos();
      verHistorialAnimal(selectedAnimalId);
    } catch (err) {
      alert(err.message);
    }
  };

  if (cargando) {
    return (
      <div className="portal-page-container" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--portal-text-muted)' }}>
        <div style={{ fontSize: '1.8rem', marginBottom: '12px' }}>⏳</div>
        <strong>Cargando módulo de salud...</strong>
      </div>
    );
  }

  return (
    <div className="portal-page-container">
      <div className="portal-header">
        <div>
          <h2 className="portal-header-title">
            <span>🩺</span>
            <span>Módulo de Salud y Vacunación</span>
          </h2>
          <p className="portal-header-subtitle">
            Atención clínica, listado de pendientes sanitarios y alertas de vencimiento
          </p>
        </div>
      </div>

      {/* Subnavegación del Módulo de Salud */}
      <div className="portal-subtabs">
        <button
          onClick={() => setTabSalud('alertas')}
          className={`portal-subtab-btn ${tabSalud === 'alertas' ? 'active' : ''}`}
        >
          🚨 Alertas y Pendientes ({alertas?.resumen?.totalAlertas || 0})
        </button>
        <button
          onClick={() => { setTabSalud('historial'); if (selectedAnimalId) verHistorialAnimal(selectedAnimalId); }}
          className={`portal-subtab-btn ${tabSalud === 'historial' ? 'active' : ''}`}
        >
          📋 Ficha e Historial Clínico
        </button>
        {esVeterinariaODirectora && (
          <>
            <button
              onClick={() => setTabSalud('nueva_vacuna')}
              className={`portal-subtab-btn ${tabSalud === 'nueva_vacuna' ? 'active' : ''}`}
            >
              💉 Registrar Vacuna
            </button>
            <button
              onClick={() => setTabSalud('nueva_atencion')}
              className={`portal-subtab-btn ${tabSalud === 'nueva_atencion' ? 'active' : ''}`}
            >
              🩺 Registrar Atención Médica
            </button>
          </>
        )}
      </div>

      {/* PESTAÑA 1: ALERTAS SANITARIAS (3 CATEGORÍAS) */}
      {tabSalud === 'alertas' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '18px' }}>
          
          {/* 1. Vencidos (Vacunas y Tratamientos) */}
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #f3c9c4', padding: '18px' }}>
            <h3 style={{ color: '#d1453b', margin: '0 0 12px', fontSize: '1.05rem' }}>
              🔴 Vencidos ({alertas?.vencidas?.length || 0})
            </h3>
            {alertas?.vencidas?.length === 0 ? (
              <p style={{ color: '#7c8592', fontSize: '0.85rem' }}>Sin registros vencidos.</p>
            ) : (
              alertas?.vencidas?.map(item => (
                <div key={item.id} style={{ padding: '10px 12px', background: '#fdf3f2', borderRadius: '8px', marginBottom: '8px' }}>
                  <div style={{ fontWeight: '800', color: '#1f2430' }}>{item.animal.nombre} ({item.animal.especie})</div>
                  <div style={{ fontSize: '0.82rem', color: '#d1453b', fontWeight: '600' }}>{item.tipo}: {item.titulo}</div>
                  <div style={{ fontSize: '0.74rem', color: '#7c8592' }}>{item.subtitulo} · Venció: {new Date(item.fecha).toLocaleDateString()}</div>
                </div>
              ))
            )}
          </div>

          {/* 2. Próximos a Vencer (<= 15 días) */}
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #fae2b8', padding: '18px' }}>
            <h3 style={{ color: '#d99a3d', margin: '0 0 12px', fontSize: '1.05rem' }}>
              🟡 Próximos a Vencer (&le; 15d) ({alertas?.proximas?.length || 0})
            </h3>
            {alertas?.proximas?.length === 0 ? (
              <p style={{ color: '#7c8592', fontSize: '0.85rem' }}>Todo al día.</p>
            ) : (
              alertas?.proximas?.map(item => (
                <div key={item.id} style={{ padding: '10px 12px', background: '#fffbf2', borderRadius: '8px', marginBottom: '8px' }}>
                  <div style={{ fontWeight: '800', color: '#1f2430' }}>{item.animal.nombre} ({item.animal.especie})</div>
                  <div style={{ fontSize: '0.82rem', color: '#d99a3d', fontWeight: '600' }}>{item.tipo}: {item.titulo}</div>
                  <div style={{ fontSize: '0.74rem', color: '#7c8592' }}>{item.subtitulo} · Vence: {new Date(item.fecha).toLocaleDateString()}</div>
                </div>
              ))
            )}
          </div>

          {/* 3. Refuerzo Requerido */}
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #bfdbfe', padding: '18px' }}>
            <h3 style={{ color: '#2563eb', margin: '0 0 12px', fontSize: '1.05rem' }}>
              🔵 Refuerzo Requerido ({alertas?.refuerzoRequerido?.length || 0})
            </h3>
            {alertas?.refuerzoRequerido?.length === 0 ? (
              <p style={{ color: '#7c8592', fontSize: '0.85rem' }}>Sin refuerzos pendientes.</p>
            ) : (
              alertas?.refuerzoRequerido?.map(item => (
                <div key={item.id} style={{ padding: '10px 12px', background: '#eff6ff', borderRadius: '8px', marginBottom: '8px' }}>
                  <div style={{ fontWeight: '800', color: '#1f2430' }}>{item.animal.nombre} ({item.animal.especie})</div>
                  <div style={{ fontSize: '0.82rem', color: '#2563eb', fontWeight: '600' }}>{item.titulo}</div>
                  <div style={{ fontSize: '0.74rem', color: '#7c8592' }}>{item.subtitulo} · Fecha límite: {new Date(item.fecha).toLocaleDateString()}</div>
                </div>
              ))
            )}
          </div>

        </div>
      )}

      {/* PESTAÑA 2: HISTORIAL CLÍNICO INDIVIDUAL */}
      {tabSalud === 'historial' && (
        <div style={{ background: '#fff', borderRadius: '14px', padding: '22px', border: '1px solid #e9eaed' }}>
          <div style={{ marginBottom: '18px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1f2430', display: 'block', marginBottom: '6px' }}>
              Seleccionar Animal Activo:
            </label>
            <select
              value={selectedAnimalId}
              onChange={e => verHistorialAnimal(e.target.value)}
              style={{ padding: '10px', borderRadius: '8px', border: '1.5px solid #e9eaed', width: '100%', maxWidth: '350px', background: '#fff' }}
            >
              {animales.map(a => (
                <option key={a.id} value={a.id}>{a.nombre} ({a.especie} - {a.raza || 'Mestizo'})</option>
              ))}
            </select>
          </div>

          {historial && (
            <div>
              <h3 style={{ borderBottom: '1px solid #f0f1f3', paddingBottom: '8px', color: '#1f2430' }}>
                Historial de {historial.animal.nombre}
              </h3>
              
              <h4 style={{ margin: '14px 0 8px', color: '#3f6c52' }}>💉 Vacunas Registradas:</h4>
              {historial.vacunas.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: '#7c8592' }}>Sin vacunas registradas en la ficha.</p>
              ) : (
                <ul style={{ fontSize: '0.88rem', lineHeight: '1.8' }}>
                  {historial.vacunas.map(v => (
                    <li key={v.id}>
                      <strong>{v.nombreVacuna}</strong> ({v.dosis}) — Aplicada: {new Date(v.fechaAplicacion).toLocaleDateString()} | Próximo refuerzo: {new Date(v.fechaVencimiento).toLocaleDateString()}
                    </li>
                  ))}
                </ul>
              )}

              <h4 style={{ margin: '20px 0 8px', color: '#3f6c52' }}>🩺 Atenciones Médicas y Revisiones:</h4>
              {historial.atenciones.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: '#7c8592' }}>Sin atenciones médicas previas.</p>
              ) : (
                historial.atenciones.map(at => (
                  <div key={at.id} style={{ background: '#f8f9fa', padding: '14px', borderRadius: '10px', marginBottom: '10px', border: '1px solid #e9eaed' }}>
                    <div style={{ fontWeight: '700', color: '#1f2430' }}>
                      {at.motivo} — {new Date(at.fechaAtencion).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#7c8592', margin: '2px 0 6px' }}>
                      Atendido por: {at.veterinaria?.nombre}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#333' }}>
                      <strong>Diagnóstico:</strong> {at.diagnostico}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 3: FORMULARIO REGISTRAR VACUNA */}
      {tabSalud === 'nueva_vacuna' && (
        <form onSubmit={handleGuardarVacuna} style={{ background: '#fff', borderRadius: '14px', padding: '24px', border: '1px solid #e9eaed', maxWidth: '600px' }}>
          <h3 style={{ margin: '0 0 16px', color: '#1f2430' }}>Registro de Vacuna (Dosis Válida)</h3>
          
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '4px' }}>Animal:</label>
            <select
              value={selectedAnimalId}
              onChange={e => setSelectedAnimalId(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e9eaed', background: '#fff' }}
            >
              {animales.map(a => <option key={a.id} value={a.id}>{a.nombre} ({a.especie})</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '4px' }}>Nombre de la Vacuna:</label>
            <input
              type="text"
              required
              placeholder="Ej: Rabia, Séxtuple, Parvovirus, Triple Felina..."
              value={vacunaForm.nombreVacuna}
              onChange={e => setVacunaForm({ ...vacunaForm, nombreVacuna: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e9eaed', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '4px' }}>Dosis:</label>
              <input
                type="text"
                required
                placeholder="1ra Dosis, Refuerzo..."
                value={vacunaForm.dosis}
                onChange={e => setVacunaForm({ ...vacunaForm, dosis: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e9eaed', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '4px' }}>Próximo Vencimiento / Refuerzo:</label>
              <input
                type="date"
                required
                value={vacunaForm.fechaVencimiento}
                onChange={e => setVacunaForm({ ...vacunaForm, fechaVencimiento: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e9eaed', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '4px' }}>Observaciones / Lote:</label>
            <input
              type="text"
              placeholder="Lote de vacuna o indicaciones del laboratorio"
              value={vacunaForm.observaciones}
              onChange={e => setVacunaForm({ ...vacunaForm, observaciones: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e9eaed', boxSizing: 'border-box' }}
            />
          </div>

          <button type="submit" style={{ background: '#3f6c52', color: '#fff', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer' }}>
            Guardar Vacuna en Ficha
          </button>
        </form>
      )}

      {/* PESTAÑA 4: FORMULARIO REGISTRAR ATENCIÓN */}
      {tabSalud === 'nueva_atencion' && (
        <form onSubmit={handleGuardarAtencion} style={{ background: '#fff', borderRadius: '14px', padding: '24px', border: '1px solid #e9eaed', maxWidth: '600px' }}>
          <h3 style={{ margin: '0 0 16px', color: '#1f2430' }}>Consulta y Revisión Clínica Estructurada</h3>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '4px' }}>Animal:</label>
            <select
              value={selectedAnimalId}
              onChange={e => setSelectedAnimalId(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e9eaed', background: '#fff' }}
            >
              {animales.map(a => <option key={a.id} value={a.id}>{a.nombre} ({a.especie})</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '4px' }}>Motivo de Atención / Ingreso:</label>
            <input
              type="text"
              required
              value={atencionForm.motivo}
              onChange={e => setAtencionForm({ ...atencionForm, motivo: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e9eaed', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '4px' }}>Diagnóstico Clínico Estructurado:</label>
            <textarea
              required
              rows={4}
              placeholder="Indique hallazgos clínicos, estado general y recomendaciones..."
              value={atencionForm.diagnostico}
              onChange={e => setAtencionForm({ ...atencionForm, diagnostico: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e9eaed', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '4px' }}>Temperatura (°C):</label>
              <input
                type="number"
                step="0.1"
                placeholder="Ej: 38.5"
                value={atencionForm.temperatura}
                onChange={e => setAtencionForm({ ...atencionForm, temperatura: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e9eaed', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '4px' }}>Peso Actual (kg):</label>
              <input
                type="number"
                step="0.1"
                placeholder="Ej: 14.2"
                value={atencionForm.pesoActual}
                onChange={e => setAtencionForm({ ...atencionForm, pesoActual: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e9eaed', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <button type="submit" style={{ background: '#3f6c52', color: '#fff', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer' }}>
            Guardar Ficha Clínica
          </button>
        </form>
      )}
    </div>
  );
}