import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import AnimalCatalogo from './components/AnimalCatalogo';
import AnimalFormModal from './components/AnimalFormModal';
import CanilesModulo from './components/CanilesModulo';
import DashboardModulo from './components/DashboardModulo';
import AuditoriaModulo from './components/AuditoriaModulo';
import CuidadosModulo from './components/CuidadosModulo';
import SaludModulo from './components/SaludModulo';
import AdopcionesModulo from './components/AdopcionesModulo';
import InventarioModulo from './components/InventarioModulo';
import VoluntariosModulo from './components/VoluntariosModulo';
import PerfilesUsuariosModulo from './components/PerfilesUsuariosModulo';
import ReportesConsolidadosModulo from './components/ReportesConsolidadosModulo';
import Logo from './components/Logo';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Dog,
  DoorOpen,
  FileBarChart2,
  Handshake,
  House,
  Package,
  ShieldCheck,
  Syringe,
  Users
} from 'lucide-react';
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
  const [sidebarRetraida, setSidebarRetraida] = useState(() => {
    try {
      return localStorage.getItem('portal_sidebar_retraida') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setSidebarRetraida(prev => {
      const nuevo = !prev;
      try {
        localStorage.setItem('portal_sidebar_retraida', String(nuevo));
      } catch {}
      return nuevo;
    });
  };

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
  const puedeGestionarInventario = ['DIRECTORA', 'VETERINARIA', 'ENCARGADA_ADOPCIONES', 'VOLUNTARIO_AVANZADO'].includes(user?.rol);

  return (
    <div className={user ? 'portal-staff portal-staff-authenticated' : 'portal-staff'} style={{ minHeight: '100vh', display: 'flex' }}>
      {!user ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Login onLoginSuccess={setUser} />
        </div>
      ) : (
        <>
          {/* SIDEBAR DE NAVEGACIÓN — RETRAÍBLE CON UN CLICK */}
          <aside className="portal-sidebar" style={{
            width: sidebarRetraida ? '72px' : '252px',
            height: '100vh',
            borderRight: '1px solid #e9eaed',
            display: 'flex',
            flexDirection: 'column',
            position: 'fixed',
            top: 0,
            left: 0,
            zIndex: 100,
            transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
            overflowX: 'hidden'
          }}>
            <div className={`portal-sidebar-header${sidebarRetraida ? ' is-collapsed' : ''}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '11px',
                  background: '#e8f0e8',
                  color: '#3f6c52',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Logo size={24} />
                </div>
                {!sidebarRetraida && (
                  <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    <h1 style={{ fontSize: '0.98rem', fontWeight: '800', color: '#1f2430', lineHeight: 1.2, margin: 0 }}>
                      Huellas Sin Hogar
                    </h1>
                    <span style={{ fontSize: '0.68rem', color: '#a3aab5', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: '600' }}>
                      Portal del Staff
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={toggleSidebar}
                className="portal-sidebar-toggle"
                aria-expanded={!sidebarRetraida}
                aria-controls="portal-sidebar-nav"
                title={sidebarRetraida ? "Expandir barra lateral" : "Retraer barra lateral"}
                aria-label={sidebarRetraida ? "Expandir barra lateral" : "Retraer barra lateral"}
              >
                {sidebarRetraida ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            </div>

            <nav id="portal-sidebar-nav" aria-label="Navegación principal" style={{ flex: 1, padding: sidebarRetraida ? '12px 8px' : '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
              {/* Inicio / Panel de Indicadores */}
              <button
                onClick={() => setActiveTab('dashboard')}
                title="Inicio"
                className={`portal-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                style={{ justifyContent: sidebarRetraida ? 'center' : 'flex-start', padding: sidebarRetraida ? '10px 0' : '10px 14px' }}
              >
                <BarChart3 size={18} aria-hidden="true" /> {!sidebarRetraida && <span>Inicio</span>}
              </button>

              {/* Animales Ingresados */}
              <button
                onClick={() => setActiveTab('animales')}
                title="Animales Ingresados"
                aria-current={activeTab === 'animales' ? 'page' : undefined}
                className={`portal-nav-btn ${activeTab === 'animales' ? 'active' : ''}`}
                style={{ justifyContent: sidebarRetraida ? 'center' : 'flex-start', padding: sidebarRetraida ? '10px 0' : '10px 14px' }}
              >
                <Dog size={18} aria-hidden="true" /> {!sidebarRetraida && <span>Animales Ingresados</span>}
              </button>

              {/* Caniles y Traslados */}
              <button
                onClick={() => setActiveTab('caniles')}
                title="Caniles y Traslados"
                className={`portal-nav-btn ${activeTab === 'caniles' ? 'active' : ''}`}
                style={{ justifyContent: sidebarRetraida ? 'center' : 'flex-start', padding: sidebarRetraida ? '10px 0' : '10px 14px' }}
              >
                <DoorOpen size={18} aria-hidden="true" /> {!sidebarRetraida && <span>Caniles y Traslados</span>}
              </button>

              {/* Gestion de Adopciones */}
              {puedeGestionarAdopciones && (
                <button
                  onClick={() => setActiveTab('adopciones')}
                  title="Adopciones"
                  aria-current={activeTab === 'adopciones' ? 'page' : undefined}
                  className={`portal-nav-btn ${activeTab === 'adopciones' ? 'active' : ''}`}
                  style={{ justifyContent: sidebarRetraida ? 'center' : 'flex-start', padding: sidebarRetraida ? '10px 0' : '10px 14px' }}
                >
                  <House size={18} aria-hidden="true" /> {!sidebarRetraida && <span>Adopciones</span>}
                </button>
              )}

              {/* Sección: Bienestar */}
              <div style={{
                borderTop: '1px solid var(--portal-border)',
                marginTop: '10px',
                paddingTop: '12px',
                paddingBottom: '2px',
                paddingLeft: sidebarRetraida ? '0' : '14px',
                textAlign: sidebarRetraida ? 'center' : 'left'
              }}>
                {!sidebarRetraida ? (
                  <span style={{ fontSize: '0.68rem', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--portal-text-light)' }}>
                    Bienestar
                  </span>
                ) : (
                  <div style={{ height: '1px', background: 'transparent' }} />
                )}
              </div>

              {/* Necesidades Diarias y Notas de Cuidado */}
              <button
                onClick={() => setActiveTab('cuidados')}
                title="Rondas y Cuidados"
                className={`portal-nav-btn ${activeTab === 'cuidados' ? 'active' : ''}`}
                style={{ justifyContent: sidebarRetraida ? 'center' : 'flex-start', padding: sidebarRetraida ? '10px 0' : '10px 14px' }}
              >
                <ClipboardList size={18} aria-hidden="true" /> {!sidebarRetraida && <span>Rondas y Cuidados</span>}
              </button>

              {/* Salud y Vacunación */}
              <button
                onClick={() => setActiveTab('salud')}
                title="Salud y Vacunación"
                className={`portal-nav-btn ${activeTab === 'salud' ? 'active' : ''}`}
                style={{ justifyContent: sidebarRetraida ? 'center' : 'flex-start', padding: sidebarRetraida ? '10px 0' : '10px 14px' }}
              >
                <Syringe size={18} aria-hidden="true" /> {!sidebarRetraida && <span>Salud y Vacunación</span>}
              </button>

              {/* Sección: Administración */}
              <div style={{
                borderTop: '1px solid var(--portal-border)',
                marginTop: '10px',
                paddingTop: '12px',
                paddingBottom: '2px',
                paddingLeft: sidebarRetraida ? '0' : '14px',
                textAlign: sidebarRetraida ? 'center' : 'left'
              }}>
                {!sidebarRetraida ? (
                  <span style={{ fontSize: '0.68rem', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--portal-text-light)' }}>
                    Administración
                  </span>
                ) : (
                  <div style={{ height: '1px', background: 'transparent' }} />
                )}
              </div>

              {/* Inventario de Insumos */}
              {puedeGestionarInventario && (
                <button
                  onClick={() => setActiveTab('inventario')}
                  title="Inventario"
                  aria-current={activeTab === 'inventario' ? 'page' : undefined}
                  className={`portal-nav-btn ${activeTab === 'inventario' ? 'active' : ''}`}
                  style={{ justifyContent: sidebarRetraida ? 'center' : 'flex-start', padding: sidebarRetraida ? '10px 0' : '10px 14px' }}
                >
                  <Package size={18} aria-hidden="true" /> {!sidebarRetraida && <span>Inventario</span>}
                </button>
              )}

              {/* Voluntarios y Turnos */}
              <button
                onClick={() => setActiveTab('voluntarios')}
                title="Voluntarios y Turnos"
                aria-current={activeTab === 'voluntarios' ? 'page' : undefined}
                className={`portal-nav-btn ${activeTab === 'voluntarios' ? 'active' : ''}`}
                style={{ justifyContent: sidebarRetraida ? 'center' : 'flex-start', padding: sidebarRetraida ? '10px 0' : '10px 14px' }}
              >
                <Handshake size={18} aria-hidden="true" /> {!sidebarRetraida && <span>Voluntarios y Turnos</span>}
              </button>

              {/* Usuarios y Perfiles — Exclusivo Dirección */}
              {esDirectora && (
                <button
                  onClick={() => setActiveTab('perfiles')}
                  title="Usuarios y Perfiles"
                  aria-current={activeTab === 'perfiles' ? 'page' : undefined}
                  className={`portal-nav-btn ${activeTab === 'perfiles' ? 'active' : ''}`}
                  style={{ justifyContent: sidebarRetraida ? 'center' : 'flex-start', padding: sidebarRetraida ? '10px 0' : '10px 14px' }}
                >
                  <Users size={18} aria-hidden="true" /> {!sidebarRetraida && <span>Usuarios y Perfiles</span>}
                </button>
              )}

              {/* Reportes Consolidados — Exclusivo Dirección */}
              {esDirectora && (
                <button
                  onClick={() => setActiveTab('reportes')}
                  title="Reportes Consolidados"
                  aria-current={activeTab === 'reportes' ? 'page' : undefined}
                  className={`portal-nav-btn ${activeTab === 'reportes' ? 'active' : ''}`}
                  style={{ justifyContent: sidebarRetraida ? 'center' : 'flex-start', padding: sidebarRetraida ? '10px 0' : '10px 14px' }}
                >
                  <FileBarChart2 size={18} aria-hidden="true" /> {!sidebarRetraida && <span>Reportes Consolidados</span>}
                </button>
              )}

              {/* Auditoría y Trazabilidad */}
              {esDirectora && (
                <button
                  onClick={() => setActiveTab('auditoria')}
                  title="Auditoría"
                  className={`portal-nav-btn ${activeTab === 'auditoria' ? 'active' : ''}`}
                  style={{ justifyContent: sidebarRetraida ? 'center' : 'flex-start', padding: sidebarRetraida ? '10px 0' : '10px 14px' }}
                >
                  <ShieldCheck size={18} aria-hidden="true" /> {!sidebarRetraida && <span>Auditoría</span>}
                </button>
              )}
            </nav>

            {/* Usuario autenticado y Salir */}
            <div style={{ padding: sidebarRetraida ? '12px 8px' : '16px 20px', borderTop: '1px solid #f0f1f3', background: 'rgba(31, 36, 48, 0.02)', marginTop: 'auto' }}>
              {!sidebarRetraida ? (
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
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div
                    title={`${user.nombre} (${user.rol})`}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#e8f0e8',
                      color: '#3f6c52',
                      fontWeight: '800',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'default'
                    }}
                  >
                    {(user.nombre || 'U')[0].toUpperCase()}
                  </div>
                  <button
                    onClick={handleLogout}
                    title="Cerrar sesión"
                    style={{
                      background: '#fbeae8', border: '1px solid #f3c9c4', color: '#d1453b',
                      padding: '4px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.7rem', width: '100%', textAlign: 'center'
                    }}
                  >
                    Salir
                  </button>
                </div>
              )}
            </div>
          </aside>

          {/* ÁREA PRINCIPAL */}
          <main style={{
            marginLeft: sidebarRetraida ? '72px' : '252px',
            flex: 1,
            minHeight: '100vh',
            boxSizing: 'border-box',
            transition: 'margin-left 0.22s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
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

              {activeTab === 'perfiles' && esDirectora && (
                <PerfilesUsuariosModulo user={user} />
              )}

              {activeTab === 'reportes' && esDirectora && (
                <ReportesConsolidadosModulo user={user} />
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
