import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import AnimalCatalogo from './components/AnimalCatalogo';
import AnimalFormModal from './components/AnimalFormModal';
import CanilesModulo from './components/CanilesModulo';
import DashboardModulo from './components/DashboardModulo';
import AuditoriaModulo from './components/AuditoriaModulo';
import CuidadosModulo from './components/CuidadosModulo';
import SaludModulo from './components/SaludModulo';
import AdopcionesModulo from './components/adopciones/AdopcionesModulo';
import InventarioModulo from './components/InventarioModulo';
import VoluntariosModulo from './components/VoluntariosModulo';
import Logo from './components/Logo';
import { clearStoredSession, readStoredSession } from './utils/session';
import './styles/portal-controls.css';
import { API_URL, getAuthHeaders } from './api/config';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'caniles' | 'animales' | 'auditoria'
  const [modalOpen, setModalOpen] = useState(false);
  const [animalEditar, setAnimalEditar] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [canilesList, setCanilesList] = useState([]);

  useEffect(() => {
    const session = readStoredSession(localStorage);
    if (!session) return;
    const controller = new AbortController();
    // Verificar también la firma antes de restaurar una sesión de otro arranque.
    fetch(`${API_URL}/animals`, {
      headers: { Authorization: `Bearer ${session.token}` },
      signal: controller.signal,
      cache: 'no-store'
    }).then(response => {
      if (controller.signal.aborted || localStorage.getItem('token') !== session.token) return;
      if (response.ok) setUser(session.user);
      else if (response.status === 401 || response.status === 403) clearStoredSession(localStorage);
    }).catch(() => { /* Si no hay conexión, mantener visible el formulario de acceso. */ });
    return () => controller.abort();
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
  const puedeGestionarAdopciones = ['DIRECTORA', 'ENCARGADA_ADOPCIONES'].includes(user?.rol);
  const puedeGestionarInventario = ['DIRECTORA', 'COORDINADOR', 'VETERINARIA', 'ENCARGADA_ADOPCIONES', 'VOLUNTARIO_AVANZADO'].includes(user?.rol);

  return (
    <div className="portal-staff" style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex' }}>
      {!user ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Login onLoginSuccess={setUser} />
        </div>
      ) : (
        <>
          {/* SIDEBAR DE NAVEGACIÓN — FIEL AL PROTOTIPO */}
          <aside style={{
            width: '252px', height: '100vh', background: '#ffffff', borderRight: '1px solid #e9eaed',
            display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, zIndex: 100
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '11px', padding: '22px 20px 20px',
              borderBottom: '1px solid #f0f1f3'
            }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '11px', background: '#e8f0e8',
                color: '#3f6c52', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Logo size={24} />
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

            <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
              {/* Inicio / Panel de Indicadores */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`portal-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              >
                <span>📊</span> <span>Inicio</span>
              </button>

              {/* Registro de Animales */}
              <button
                onClick={() => setActiveTab('animales')}
                className={`portal-nav-btn ${activeTab === 'animales' ? 'active' : ''}`}
              >
                <span>🐶</span> <span>Registro Animales</span>
              </button>

              {/* Caniles y Traslados */}
              <button
                onClick={() => setActiveTab('caniles')}
                className={`portal-nav-btn ${activeTab === 'caniles' ? 'active' : ''}`}
              >
                <span>🚪</span> <span>Caniles y Traslados</span>
              </button>

              {/*Gestion de Adopciones */}
              {puedeGestionarAdopciones && (
                <button
                  onClick={() => setActiveTab('adopciones')}
                  aria-current={activeTab === 'adopciones' ? 'page' : undefined}
                  className={`portal-nav-btn ${activeTab === 'adopciones' ? 'active' : ''}`}
                >
                  <span>🏡</span> <span>Adopciones</span>
                </button>
              )}

              {/* Sección: Bienestar */}
              <div style={{ borderTop: '1px solid var(--portal-border)', marginTop: '10px', paddingTop: '12px', paddingBottom: '2px', paddingLeft: '14px' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--portal-text-light)' }}>
                  Bienestar
                </span>
              </div>

              {/* Necesidades Diarias y Notas de Cuidado */}
              <button
                onClick={() => setActiveTab('cuidados')}
                className={`portal-nav-btn ${activeTab === 'cuidados' ? 'active' : ''}`}
              >
                <span>📋</span> <span>Rondas y Cuidados</span>
              </button>

              {/*Salud y Vacunacion */}
              <button
                onClick={() => setActiveTab('salud')}
                className={`portal-nav-btn ${activeTab === 'salud' ? 'active' : ''}`}
              >
                <span>💉</span> <span>Salud y Vacunación</span>
              </button>

              {/* Sección: Administración */}
              <div style={{ borderTop: '1px solid var(--portal-border)', marginTop: '10px', paddingTop: '12px', paddingBottom: '2px', paddingLeft: '14px' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--portal-text-light)' }}>
                  Administración
                </span>
              </div>

              {/* Inventario de Insumos */}
              {puedeGestionarInventario && (
                <button
                  onClick={() => setActiveTab('inventario')}
                  aria-current={activeTab === 'inventario' ? 'page' : undefined}
                  className={`portal-nav-btn ${activeTab === 'inventario' ? 'active' : ''}`}
                >
                  <span>📦</span> <span>Inventario</span>
                </button>
              )}

              {/* Voluntarios y Turnos */}
              <button
                onClick={() => setActiveTab('voluntarios')}
                aria-current={activeTab === 'voluntarios' ? 'page' : undefined}
                className={`portal-nav-btn ${activeTab === 'voluntarios' ? 'active' : ''}`}
              >
                <span>🤝</span> <span>Voluntarios y Turnos</span>
              </button>

              {/* Auditoría y Trazabilidad */}
              {esDirectora && (
                <button
                  onClick={() => setActiveTab('auditoria')}
                  className={`portal-nav-btn ${activeTab === 'auditoria' ? 'active' : ''}`}
                >
                  <span>🛡️</span> <span>Auditoría</span>
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
            {/* key={activeTab} remonta el panel y reproduce la transición al cambiar de sección */}
            <div key={activeTab} className="portal-tab-panel">
              {activeTab === 'dashboard' && (
                <DashboardModulo user={user} onNavigate={setActiveTab} />
              )}

              {activeTab === 'caniles' && (
                <CanilesModulo user={user} />
              )}

              {activeTab === 'animales' && (
                <AnimalCatalogo
                  onOpenModal={(animal = null) => {
                    setAnimalEditar(animal && animal.id ? animal : null);
                    setModalOpen(true);
                  }}
                  onEditAnimal={(animal) => {
                    setAnimalEditar(animal);
                    setModalOpen(true);
                  }}
                  reloadKey={reloadKey}
                />
              )}

              {activeTab === 'cuidados' && (
                <CuidadosModulo user={user} />
              )}

              {activeTab === 'salud' && (
                <SaludModulo user={user} />
              )}

              {activeTab === 'adopciones' && puedeGestionarAdopciones && (
                <AdopcionesModulo user={user} />
              )}

              {activeTab === 'inventario' && puedeGestionarInventario && (
                <InventarioModulo user={user} />
              )}

              {activeTab === 'voluntarios' && (
                <VoluntariosModulo user={user} />
              )}

              {activeTab === 'auditoria' && esDirectora && (
                <AuditoriaModulo user={user} />
              )}
            </div>
          </main>

          <AnimalFormModal
            isOpen={modalOpen}
            animalEditar={animalEditar}
            onClose={() => {
              setModalOpen(false);
              setAnimalEditar(null);
            }}
            onSuccess={() => setReloadKey(k => k + 1)}
            caniles={canilesList}
          />
        </>
      )}
    </div>
  );
}