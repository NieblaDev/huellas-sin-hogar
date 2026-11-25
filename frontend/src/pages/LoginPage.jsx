import PatronHuellas from '../components/PatronHuellas.jsx';
import Button from '../components/ui/Button.jsx';
import IconButton from '@mui/material/IconButton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '../schemas/auth.schema.js';
import Input from '../components/ui/Input.jsx';
import { formatearErrorApi } from '../utils/errores';
import React, { useState } from 'react';
import { Crown, Eye, EyeOff, Handshake, House, Star, Stethoscope, Wrench } from 'lucide-react';
import { iniciarSesion } from '../services/auth.service.js';
import Logo from '../components/Logo';

export default function LoginPage({ onLoginSuccess }) {
  const [error, setError] = useState(null);
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const etiquetaVisibilidad = mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña';
  const { register, handleSubmit, reset, formState: { errors, isSubmitting: cargando } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: import.meta.env.DEV ? { email: 'directora@huellas.cl', password: 'admin123' } : { email: '', password: '' }
  });

  const rolesDev = import.meta.env.DEV ? [
    {
      titulo: 'Dirección',
      Icono: Crown,
      email: 'directora@huellas.cl',
      password: 'admin123',
      color: 'var(--portal-primary)',
      bg: 'var(--portal-primary-soft)'
    },
    {
      titulo: 'Personal veterinario',
      Icono: Stethoscope,
      email: 'veterinaria@huellas.cl',
      password: 'admin123',
      color: 'var(--portal-primary-dark)',
      bg: 'var(--portal-primary-soft)'
    },
    {
      titulo: 'Adopciones',
      Icono: House,
      email: 'adopciones@huellas.cl',
      password: 'admin123',
      color: '#6b3e84',
      bg: '#f2e3ff'
    },
    {
      titulo: 'Voluntariado avanzado',
      Icono: Star,
      email: 'voluntario.avanzado@huellas.cl',
      password: 'admin123',
      color: '#895100',
      bg: '#fff0ca'
    },
    {
      titulo: 'Voluntariado inicial',
      Icono: Handshake,
      email: 'voluntario@huellas.cl',
      password: 'admin123',
      color: '#4550c0',
      bg: '#e5e8ff'
    }
  ] : [];

  const handleLogin = async (credenciales) => {
    setError(null);
    try {
      const res = await iniciarSesion(credenciales);
      const data = await res.json();
      if (!res.ok) throw new Error(formatearErrorApi(data, 'Credenciales incorrectas'));
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch (err) {
      setError(formatearErrorApi(err));
    }
  };

  const handleQuickLogin = (email, password) => {
    reset({ email, password });
    handleSubmit(handleLogin)();
  };

  return (
    <div className="portal-login">
      <PatronHuellas />
      <form noValidate onSubmit={handleSubmit(handleLogin)} style={{
        background: 'var(--portal-surface)', padding: '32px', borderRadius: '18px', border: 'var(--portal-border-emphasis) solid var(--portal-border)',
        boxShadow: '0 8px 24px rgba(20,24,32,.06)', width: '100%', maxWidth: '420px', boxSizing: 'border-box'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '18px', background: 'var(--portal-primary-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px'
          }}>
            <Logo size={40} />
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: '800', margin: '8px 0 4px', color: '#1f2430' }}>Iniciar Sesión</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--portal-text-muted)', margin: 0 }}>Huellas Sin Hogar — Portal Staff</p>
        </div>

        {error && (
          <div style={{ background: '#ffe4e6', color: '#b82d44', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '16px', border: 'var(--portal-border-emphasis) solid #f3c9c4' }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '14px' }}>
          <Input label="Correo electrónico" type="email" autoComplete="username" error={errors.email} {...register('email')} />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <Input
            id="login-password"
            label="Contraseña"
            type={mostrarContrasena ? 'text' : 'password'}
            autoComplete="current-password"
            error={errors.password}
            {...register('password')}
            endAdornment={
              <IconButton
                type="button"
                edge="end"
                aria-label={etiquetaVisibilidad}
                title={etiquetaVisibilidad}
                aria-controls="login-password"
                onMouseDown={event => event.preventDefault()}
                onClick={() => setMostrarContrasena(valor => !valor)}
                sx={{ color: 'var(--portal-text-muted)' }}
              >
                {mostrarContrasena ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
              </IconButton>
            }
          />
        </div>

        <Button
          type="submit"
          cargando={cargando}
          style={{
            width: '100%', background: 'var(--portal-primary)', color: '#fff', border: 'none', padding: '12px',
            borderRadius: '9px', fontWeight: '700', fontSize: '0.92rem', cursor: 'pointer', transition: 'opacity .15s'
          }}
        >
          {cargando ? 'Accediendo...' : 'Entrar al portal'}
        </Button>

        {/* ══════════════ BOTONES RÁPIDOS MODO DESARROLLO ══════════════ */}
        {rolesDev.length > 0 && <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: 'var(--portal-border-emphasis) dashed var(--portal-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', letterSpacing: '0.05em', color: 'var(--portal-text-muted)', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <Wrench size={14} aria-hidden="true" /> Acceso Rápido (Modo Desarrollo)
            </span>
            <span style={{ fontSize: '0.68rem', background: 'var(--portal-surface-muted)', color: 'var(--portal-text-muted)', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
              1 Clic
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {rolesDev.map(role => (
              <Button
                key={role.titulo}
                type="button"
                disabled={cargando}
                onClick={() => handleQuickLogin(role.email, role.password)}
                style={{
                  background: role.bg,
                  color: role.color,
                  border: `var(--portal-border-emphasis) solid color-mix(in srgb, ${role.color} 20%, transparent)`,
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
                <role.Icono size={15} aria-hidden="true" />
                <span>{role.titulo}</span>
              </Button>
            ))}
          </div>
        </div>}
      </form>
    </div>
  );
}
