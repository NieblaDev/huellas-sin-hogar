import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import AnimalCatalogo from './components/AnimalCatalogo';
import AnimalFormModal from './components/AnimalFormModal';
import CanilesModulo from './components/CanilesModulo';
import DashboardModulo from './components/DashboardModulo';
import AuditoriaModulo from './components/AuditoriaModulo';
import { API_URL, getAuthHeaders } from './api/config';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'caniles' | 'animales' | 'auditoria'
  const [modalOpen, setModalOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [canilesList, setCanilesList] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (saved && token) {
      setUser(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchCaniles();
    }
  }, [user, reloadKey]);

  const fetchCaniles = async () => {
    try {
      const res = await fetch(`${API_URL}/caniles`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCanilesList(data.caniles || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setActiveTab('dashboard');
  };

  const esDirectora = user?.rol === 'DIRECTORA';

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex' }}>
      {!user ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Login onLoginSuccess={setUser} />
        </div>
      ) : (
        <>
          {/* SIDEBAR DE NAVEGACIÓN — FIEL AL PROTOTIPO */}
          <aside style={{
            width: '252px', minHeight: '100vh', background: '#ffffff', borderRight: '1px solid #e9eaed',
            display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, zIndex: 100
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '11px', padding: '22px 20px 20px',
              borderBottom: '1px solid #f0f1f3'
            }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '11px', background: '#e8f0e8',
                color: '#3f6c52', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'
              }}>
                🐾
              </div>
              <div>
                <h1 style={{ fontSize: '0.98rem', fontWeight: '800', color: '#1f2430', lineHeight: 1.2, margin: 0 }}>
                  Huellas Sin Hogar
                </h1>
                <span style={{ fontSize: '0.68rem', color: '#a3aab5', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: '600' }}>
                  Portal del Staff
                </span>
              </div>
            </div>

            <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {/* Inicio / Panel de Indicadores (Requisito 2) */}
              <button
                onClick={() => setActiveTab('dashboard')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '10px 14px',
                  background: activeTab === 'dashboard' ? '#eef3ec' : 'transparent',
                  color: activeTab === 'dashboard' ? '#2f5540' : '#7c8592',
                  border: 'none', borderRadius: '9px', fontSize: '0.88rem', fontWeight: '700', cursor: 'pointer', textAlign: 'left'
                }}
              >
                📊 <span>Inicio (Indicadores)</span>
              </button>

              {/* Caniles y Traslados (Requisito 1) */}
              <button
                onClick={() => setActiveTab('caniles')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '10px 14px',
                  background: activeTab === 'caniles' ? '#eef3ec' : 'transparent',
                  color: activeTab === 'caniles' ? '#2f5540' : '#7c8592',
                  border: 'none', borderRadius: '9px', fontSize: '0.88rem', fontWeight: '700', cursor: 'pointer', textAlign: 'left'
                }}
              >
                🚪 <span>Caniles y Traslados</span>
              </button>

              {/* Registro de Animales */}
              <button
                onClick={() => setActiveTab('animales')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '10px 14px',
                  background: activeTab === 'animales' ? '#eef3ec' : 'transparent',
                  color: activeTab === 'animales' ? '#2f5540' : '#7c8592',
                  border: 'none', borderRadius: '9px', fontSize: '0.88rem', fontWeight: '700', cursor: 'pointer', textAlign: 'left'
                }}
              >
                🐶 <span>Registro Animales</span>
              </button>

              {/* Auditoría y Trazabilidad (Requisito 3 - Restringido a Directora) */}
              {esDirectora && (
                <button
                  onClick={() => setActiveTab('auditoria')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '10px 14px',
                    background: activeTab === 'auditoria' ? '#eef3ec' : 'transparent',
                    color: activeTab === 'auditoria' ? '#2f5540' : '#7c8592',
                    border: 'none', borderRadius: '9px', fontSize: '0.88rem', fontWeight: '700', cursor: 'pointer', textAlign: 'left'
                  }}
                >
                  🛡️ <span>Auditoría (Directora)</span>
                </button>
              )}
            </nav>

            {/* Usuario autenticado y Salir */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid #f0f1f3', background: '#fafbfc', marginTop: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: '800', fontSize: '0.84rem', color: '#1f2430', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.nombre}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#7c8592', fontWeight: '600' }}>
                    {user.rol}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  title="Cerrar sesión"
                  style={{
                    background: '#fbeae8', border: '1px solid #f3c9c4', color: '#d1453b',
                    padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.75rem', flexShrink: 0
                  }}
                >
                  Salir
                </button>
              </div>
            </div>
          </aside>

          {/* ÁREA PRINCIPAL */}
          <main style={{ marginLeft: '252px', flex: 1, minHeight: '100vh', boxSizing: 'border-box' }}>
            {activeTab === 'dashboard' && (
              <DashboardModulo user={user} onNavigate={setActiveTab} />
            )}

            {activeTab === 'caniles' && (
              <CanilesModulo user={user} />
            )}

            {activeTab === 'animales' && (
              <AnimalCatalogo
                onOpenModal={() => setModalOpen(true)}
                reloadKey={reloadKey}
              />
            )}

            {activeTab === 'auditoria' && esDirectora && (
              <AuditoriaModulo user={user} />
            )}
          </main>

          <AnimalFormModal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            onSuccess={() => setReloadKey(k => k + 1)}
            caniles={canilesList}
          />
        </>
      )}
    </div>
  );
}