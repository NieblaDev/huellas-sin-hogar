import React, { useState } from 'react';
import { API_URL, getAuthHeaders } from '../api/config';

export default function AnimalFormModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    nombre: '', especie: 'Perro', sexo: 'Macho', edad: '', peso: '', raza: 'Mestizo', estadoSalud: 'NORMAL', nota: '', fotoUrl: ''
  });
  const [error, setError] = useState(null);

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
    try {
      const res = await fetch(`${API_URL}/animals`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...formData, peso: parseFloat(formData.peso) || 0 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,24,32,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '440px' }}>
        <h3 style={{ margin: '0 0 16px', color: '#1f2430' }}>🐾 Registrar nuevo animal</h3>
        {error && <div style={{ color: '#d1453b', fontSize: '0.8rem', marginBottom: '10px' }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592' }}>Foto</label>
            <input type="file" accept="image/*" onChange={handlePhoto} />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592' }}>Nombre</label>
            <input type="text" required value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592' }}>Especie</label>
              <select value={formData.especie} onChange={e => setFormData({ ...formData, especie: e.target.value })} style={{ width: '100%', padding: '8px' }}>
                <option value="Perro">Perro</option>
                <option value="Gato">Gato</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592' }}>Sexo</label>
              <select value={formData.sexo} onChange={e => setFormData({ ...formData, sexo: e.target.value })} style={{ width: '100%', padding: '8px' }}>
                <option value="Macho">Macho</option>
                <option value="Hembra">Hembra</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592' }}>Edad</label>
              <input type="text" placeholder="Ej: 2 años" required value={formData.edad} onChange={e => setFormData({ ...formData, edad: e.target.value })} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592' }}>Peso (kg)</label>
              <input type="number" step="0.1" value={formData.peso} onChange={e => setFormData({ ...formData, peso: e.target.value })} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592' }}>Nota / Diagnóstico</label>
            <textarea value={formData.nota} onChange={e => setFormData({ ...formData, nota: e.target.value })} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 12px' }}>Cancelar</button>
            <button type="submit" style={{ padding: '8px 16px', background: '#3f6c52', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}