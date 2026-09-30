import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import AnimalCatalogo from './components/AnimalCatalogo';
import AnimalFormModal from './components/AnimalFormModal';

export default function App() {
  const [user, setUser] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (saved && token) setUser(JSON.parse(saved));
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      {!user ? (
        <Login onLoginSuccess={setUser} />
      ) : (
        <>
          <header style={{ background: '#fff', borderBottom: '1px solid #e9eaed', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '800', color: '#1f2430' }}>🐾 Huellas Sin Hogar — Staff</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.85rem', color: '#7c8592' }}>{user.nombre} ({user.rol})</span>
              <button onClick={handleLogout} style={{ background: '#fbeae8', border: '1px solid #f3c9c4', color: '#d1453b', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700' }}>Salir</button>
            </div>
          </header>
          <main>
            <AnimalCatalogo onOpenModal={() => setModalOpen(true)} reloadKey={reloadKey} />
          </main>
          <AnimalFormModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSuccess={() => setReloadKey(k => k + 1)} />
        </>
      )}
    </div>
  );
}