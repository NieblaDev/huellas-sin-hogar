import React, { useState } from 'react';
import { API_URL } from '../api/config';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('staff@huellas.cl');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
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

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <form onSubmit={handleSubmit} style={{
        background: '#fff', padding: '32px', borderRadius: '16px', border: '1px solid #e9eaed',
        boxShadow: '0 4px 16px rgba(20,24,32,.05)', width: '100%', maxWidth: '380px'
      }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '8px', color: '#1f2430' }}>Iniciar Sesión</h2>
        <p style={{ fontSize: '0.85rem', color: '#7c8592', marginBottom: '20px' }}>Huellas Sin Hogar — Portal Staff</p>
        {error && <div style={{ background: '#fbeae8', color: '#d1453b', padding: '10px', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '14px' }}>{error}</div>}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '6px' }}>Correo Electrónico</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #e9eaed', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '6px' }}>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #e9eaed', boxSizing: 'border-box' }} />
        </div>
        <button type="submit" disabled={cargando} style={{ width: '100%', background: '#3f6c52', color: '#fff', border: 'none', padding: '12px', borderRadius: '9px', fontWeight: '700', cursor: 'pointer' }}>
          {cargando ? 'Accediendo...' : 'Entrar al portal'}
        </button>
      </form>
    </div>
  );
}