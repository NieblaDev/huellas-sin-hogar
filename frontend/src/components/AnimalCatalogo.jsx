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

  const badgeMap = {
    NORMAL: { bg: '#e8f0e8', color: '#2f5540', label: 'Normal' },
    CONDICION_ESPECIAL: { bg: '#faf1de', color: '#d99a3d', label: 'Especial' },
    CRITICO: { bg: '#fbeae8', color: '#d1453b', label: 'Crítico' }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#1f2430', margin: 0 }}>Registro de Animales</h2>
          <p style={{ color: '#7c8592', fontSize: '0.88rem', margin: '4px 0 0' }}>Fichas y perfiles albergados en Huellas Sin Hogar</p>
        </div>
        <button onClick={onOpenModal} style={{ background: '#3f6c52', color: '#fff', padding: '10px 18px', borderRadius: '9px', border: 'none', fontWeight: '700', cursor: 'pointer' }}>
          + Registrar animal
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <input type="text" placeholder="Buscar por nombre..." value={search} onChange={e => setSearch(e.target.value)} style={{ padding: '10px 14px', borderRadius: '9px', border: '1.5px solid #e9eaed', flex: 1 }} />
        <select value={especie} onChange={e => setEspecie(e.target.value)} style={{ padding: '10px 14px', borderRadius: '9px', border: '1.5px solid #e9eaed', background: '#fff' }}>
          <option value="">Todas las especies</option>
          <option value="Perro">Perros</option>
          <option value="Gato">Gatos</option>
        </select>
      </div>

      {cargando ? (
        <p style={{ textAlign: 'center', color: '#7c8592' }}>Cargando catálogo...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '18px' }}>
          {animales.map(a => {
            const b = badgeMap[a.estadoSalud] || badgeMap.NORMAL;
            return (
              <div key={a.id} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e9eaed', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ height: '110px', background: '#eef3ec', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {a.fotoUrl ? <img src={a.fotoUrl} alt={a.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '2.5rem' }}>{a.especie === 'Perro' ? '🐶' : '🐱'}</span>}
                </div>
                <div style={{ padding: '14px' }}>
                  <div style={{ fontWeight: '800', fontSize: '1rem', color: '#1f2430' }}>{a.nombre}</div>
                  <div style={{ fontSize: '0.8rem', color: '#7c8592', marginTop: '2px' }}>{a.especie} · {a.sexo} · {a.edad}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                    <span style={{ fontSize: '0.75rem', background: '#f8f9fa', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>⚖️ {a.peso} kg</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: '800', padding: '2px 8px', borderRadius: '12px', background: b.bg, color: b.color }}>{b.label}</span>
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