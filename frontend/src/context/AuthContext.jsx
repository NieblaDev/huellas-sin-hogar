import React, { createContext, useContext, useEffect, useState } from 'react';
import { obtenerSesion } from '../services/auth.service.js';
import { clearStoredSession, readStoredSession } from '../utils/session.js';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [restaurando, setRestaurando] = useState(() => Boolean(readStoredSession(localStorage)));

  useEffect(() => {
    const session = readStoredSession(localStorage);
    if (!session) return;
    const controller = new AbortController();

    async function restaurar() {
      try {
        const response = await obtenerSesion(session.token, controller.signal);
        const data = response.ok ? await response.json() : null;
        if (controller.signal.aborted || localStorage.getItem('token') !== session.token) return;
        if (data?.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
          setUser(data.user);
        } else if (response.status === 401 || response.status === 403) {
          clearStoredSession(localStorage);
        }
      } catch {
        // La pantalla de ingreso queda disponible si falla la conexión.
      } finally {
        if (!controller.signal.aborted) setRestaurando(false);
      }
    }

    restaurar();
    return () => controller.abort();
  }, []);

  const cerrarSesion = () => {
    clearStoredSession(localStorage);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, setUser, restaurando, cerrarSesion }}>{children}</AuthContext.Provider>;
}
