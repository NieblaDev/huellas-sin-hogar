import { useEffect, useState } from 'react';
import { request } from '../services/api.js';
import { usePortalFeedback } from '../context/PortalFeedback.jsx';

export default function useLecturasNotificaciones(claves) {
  const [leidas, setLeidas] = useState(() => new Set());
  const { avisar } = usePortalFeedback();
  const lista = JSON.stringify(claves);

  useEffect(() => {
    const actuales = JSON.parse(lista);
    if (!actuales.length || !localStorage.getItem('token')) return;
    const controller = new AbortController();
    async function consultar() {
      try {
        const guardadas = [];
        for (let i = 0; i < actuales.length; i += 60) {
          const respuesta = await request('/lecturas-notificaciones/consultar', {
            method: 'POST', json: { claves: actuales.slice(i, i + 60) }, signal: controller.signal
          });
          if (!respuesta.ok) throw new Error();
          guardadas.push(...await respuesta.json());
        }
        if (!controller.signal.aborted) setLeidas(prev => new Set([...prev, ...guardadas]));
      } catch {
        if (!controller.signal.aborted) avisar('No se pudo consultar qué avisos has leído.', 'error');
      }
    }
    consultar();
    return () => controller.abort();
  }, [lista, avisar]);

  async function marcar(clave) {
    try {
      const respuesta = await request('/lecturas-notificaciones', { method: 'PUT', json: { clave } });
      if (!respuesta.ok) throw new Error();
      setLeidas(prev => new Set([...prev, clave]));
    } catch {
      avisar('No se pudo marcar el aviso como leído. Inténtalo nuevamente.', 'error');
    }
  }

  return { leidas, marcar, pendientes: claves.filter(clave => !leidas.has(clave)).length };
}
