import React, { useState } from 'react';
import { API_URL } from '../api/config';
import Logo from './Logo';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('directora@huellas.cl');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const rolesDev = [
    {
      titulo: 'Directora',
      icono: '👑',
      email: 'directora@huellas.cl',
      password: 'admin123',
      color: '#3f6c52',
      bg: '#e8f0e8'
    },
    {
      titulo: 'Veterinaria',
      icono: '🩺',
      email: 'veterinaria@huellas.cl',
      password: 'admin123',
      color: '#2f5540',
      bg: '#eef3ec'
    },
    {
      titulo: 'Voluntario Avanzado',
      icono: '⭐',
      email: 'voluntario.avanzado@huellas.cl',
      password: 'admin123',
      color: '#b37416',
      bg: '#faf1de'
    },
    {
      titulo: 'Voluntario',
      icono: '🤝',
      email: 'voluntario@huellas.cl',
      password: 'admin123',
      color: '#4550c0',
      bg: '#edeffb'
    }
  ];

  const handleLogin = async (loginEmail, loginPass) => {
    setError(null);
    setCargando(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPass })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Credenciales incorrectas');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleLogin(email, password);
  };

  const handleQuickLogin = (roleEmail, rolePass) => {
    setEmail(roleEmail);
    setPassword(rolePass);
    handleLogin(roleEmail, rolePass);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '85vh', padding: '20px' }}>
      <form onSubmit={handleSubmit} style={{
        background: '#fff', padding: '32px', borderRadius: '18px', border: '1px solid #e9eaed',
        boxShadow: '0 8px 24px rgba(20,24,32,.06)', width: '100%', maxWidth: '420px', boxSizing: 'border-box'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '18px', background: '#e8f0e8',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px'
          }}>
            <Logo size={40} />
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: '800', margin: '8px 0 4px', color: '#1f2430' }}>Iniciar Sesión</h2>
          <p style={{ fontSize: '0.85rem', color: '#7c8592', margin: 0 }}>Huellas Sin Hogar — Portal Staff</p>
        </div>

        {error && (
          <div style={{ background: '#fbeae8', color: '#d1453b', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '16px', border: '1px solid #f3c9c4' }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: '#7c8592', marginBottom: '6px', textTransform: 'uppercase' }}>
            Correo Electrónico
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #e9eaed', boxSizing: 'border-box', fontSize: '0.88rem' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: '#7c8592', marginBottom: '6px', textTransform: 'uppercase' }}>
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #e9eaed', boxSizing: 'border-box', fontSize: '0.88rem' }}
          />
        </div>

        <button
          type="submit"
          disabled={cargando}
          style={{
            width: '100%', background: '#3f6c52', color: '#fff', border: 'none', padding: '12px',
            borderRadius: '9px', fontWeight: '700', fontSize: '0.92rem', cursor: 'pointer', transition: 'opacity .15s'
          }}
        >
          {cargando ? 'Accediendo...' : 'Entrar al portal'}
        </button>

        {/* ══════════════ BOTONES RÁPIDOS MODO DESARROLLO ══════════════ */}
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px dashed #e9eaed' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', letterSpacing: '0.05em', color: '#a3aab5', textTransform: 'uppercase' }}>
              🛠️ Acceso Rápido (Modo Desarrollo)
            </span>
            <span style={{ fontSize: '0.68rem', background: '#f8f9fa', color: '#7c8592', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
              1 Clic
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {rolesDev.map(role => (
              <button
                key={role.titulo}
                type="button"
                disabled={cargando}
                onClick={() => handleQuickLogin(role.email, role.password)}
                style={{
                  background: role.bg,
                  color: role.color,
                  border: `1.5px solid ${role.color}33`,
                  borderRadius: '8px',
                  padding: '9px 10px',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'transform 0.1s, opacity 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <span>{role.icono}</span>
                <span>{role.titulo}</span>
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}