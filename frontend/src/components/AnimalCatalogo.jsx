import React, { useState, useEffect } from 'react';
import { API_URL, getAuthHeaders } from '../api/config';

export default function AnimalCatalogo({ onOpenModal, reloadKey }) {
  const [animales, setAnimales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [search, setSearch] = useState('');
  const [especie, setEspecie] = useState('');

  useEffect(() => {
    fetchAnimals();
  }, [search, especie, reloadKey]);

  const fetchAnimals = async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (especie) params.append('especie', especie);
      const res = await fetch(`${API_URL}/animals?${params.toString()}`, { headers: getAuthHeaders() });
      const data = await res.json();
      setAnimales(data);
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  const handleDelete = async (id, nombre, e) => {
    e.stopPropagation();
    if (!window.confirm(`¿Estás seguro de que deseas dar de baja lógica a ${nombre}? Se guardará en la auditoría del refugio.`)) return;

    try {
      const res = await fetch(`${API_URL}/animals/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Error al dar de baja');
      setAnimales(animales.filter(a => a.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const badgeMap = {
    NORMAL: { bg: '#e8f0e8', color: '#2f5540', label: 'Normal' },
    CONDICION_ESPECIAL: { bg: '#faf1de', color: '#d99a3d', label: 'Especial' },
    CRITICO: { bg: '#fbeae8', color: '#d1453b', label: 'Crítico' }
  };

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#1f2430', margin: 0 }}>Registro de Animales</h2>
          <p style={{ color: '#7c8592', fontSize: '0.88rem', margin: '4px 0 0' }}>Fichas y perfiles albergados en Huellas Sin Hogar</p>
        </div>
        <button onClick={onOpenModal} style={{ background: '#3f6c52', color: '#fff', padding: '10px 18px', borderRadius: '9px', border: 'none', fontWeight: '700', cursor: 'pointer' }}>
          + Registrar nuevo animal
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: '220px', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e9eaed', fontSize: '0.88rem' }}
        />
        <select
          value={especie}
          onChange={e => setEspecie(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e9eaed', fontSize: '0.88rem', background: '#fff' }}
        >
          <option value="">Todas las especies</option>
          <option value="Perro">Perros</option>
          <option value="Gato">Gatos</option>
        </select>
      </div>

      {cargando ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#7c8592' }}>Cargando catálogo...</div>
      ) : animales.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '14px', border: '1px solid #e9eaed', color: '#7c8592' }}>
          No se encontraron animales activos.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '18px' }}>
          {animales.map(a => {
            const badge = badgeMap[a.estadoSalud] || badgeMap.NORMAL;
            return (
              <div
                key={a.id}
                style={{
                  background: '#fff', borderRadius: '16px', border: '1px solid #e9eaed', overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(20,24,32,0.04)', display: 'flex', flexDirection: 'column'
                }}
              >
                <div style={{ height: '160px', background: '#f0f1f3', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {a.fotoUrl ? (
                    <img src={a.fotoUrl} alt={a.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '3rem' }}>🐾</span>
                  )}
                  <span style={{
                    position: 'absolute', top: '12px', right: '12px', background: badge.bg, color: badge.color,
                    padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '800'
                  }}>
                    {badge.label}
                  </span>
                </div>

                <div style={{ padding: '18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1f2430' }}>{a.nombre}</h3>
                      <span style={{ fontSize: '0.8rem', color: '#7c8592' }}>{a.especie} · {a.sexo} · {a.edad}</span>
                    </div>
                  </div>

                  {/* Canil asignado en tiempo real */}
                  <div style={{
                    margin: '10px 0', padding: '8px 10px', borderRadius: '8px',
                    background: a.canil ? '#e8f0e8' : '#f8f9fa',
                    border: a.canil ? '1px solid #c9dfcd' : '1px dashed #e9eaed',
                    display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem'
                  }}>
                    <span>🚪</span>
                    <span>
                      Ubicación: <strong>{a.canil ? `${a.canil.nombre} (${a.canil.sector})` : 'Sin canil asignado'}</strong>
                    </span>
                  </div>

                  <p style={{ fontSize: '0.82rem', color: '#555e6d', margin: '0 0 14px', flex: 1 }}>
                    {a.nota || 'Sin notas registradas.'}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f1f3', paddingTop: '12px' }}>
                    <span style={{ fontSize: '0.74rem', color: '#7c8592' }}>
                      {a.raza || 'Mestizo'} · {a.peso} kg
                    </span>
                    <button
                      onClick={(e) => handleDelete(a.id, a.nombre, e)}
                      style={{ background: '#fbeae8', border: '1px solid #f3c9c4', color: '#d1453b', padding: '5px 10px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Baja Lógica
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}