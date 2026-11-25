import Button from './components/ui/Button.jsx';
import React, { lazy, Suspense, useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage.jsx';
import AnimalFormModal from './components/AnimalFormModal';
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
import './styles/portal-controls.css';
import { listarCaniles } from './services/canil.service.js';
import { guardarAnimal } from './services/animal.service.js';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AuthProvider, { useAuth } from './context/AuthContext.jsx';
import PortalFeedback from './context/PortalFeedback.jsx';
import PortalTheme from './components/ui/PortalTheme.jsx';

const AnimalesPage = lazy(() => import('./pages/AnimalesPage.jsx'));
const CanilesPage = lazy(() => import('./pages/CanilesPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const AuditoriaPage = lazy(() => import('./pages/AuditoriaPage.jsx'));
const CuidadosPage = lazy(() => import('./pages/CuidadosPage.jsx'));
const SaludPage = lazy(() => import('./pages/SaludPage.jsx'));
const AdopcionesPage = lazy(() => import('./pages/AdopcionesPage.jsx'));
const InventarioPage = lazy(() => import('./pages/InventarioPage.jsx'));
const VoluntariosPage = lazy(() => import('./pages/VoluntariosPage.jsx'));
const PerfilesUsuariosPage = lazy(() => import('./pages/PerfilesUsuariosPage.jsx'));
const ReportesConsolidadosPage = lazy(() => import('./pages/ReportesConsolidadosPage.jsx'));

export default function App() {
  return (
    <PortalTheme>
      <BrowserRouter>
        <AuthProvider>
          <PortalFeedback><Portal /></PortalFeedback>
        </AuthProvider>
      </BrowserRouter>
    </PortalTheme>
  );
}

function Portal() {
  const { user, setUser, restaurando, cerrarSesion } = useAuth();
  const navigate = useNavigate();
  const activeTab = useLocation().pathname.split('/')[1] || 'dashboard';
  const setActiveTab = tab => navigate('/' + tab);
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
    if (user) fetchCaniles();
  }, [user, reloadKey, modalOpen]);

  const fetchCaniles = async () => {
    try {
      const res = await listarCaniles();
      if (res.ok) {
        const data = await res.json();
        setCanilesList(data.caniles || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    cerrarSesion();
    navigate('/dashboard', { replace: true });
  };

  const esDireccion = user?.rol === 'DIRECCION';
  const puedeGestionarAdopciones = ['DIRECCION', 'PERSONAL_ADOPCIONES'].includes(user?.rol);
  const puedeGestionarInventario = ['DIRECCION', 'PERSONAL_VETERINARIO', 'PERSONAL_ADOPCIONES', 'VOLUNTARIO_AVANZADO'].includes(user?.rol);

  if (restaurando) return <main aria-busy="true" role="status">Restaurando sesión…</main>;

  return (
    <div className={user ? 'portal-staff portal-staff-authenticated' : 'portal-staff'} style={{ minHeight: '100vh', display: 'flex' }}>
      {!user ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LoginPage onLoginSuccess={setUser} />
        </div>
      ) : (
        <>
          {/* SIDEBAR DE NAVEGACIÓN — RETRAÍBLE CON UN CLICK */}
          <aside className="portal-sidebar" style={{
            width: sidebarRetraida ? '72px' : '252px',
            height: '100vh',
            borderRight: 'var(--portal-border-emphasis) solid var(--portal-border)',
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
                  background: 'var(--portal-primary-soft)',
                  color: 'var(--portal-primary)',
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
                    <span style={{ fontSize: '0.68rem', color: 'var(--portal-text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: '600' }}>
                      Portal del Staff
                    </span>
                  </div>
                )}
              </div>

              <Button
                type="button"
                onClick={toggleSidebar}
                className="portal-sidebar-toggle"
                aria-expanded={!sidebarRetraida}
                aria-controls="portal-sidebar-nav"
                title={sidebarRetraida ? "Expandir barra lateral" : "Retraer barra lateral"}
                aria-label={sidebarRetraida ? "Expandir barra lateral" : "Retraer barra lateral"}
              >
                {sidebarRetraida ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </Button>
            </div>

            <nav id="portal-sidebar-nav" aria-label="Navegación principal" style={{ flex: 1, padding: sidebarRetraida ? '12px 8px' : '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
              {/* Inicio / Panel de Indicadores */}
              <Button
                onClick={() => setActiveTab('dashboard')}
                title="Inicio"
                className={`portal-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                style={{ justifyContent: sidebarRetraida ? 'center' : 'flex-start', padding: sidebarRetraida ? '10px 0' : '10px 14px' }}
              >
                <BarChart3 size={18} aria-hidden="true" /> {!sidebarRetraida && <span>Inicio</span>}
              </Button>

              {/* Animales Ingresados */}
              <Button
                onClick={() => setActiveTab('animales')}
                title="Animales Ingresados"
                aria-current={activeTab === 'animales' ? 'page' : undefined}
                className={`portal-nav-btn ${activeTab === 'animales' ? 'active' : ''}`}
                style={{ justifyContent: sidebarRetraida ? 'center' : 'flex-start', padding: sidebarRetraida ? '10px 0' : '10px 14px' }}
              >
                <Dog size={18} aria-hidden="true" /> {!sidebarRetraida && <span>Animales Ingresados</span>}
              </Button>

              {/* Caniles y Traslados */}
              <Button
                onClick={() => setActiveTab('caniles')}
                title="Caniles y Traslados"
                className={`portal-nav-btn ${activeTab === 'caniles' ? 'active' : ''}`}
                style={{ justifyContent: sidebarRetraida ? 'center' : 'flex-start', padding: sidebarRetraida ? '10px 0' : '10px 14px' }}
              >
                <DoorOpen size={18} aria-hidden="true" /> {!sidebarRetraida && <span>Caniles y Traslados</span>}
              </Button>

              {/* Gestion de Adopciones */}
              {puedeGestionarAdopciones && (
                <Button
                  onClick={() => setActiveTab('adopciones')}
                  title="Adopciones"
                  aria-current={activeTab === 'adopciones' ? 'page' : undefined}
                  className={`portal-nav-btn ${activeTab === 'adopciones' ? 'active' : ''}`}
                  style={{ justifyContent: sidebarRetraida ? 'center' : 'flex-start', padding: sidebarRetraida ? '10px 0' : '10px 14px' }}
                >
                  <House size={18} aria-hidden="true" /> {!sidebarRetraida && <span>Adopciones</span>}
                </Button>
              )}

              {/* Sección: Bienestar */}
              <div style={{
                borderTop: 'var(--portal-border-emphasis) solid var(--portal-border)',
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
              <Button
                onClick={() => setActiveTab('cuidados')}
                title="Rondas y Cuidados"
                className={`portal-nav-btn ${activeTab === 'cuidados' ? 'active' : ''}`}
                style={{ justifyContent: sidebarRetraida ? 'center' : 'flex-start', padding: sidebarRetraida ? '10px 0' : '10px 14px' }}
              >
                <ClipboardList size={18} aria-hidden="true" /> {!sidebarRetraida && <span>Rondas y Cuidados</span>}
              </Button>

              {/* Salud y Vacunación */}
              <Button
                onClick={() => setActiveTab('salud')}
                title="Salud y Vacunación"
                className={`portal-nav-btn ${activeTab === 'salud' ? 'active' : ''}`}
                style={{ justifyContent: sidebarRetraida ? 'center' : 'flex-start', padding: sidebarRetraida ? '10px 0' : '10px 14px' }}
              >
                <Syringe size={18} aria-hidden="true" /> {!sidebarRetraida && <span>Salud y Vacunación</span>}
              </Button>

              {/* Sección: Administración */}
              <div style={{
                borderTop: 'var(--portal-border-emphasis) solid var(--portal-border)',
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
                <Button
                  onClick={() => setActiveTab('inventario')}
                  title="Inventario"
                  aria-current={activeTab === 'inventario' ? 'page' : undefined}
                  className={`portal-nav-btn ${activeTab === 'inventario' ? 'active' : ''}`}
                  style={{ justifyContent: sidebarRetraida ? 'center' : 'flex-start', padding: sidebarRetraida ? '10px 0' : '10px 14px' }}
                >
                  <Package size={18} aria-hidden="true" /> {!sidebarRetraida && <span>Inventario</span>}
                </Button>
              )}

              {/* Voluntarios y Turnos */}
              <Button
                onClick={() => setActiveTab('voluntarios')}
                title="Voluntarios y Turnos"
                aria-current={activeTab === 'voluntarios' ? 'page' : undefined}
                className={`portal-nav-btn ${activeTab === 'voluntarios' ? 'active' : ''}`}
                style={{ justifyContent: sidebarRetraida ? 'center' : 'flex-start', padding: sidebarRetraida ? '10px 0' : '10px 14px' }}
              >
                <Handshake size={18} aria-hidden="true" /> {!sidebarRetraida && <span>Voluntarios y Turnos</span>}
              </Button>

              {/* Reportes Consolidados — Exclusivo Dirección */}
              {esDireccion && (
                <Button
                  onClick={() => setActiveTab('reportes')}
                  title="Reportes Consolidados"
                  aria-current={activeTab === 'reportes' ? 'page' : undefined}
                  className={`portal-nav-btn ${activeTab === 'reportes' ? 'active' : ''}`}
                  style={{ justifyContent: sidebarRetraida ? 'center' : 'flex-start', padding: sidebarRetraida ? '10px 0' : '10px 14px' }}
                >
                  <FileBarChart2 size={18} aria-hidden="true" /> {!sidebarRetraida && <span>Reportes Consolidados</span>}
                </Button>
              )}

              {/* Auditoría y Trazabilidad */}
              {esDireccion && (
                <Button
                  onClick={() => setActiveTab('auditoria')}
                  title="Auditoría"
                  className={`portal-nav-btn ${activeTab === 'auditoria' ? 'active' : ''}`}
                  style={{ justifyContent: sidebarRetraida ? 'center' : 'flex-start', padding: sidebarRetraida ? '10px 0' : '10px 14px' }}
                >
                  <ShieldCheck size={18} aria-hidden="true" /> {!sidebarRetraida && <span>Auditoría</span>}
                </Button>
              )}

              {/* Usuarios y Perfiles — Exclusivo Dirección */}
              {esDireccion && (
                <Button
                  onClick={() => setActiveTab('perfiles')}
                  title="Usuarios y Perfiles"
                  aria-current={activeTab === 'perfiles' ? 'page' : undefined}
                  className={`portal-nav-btn ${activeTab === 'perfiles' ? 'active' : ''}`}
                  style={{ justifyContent: sidebarRetraida ? 'center' : 'flex-start', padding: sidebarRetraida ? '10px 0' : '10px 14px' }}
                >
                  <Users size={18} aria-hidden="true" /> {!sidebarRetraida && <span>Usuarios y Perfiles</span>}
                </Button>
              )}
            </nav>

            {/* Usuario autenticado y Salir */}
            <div style={{ padding: sidebarRetraida ? '12px 8px' : '16px 20px', borderTop: 'var(--portal-border-emphasis) solid #f0f1f3', background: 'rgba(31, 36, 48, 0.02)', marginTop: 'auto' }}>
              {!sidebarRetraida ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontWeight: '800', fontSize: '0.84rem', color: '#1f2430', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.nombre}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--portal-text-muted)', fontWeight: '600' }}>
                      {user.rolEtiqueta}
                    </div>
                  </div>
                  <Button
                    onClick={handleLogout}
                    title="Cerrar sesión"
                    style={{
                      background: '#ffe4e6', border: 'var(--portal-border-emphasis) solid #f3c9c4', color: '#b82d44',
                      padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.75rem', flexShrink: 0
                    }}
                  >
                    Salir
                  </Button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div
                    title={`${user.nombre} (${user.rolEtiqueta})`}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--portal-primary-soft)',
                      color: 'var(--portal-primary)',
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
                  <Button
                    onClick={handleLogout}
                    title="Cerrar sesión"
                    style={{
                      background: '#ffe4e6', border: 'var(--portal-border-emphasis) solid #f3c9c4', color: '#b82d44',
                      padding: '4px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.7rem', width: '100%', textAlign: 'center'
                    }}
                  >
                    Salir
                  </Button>
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
              <Suspense fallback={<p role="status">Cargando sección…</p>}>
                <Routes>
                  <Route path="/dashboard" element={<DashboardPage user={user} onNavigate={setActiveTab} />} />

                  <Route path="/caniles/:canilId" element={<CanilesPage user={user} />} />
                  <Route path="/caniles" element={<CanilesPage user={user} />} />

                  <Route path="/animales" element={
                  <AnimalesPage
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
                  } />

                  <Route path="/cuidados" element={<CuidadosPage user={user} />} />

                  <Route path="/salud" element={<SaludPage user={user} />} />

                  {puedeGestionarAdopciones && <Route path="/adopciones" element={<AdopcionesPage user={user} />} />}

                  {puedeGestionarInventario && <Route path="/inventario" element={<InventarioPage user={user} />} />}

                  <Route path="/voluntarios" element={<VoluntariosPage user={user} />} />

                  {esDireccion && <Route path="/perfiles" element={<PerfilesUsuariosPage user={user} onActualizarUsuario={setUser} />} />}

                  {esDireccion && <Route path="/reportes" element={<ReportesConsolidadosPage user={user} />} />}

                  {esDireccion && <Route path="/auditoria" element={<AuditoriaPage user={user} />} />}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Suspense>
            </div>
          </main>

          <AnimalFormModal
            isOpen={modalOpen}
            animalEditar={animalEditar}
            onGuardar={guardarAnimal}
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
