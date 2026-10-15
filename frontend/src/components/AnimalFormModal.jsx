import React, { useState } from 'react';
import { API_URL, getAuthHeaders } from '../api/config';

export default function AnimalFormModal({ isOpen, onClose, onSuccess, caniles = [] }) {
  const [formData, setFormData] = useState({
    nombre: '', especie: 'Perro', sexo: 'Macho', edad: '', peso: '', raza: 'Mestizo',
    estadoSalud: 'NORMAL', nota: '', fotoUrl: '', canilId: ''
  });
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  if (!isOpen) return null;

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setFormData({ ...formData, fotoUrl: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const body = {
        ...formData,
        peso: parseFloat(formData.peso) || 0,
        canilId: formData.canilId ? parseInt(formData.canilId) : null
      };

      const res = await fetch(`${API_URL}/animals`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,24,32,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '26px', width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 14px', color: '#1f2430' }}>🐾 Registrar nuevo animal</h3>
        {error && <div style={{ color: '#d1453b', fontSize: '0.8rem', background: '#fbeae8', padding: '8px 12px', borderRadius: '6px', marginBottom: '10px' }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592' }}>Foto</label>
            <input type="file" accept="image/*" onChange={handlePhoto} />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592' }}>Nombre *</label>
            <input type="text" required value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '6px', border: '1.5px solid #e9eaed' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592' }}>Especie</label>
              <select value={formData.especie} onChange={e => setFormData({ ...formData, especie: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1.5px solid #e9eaed' }}>
                <option value="Perro">Perro</option>
                <option value="Gato">Gato</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592' }}>Sexo</label>
              <select value={formData.sexo} onChange={e => setFormData({ ...formData, sexo: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1.5px solid #e9eaed' }}>
                <option value="Macho">Macho</option>
                <option value="Hembra">Hembra</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592' }}>Edad *</label>
              <input type="text" placeholder="Ej: 2 años" required value={formData.edad} onChange={e => setFormData({ ...formData, edad: e.target.value })} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '6px', border: '1.5px solid #e9eaed' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592' }}>Peso (kg)</label>
              <input type="number" step="0.1" value={formData.peso} onChange={e => setFormData({ ...formData, peso: e.target.value })} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '6px', border: '1.5px solid #e9eaed' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592' }}>Estado de Salud</label>
              <select value={formData.estadoSalud} onChange={e => setFormData({ ...formData, estadoSalud: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1.5px solid #e9eaed' }}>
                <option value="NORMAL">Normal</option>
                <option value="CONDICION_ESPECIAL">Condición Especial</option>
                <option value="CRITICO">Crítico</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592' }}>Canil Inicial (Opcional)</label>
              <select value={formData.canilId} onChange={e => setFormData({ ...formData, canilId: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1.5px solid #e9eaed' }}>
                <option value="">— Sin asignar —</option>
                {caniles.filter(c => c.estado === 'LIBRE').map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} ({c.sector})</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592' }}>Nota / Diagnóstico de ingreso</label>
            <textarea value={formData.nota} onChange={e => setFormData({ ...formData, nota: e.target.value })} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '6px', border: '1.5px solid #e9eaed' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 14px', background: '#f8f9fa', border: '1px solid #e9eaed', borderRadius: '6px', cursor: 'pointer' }}>Cancelar</button>
            <button type="submit" disabled={guardando} style={{ padding: '8px 18px', background: '#3f6c52', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>
              {guardando ? 'Guardando...' : 'Guardar Animal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}