import React, { useState, useEffect } from 'react';
import { API_URL, getAuthHeaders } from '../api/config';

export default function AnimalCatalogo({ onOpenModal, reloadKey }) {
  const [animales, setAnimales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [search, setSearch] = useState('');
  const [especie, setEspecie] = useState('');

  // Notificaciones del personal del refugio (RF8 y RF9)
  const [notificaciones, setNotificaciones] = useState([]);
  const [mostrarNotificaciones, setMostrarNotificaciones] = useState(false);
  const [avisoReciente, setAvisoReciente] = useState(null);

  // Modal de Ficha Técnica Individual y Exportación de Expediente (RF8 y RF9)
  const [fichaSeleccionada, setFichaSeleccionada] = useState(null);
  const [cargandoFicha, setCargandoFicha] = useState(false);
  const [descargandoId, setDescargandoId] = useState(null);

  // Módulo / Panel de Configuración de Reportes Consolidados (RF9)
  const [mostrarConfigReporte, setMostrarConfigReporte] = useState(false);
  const [descargandoConsolidado, setDescargandoConsolidado] = useState(false);
  const [configReporte, setConfigReporte] = useState({
    fechaDesde: '',
    fechaHasta: '',
    tipoInformacion: 'TODOS',
    especie: '',
    estadoSalud: '',
    tipoIngreso: '',
    formato: 'CSV'
  });

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  })();

  const rolUsuario = currentUser?.rol || 'VOLUNTARIO_NOVATO';
  const esDirectora = rolUsuario === 'DIRECTORA';
  const puedeExportarExpediente = ['DIRECTORA', 'VETERINARIA', 'ENCARGADA_ADOPCIONES'].includes(rolUsuario);

  useEffect(() => {
    fetchAnimals();
    fetchNotificaciones();
  }, [search, especie, reloadKey]);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail) {
        setAvisoReciente(e.detail.mensaje || e.detail.titulo);
        fetchNotificaciones();
        setTimeout(() => setAvisoReciente(null), 6500);
      }
    };
    window.addEventListener('refugio:notificacion', handler);
    return () => window.removeEventListener('refugio:notificacion', handler);
  }, []);

  const fetchAnimals = async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (especie) params.append('especie', especie);
      const res = await fetch(`${API_URL}/animals?${params.toString()}`, { headers: getAuthHeaders() });
      const data = await res.json();
      setAnimales(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  const fetchNotificaciones = async () => {
    try {
      const res = await fetch(`${API_URL}/animals/notificaciones?limit=10`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setNotificaciones(data.notificaciones || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const abrirFichaTecnica = async (animalId) => {
    setCargandoFicha(true);
    try {
      const res = await fetch(`${API_URL}/animals/${animalId}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar ficha técnica');
      setFichaSeleccionada(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setCargandoFicha(false);
    }
  };

  const handleExportExpediente = async (animal, formato = 'PDF', e) => {
    if (e) e.stopPropagation();
    if (!puedeExportarExpediente) {
      alert('Acceso restringido: Solo el Personal del Refugio y la Directora están autorizados para exportar expedientes.');
      return;
    }

    setDescargandoId(`${animal.id}-${formato}`);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/animals/${animal.id}/export-pdf?formato=${formato}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `No se pudo exportar el expediente en ${formato}`);
      }

      const notifHeader = res.headers.get('X-Notification-Message');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = (animal.nombre || 'animal').toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const ext = formato.toLowerCase() === 'csv' ? 'csv' : 'pdf';
      link.download = `ficha_tecnica_${safeName}_${animal.id}.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      const msgNotif = notifHeader
        ? decodeURIComponent(notifHeader)
        : `Expediente ${formato} de ${animal.nombre} exportado (datos personales de postulantes omitidos por privacidad).`;
      setAvisoReciente(msgNotif);
      setTimeout(() => setAvisoReciente(null), 6500);
      fetchNotificaciones();
    } catch (err) {
      alert(err.message);
    } finally {
      setDescargandoId(null);
    }
  };

  const handleExportConsolidado = async (e) => {
    if (e) e.preventDefault();
    if (!esDirectora) {
      alert('Acceso denegado: El sistema genera reportes consolidados solo si el usuario posee rol de Directora.');
      return;
    }

    setDescargandoConsolidado(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (configReporte.fechaDesde) params.append('fechaDesde', configReporte.fechaDesde);
      if (configReporte.fechaHasta) params.append('fechaHasta', configReporte.fechaHasta);
      if (configReporte.tipoInformacion) params.append('tipoInformacion', configReporte.tipoInformacion);
      if (configReporte.especie) params.append('especie', configReporte.especie);
      if (configReporte.estadoSalud) params.append('estadoSalud', configReporte.estadoSalud);
      if (configReporte.tipoIngreso) params.append('tipoIngreso', configReporte.tipoIngreso);
      if (configReporte.formato) params.append('formato', configReporte.formato);

      const res = await fetch(`${API_URL}/animals/reportes/export-csv?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'No se pudo exportar el reporte consolidado');
      }

      const notifHeader = res.headers.get('X-Notification-Message');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fecha = new Date().toISOString().split('T')[0];
      const ext = configReporte.formato === 'PDF' ? 'pdf' : 'csv';
      link.download = `reporte_consolidado_${configReporte.tipoInformacion.toLowerCase()}_${fecha}.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      const msgNotif = notifHeader
        ? decodeURIComponent(notifHeader)
        : `Reporte consolidado (${configReporte.formato}) descargado. Registrado en bitácora de auditoría.`;
      setAvisoReciente(msgNotif);
      setTimeout(() => setAvisoReciente(null), 6500);
      fetchNotificaciones();
    } catch (err) {
      alert(err.message);
    } finally {
      setDescargandoConsolidado(false);
    }
  };

  const handleDelete = async (id, nombre, e) => {
    e.stopPropagation();
    if (!window.confirm(`¿Estás seguro de que deseas dar de baja lógica a ${nombre}? Se guardará en la auditoría del refugio.`)) return;

    try {
      const res = await fetch(`${API_URL}/animals/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Error al dar de baja');
      setAnimales(animales.filter((a) => a.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const badgeMap = {
    NORMAL: { bg: '#e8f0e8', color: '#2f5540', label: 'Normal' },
    CONDICION_ESPECIAL: { bg: '#faf1de', color: '#d99a3d', label: 'Especial' },
    CRITICO: { bg: '#fbeae8', color: '#d1453b', label: 'Crítico' }
  };

  const limpiarNotaCausal = (nota) => (nota || '').replace(/^\[Ingreso por (Rescate|Abandono|Decomiso)\]\s*/i, '');

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '24px' }}>
      {/* ENCABEZADO Y ACCIONES DE REGISTRO / EXPORTACIÓN */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#1f2430', margin: 0 }}>
            Registro de Ingreso, Fichas Técnicas y Reportes
          </h2>
          <p style={{ color: '#7c8592', fontSize: '0.88rem', margin: '4px 0 0' }}>
            RF8: Ingreso por rescate, abandono o decomiso · RF9: Exportación de expedientes y reportes consolidados (PDF / CSV)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Botón Bandeja de Notificaciones del Personal */}
          <button
            type="button"
            onClick={() => setMostrarNotificaciones(!mostrarNotificaciones)}
            style={{
              background: mostrarNotificaciones ? '#eef3ec' : '#fff',
              color: '#2f5540',
              padding: '10px 14px',
              borderRadius: '9px',
              border: '1.5px solid #c9dfcd',
              fontWeight: '700',
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🔔 <span>Notificaciones Personal</span>
            <span
              style={{
                background: '#3f6c52',
                color: '#fff',
                borderRadius: '999px',
                padding: '1px 7px',
                fontSize: '0.72rem'
              }}
            >
              {notificaciones.length}
            </span>
          </button>

          {/* RF9: Botón Módulo de Reportes Consolidados (Exclusivo Directora) */}
          {esDirectora ? (
            <button
              type="button"
              onClick={() => setMostrarConfigReporte(!mostrarConfigReporte)}
              style={{
                background: mostrarConfigReporte ? '#313a9e' : '#4550c0',
                color: '#fff',
                padding: '10px 16px',
                borderRadius: '9px',
                border: 'none',
                fontWeight: '700',
                fontSize: '0.84rem',
                cursor: 'pointer'
              }}
            >
              📊 {mostrarConfigReporte ? 'Cerrar Módulo de Reportes' : 'Configurar y Exportar Reportes (PDF/CSV)'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                alert('Restricción RF9: El sistema genera reportes consolidados solo si el usuario posee rol de Directora.')
              }
              title="Restringido: Solo el rol Directora puede generar reportes consolidados de gestión"
              style={{
                background: '#f0f1f3',
                color: '#7c8592',
                padding: '10px 14px',
                borderRadius: '9px',
                border: '1px solid #d6d9e0',
                fontWeight: '700',
                fontSize: '0.8rem',
                cursor: 'not-allowed'
              }}
            >
              🔒 Reportes Consolidados (Solo Directora)
            </button>
          )}

          {/* RF8: Botón Registrar Ingreso Animal */}
          <button
            type="button"
            onClick={onOpenModal}
            style={{
              background: '#3f6c52',
              color: '#fff',
              padding: '10px 18px',
              borderRadius: '9px',
              border: 'none',
              fontWeight: '700',
              fontSize: '0.86rem',
              cursor: 'pointer'
            }}
          >
            + Registrar ingreso de animal
          </button>
        </div>
      </div>

      {/* MÓDULO DE CONFIGURACIÓN Y EXPORTACIÓN DE REPORTES CONSOLIDADOS (RF9 - SOLO DIRECTORA) */}
      {esDirectora && mostrarConfigReporte && (
        <form
          onSubmit={handleExportConsolidado}
          style={{
            background: '#fff',
            border: '1.5px solid #c5cbf5',
            borderRadius: '16px',
            padding: '20px 22px',
            marginBottom: '22px',
            boxShadow: '0 4px 16px rgba(69,80,192,0.08)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <strong style={{ fontSize: '1rem', color: '#1f2430', display: 'block' }}>
                📊 Módulo de Reportes Consolidados de Gestión Operativa (RF9)
              </strong>
              <span style={{ fontSize: '0.78rem', color: '#7c8592' }}>
                Configura rangos de fecha, tipo de información (ingresos, adopciones, devoluciones, censo e insumos), filtros y formato digital.
              </span>
            </div>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: '800',
                background: '#fbeae8',
                color: '#d1453b',
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #f3c9c4'
              }}
            >
              🔒 Privacidad RF9: Omite estrictamente datos personales de postulantes
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '12px',
              marginBottom: '14px'
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px', textTransform: 'uppercase' }}>
                Fecha Desde
              </label>
              <input
                type="date"
                value={configReporte.fechaDesde}
                onChange={(e) => setConfigReporte({ ...configReporte, fechaDesde: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1.5px solid #e9eaed', boxSizing: 'border-box', fontSize: '0.84rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px', textTransform: 'uppercase' }}>
                Fecha Hasta
              </label>
              <input
                type="date"
                value={configReporte.fechaHasta}
                onChange={(e) => setConfigReporte({ ...configReporte, fechaHasta: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1.5px solid #e9eaed', boxSizing: 'border-box', fontSize: '0.84rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px', textTransform: 'uppercase' }}>
                Tipo de Información
              </label>
              <select
                value={configReporte.tipoInformacion}
                onChange={(e) => setConfigReporte({ ...configReporte, tipoInformacion: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1.5px solid #e9eaed', background: '#fff', fontSize: '0.84rem' }}
              >
                <option value="TODOS">Consolidado Completo (Todos)</option>
                <option value="INGRESOS">Balance de Ingresos</option>
                <option value="ADOPCIONES">Balance de Adopciones</option>
                <option value="DEVOLUCIONES">Balance de Devoluciones</option>
                <option value="CENSO">Censo y Capacidad</option>
                <option value="INSUMOS">Estado de Insumos</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px', textTransform: 'uppercase' }}>
                Filtro Especie
              </label>
              <select
                value={configReporte.especie}
                onChange={(e) => setConfigReporte({ ...configReporte, especie: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1.5px solid #e9eaed', background: '#fff', fontSize: '0.84rem' }}
              >
                <option value="">Todas las especies</option>
                <option value="Perro">Perro (Canina)</option>
                <option value="Gato">Gato (Felina)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px', textTransform: 'uppercase' }}>
                Filtro Causal Ingreso
              </label>
              <select
                value={configReporte.tipoIngreso}
                onChange={(e) => setConfigReporte({ ...configReporte, tipoIngreso: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1.5px solid #e9eaed', background: '#fff', fontSize: '0.84rem' }}
              >
                <option value="">Todas las causales</option>
                <option value="Rescate">Rescate</option>
                <option value="Abandono">Abandono</option>
                <option value="Decomiso">Decomiso</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px', textTransform: 'uppercase' }}>
                Formato Estándar
              </label>
              <select
                value={configReporte.formato}
                onChange={(e) => setConfigReporte({ ...configReporte, formato: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1.5px solid #e9eaed', background: '#fff', fontWeight: '700', fontSize: '0.84rem' }}
              >
                <option value="CSV">CSV (Planilla / Datos)</option>
                <option value="PDF">PDF (Documento Oficial)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={() =>
                setConfigReporte({
                  fechaDesde: '',
                  fechaHasta: '',
                  tipoInformacion: 'TODOS',
                  especie: '',
                  estadoSalud: '',
                  tipoIngreso: '',
                  formato: 'CSV'
                })
              }
              style={{
                padding: '8px 14px',
                background: '#f8f9fa',
                color: '#7c8592',
                border: '1px solid #e9eaed',
                borderRadius: '7px',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              Limpiar Filtros
            </button>
            <button
              type="submit"
              disabled={descargandoConsolidado}
              style={{
                padding: '8px 18px',
                background: '#4550c0',
                color: '#fff',
                border: 'none',
                borderRadius: '7px',
                fontWeight: '700',
                fontSize: '0.84rem',
                cursor: 'pointer'
              }}
            >
              {descargandoConsolidado
                ? 'Generando reporte...'
                : `⬇️ Generar y Descargar Reporte Consolidado (${configReporte.formato})`}
            </button>
          </div>
        </form>
      )}

      {/* BANNER EN TIEMPO REAL DE NOTIFICACIÓN AL PERSONAL DEL REFUGIO */}
      {avisoReciente && (
        <div
          style={{
            background: '#eef3ec',
            borderLeft: '5px solid #3f6c52',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 2px 8px rgba(20,24,32,0.05)'
          }}
        >
          <div>
            <strong style={{ color: '#2f5540', fontSize: '0.86rem', display: 'block' }}>
              🔔 Notificación disparada al Personal del Refugio
            </strong>
            <span style={{ color: '#1f2430', fontSize: '0.82rem' }}>{avisoReciente}</span>
          </div>
          <button
            type="button"
            onClick={() => setAvisoReciente(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#7c8592', fontWeight: '700' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* PANEL DESPLEGABLE DE NOTIFICACIONES DEL PERSONAL DEL REFUGIO */}
      {mostrarNotificaciones && (
        <div
          style={{
            background: '#fff',
            border: '1px solid #c9dfcd',
            borderRadius: '14px',
            padding: '16px 20px',
            marginBottom: '20px',
            boxShadow: '0 4px 12px rgba(20,24,32,0.05)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <strong style={{ fontSize: '0.92rem', color: '#1f2430' }}>
              📬 Bandeja de Notificaciones del Personal del Refugio (Ingresos y Exportaciones)
            </strong>
            <button
              type="button"
              onClick={() => setMostrarNotificaciones(false)}
              style={{ background: 'none', border: 'none', color: '#7c8592', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              Cerrar ✕
            </button>
          </div>
          {notificaciones.length === 0 ? (
            <div style={{ fontSize: '0.82rem', color: '#7c8592' }}>No hay notificaciones recientes.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
              {notificaciones.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: '9px 12px',
                    background: n.tipo === 'INGRESO_ANIMAL' ? '#f5f9f6' : '#edeffb',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <div>
                    <strong style={{ color: '#1f2430' }}>{n.titulo}</strong>
                    <div style={{ color: '#555e6d', marginTop: '2px' }}>{n.mensaje}</div>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#7c8592', whiteSpace: 'nowrap' }}>
                    {new Date(n.fechaHora).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BUSCADOR Y FILTROS */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: '220px', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e9eaed', fontSize: '0.88rem' }}
        />
        <select
          value={especie}
          onChange={(e) => setEspecie(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e9eaed', fontSize: '0.88rem', background: '#fff' }}
        >
          <option value="">Todas las especies</option>
          <option value="Perro">Perros (Canina)</option>
          <option value="Gato">Gatos (Felina)</option>
        </select>
      </div>

      {/* LISTADO DE FICHAS DE ANIMALES */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#7c8592' }}>Cargando catálogo...</div>
      ) : animales.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px',
            background: '#fff',
            borderRadius: '14px',
            border: '1px solid #e9eaed',
            color: '#7c8592'
          }}
        >
          No se encontraron animales activos.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '18px' }}>
          {animales.map((a) => {
            const badge = badgeMap[a.estadoSalud] || badgeMap.NORMAL;
            return (
              <div
                key={a.id}
                onClick={() => abrirFichaTecnica(a.id)}
                style={{
                  background: '#fff',
                  borderRadius: '16px',
                  border: '1px solid #e9eaed',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(20,24,32,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer'
                }}
              >
                <div
                  style={{
                    height: '160px',
                    background: '#f0f1f3',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {a.fotoUrl ? (
                    <img src={a.fotoUrl} alt={a.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '3rem' }}>🐾</span>
                  )}
                  <span
                    style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      background: 'rgba(31,36,48,0.75)',
                      color: '#fff',
                      padding: '3px 9px',
                      borderRadius: '7px',
                      fontSize: '0.68rem',
                      fontWeight: '700'
                    }}
                  >
                    {a.tipoIngreso || 'Rescate'}
                  </span>
                  <span
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: badge.bg,
                      color: badge.color,
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.72rem',
                      fontWeight: '800'
                    }}
                  >
                    {badge.label}
                  </span>
                </div>

                <div style={{ padding: '18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1f2430' }}>{a.nombre}</h3>
                      <span style={{ fontSize: '0.8rem', color: '#7c8592' }}>
                        {a.especie} · {a.sexo} · {a.edad || 'Edad desconocida'}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#a3aab5', fontWeight: '700' }}>#{a.id}</span>
                  </div>

                  {/* Canil asignado en tiempo real */}
                  <div
                    style={{
                      margin: '8px 0',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      background: a.canil ? '#e8f0e8' : '#f8f9fa',
                      border: a.canil ? '1px solid #c9dfcd' : '1px dashed #e9eaed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.76rem'
                    }}
                  >
                    <span>🚪</span>
                    <span>
                      Ubicación: <strong>{a.canil ? `${a.canil.nombre} (${a.canil.sector})` : 'Sin canil asignado'}</strong>
                    </span>
                  </div>

                  <p style={{ fontSize: '0.81rem', color: '#555e6d', margin: '0 0 12px', flex: 1 }}>
                    {limpiarNotaCausal(a.nota) || 'Sin antecedentes clínicos registrados.'}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid #f0f1f3',
                      paddingTop: '12px',
                      gap: '6px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <span style={{ fontSize: '0.73rem', color: '#7c8592' }}>
                      {a.raza || 'Desconocida'} · {a.peso > 0 ? `${a.peso} kg` : 'Peso s/i'}
                    </span>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirFichaTecnica(a.id);
                        }}
                        style={{
                          background: '#eef3ec',
                          border: '1px solid #c9dfcd',
                          color: '#2f5540',
                          padding: '5px 9px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        📋 Ficha
                      </button>

                      {puedeExportarExpediente && (
                        <button
                          type="button"
                          onClick={(e) => handleExportExpediente(a, 'PDF', e)}
                          disabled={descargandoId === `${a.id}-PDF`}
                          title="Exportar Expediente / Ficha Técnica en PDF (omite datos personales de postulantes por privacidad RF9)"
                          style={{
                            background: '#edeffb',
                            border: '1px solid #c5cbf5',
                            color: '#4550c0',
                            padding: '5px 9px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          {descargandoId === `${a.id}-PDF` ? '...' : '📄 PDF'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => handleDelete(a.id, a.nombre, e)}
                        style={{
                          background: '#fbeae8',
                          border: '1px solid #f3c9c4',
                          color: '#d1453b',
                          padding: '5px 9px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        Baja
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE FICHA TÉCNICA INDIVIDUAL */}
      {(fichaSeleccionada || cargandoFicha) && (
        <div
          onClick={() => !cargandoFicha && setFichaSeleccionada(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20,24,32,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '18px',
              padding: '26px',
              width: '100%',
              maxWidth: '640px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 16px 40px rgba(20,24,32,0.25)'
            }}
          >
            {cargandoFicha || !fichaSeleccionada ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#7c8592' }}>Cargando ficha técnica individual...</div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div
                      style={{
                        width: '68px',
                        height: '68px',
                        borderRadius: '14px',
                        background: '#e8f0e8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        flexShrink: 0
                      }}
                    >
                      {fichaSeleccionada.fotoUrl ? (
                        <img
                          src={fichaSeleccionada.fotoUrl}
                          alt={fichaSeleccionada.nombre}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span style={{ fontSize: '2rem' }}>🐾</span>
                      )}
                    </div>
                    <div>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          background: '#eef3ec',
                          color: '#2f5540',
                          padding: '2px 8px',
                          borderRadius: '6px'
                        }}
                      >
                        Ficha Técnica #{fichaSeleccionada.id} · Ingreso por {fichaSeleccionada.tipoIngreso || 'Rescate'}
                      </span>
                      <h3 style={{ margin: '6px 0 2px', fontSize: '1.35rem', color: '#1f2430' }}>{fichaSeleccionada.nombre}</h3>
                      <span style={{ fontSize: '0.82rem', color: '#7c8592' }}>
                        {fichaSeleccionada.especie} · {fichaSeleccionada.sexo} · Edad: {fichaSeleccionada.edad || 'Desconocida'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFichaSeleccionada(null)}
                    style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#7c8592' }}
                  >
                    ✕
                  </button>
                </div>

                {/* Datos Generales y Clínicos */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    background: '#f8f9fa',
                    padding: '14px',
                    borderRadius: '12px',
                    marginBottom: '14px',
                    fontSize: '0.82rem'
                  }}
                >
                  <div>
                    <strong style={{ color: '#7c8592' }}>Raza:</strong> {fichaSeleccionada.raza || 'Desconocida'}
                  </div>
                  <div>
                    <strong style={{ color: '#7c8592' }}>Peso:</strong>{' '}
                    {fichaSeleccionada.peso > 0 ? `${fichaSeleccionada.peso} kg` : 'No registrado'}
                  </div>
                  <div>
                    <strong style={{ color: '#7c8592' }}>Microchip:</strong> {fichaSeleccionada.chip || 'Sin microchip'}
                  </div>
                  <div>
                    <strong style={{ color: '#7c8592' }}>Estado de Salud:</strong> {fichaSeleccionada.estadoSalud}
                  </div>
                  <div>
                    <strong style={{ color: '#7c8592' }}>Esterilización:</strong> {fichaSeleccionada.esterilizacion || 'Desconocido'}
                  </div>
                  <div>
                    <strong style={{ color: '#7c8592' }}>Ubicación / Canil:</strong>{' '}
                    {fichaSeleccionada.canil ? `${fichaSeleccionada.canil.nombre} (${fichaSeleccionada.canil.sector})` : 'Sin asignar'}
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong style={{ color: '#7c8592' }}>Comportamiento:</strong> {fichaSeleccionada.comportamiento || 'Por evaluar'}
                  </div>
                </div>

                {/* Historial Médico / Notas Clínicas */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: '800', textTransform: 'uppercase', color: '#7c8592', marginBottom: '6px' }}>
                    🩺 Antecedentes Clínicos e Historial Médico
                  </div>
                  <div
                    style={{
                      background: '#faf1de',
                      borderLeft: '4px solid #d99a3d',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontSize: '0.84rem',
                      color: '#1f2430'
                    }}
                  >
                    {limpiarNotaCausal(fichaSeleccionada.nota) || 'Sin antecedentes médicos registrados.'}
                  </div>
                </div>

                {/* Sección de Postulantes / Adopciones con Privacidad RF9 */}
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: '800', textTransform: 'uppercase', color: '#7c8592', marginBottom: '6px' }}>
                    📋 Trazabilidad de Adopciones y Devoluciones
                  </div>
                  <div
                    style={{
                      background: '#fbeae8',
                      border: '1px solid #f3c9c4',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      color: '#d1453b',
                      marginBottom: '8px'
                    }}
                  >
                    🔒 <strong>Política de Privacidad RF9:</strong> Al exportar expedientes o reportes (PDF/CSV), los datos personales de
                    postulantes se omiten estrictamente en el documento generado.
                  </div>
                  {!fichaSeleccionada.adopciones || fichaSeleccionada.adopciones.length === 0 ? (
                    <div style={{ fontSize: '0.82rem', color: '#7c8592', padding: '4px 0' }}>
                      No existen solicitudes de adopción asociadas a este animal.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {fichaSeleccionada.adopciones.map((ad) => (
                        <div
                          key={ad.id}
                          style={{
                            padding: '10px 12px',
                            background: '#f5f9f6',
                            border: '1px solid #c9dfcd',
                            borderRadius: '8px',
                            fontSize: '0.8rem'
                          }}
                        >
                          <strong>Solicitud #{ad.id}</strong> — Etapa: <strong>{ad.etapa}</strong> · Devolución:{' '}
                          <strong>{ad.devolucion ? 'Sí' : 'No'}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Botones de Acción del Modal */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid #f0f1f3',
                    paddingTop: '14px',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}
                >
                  {puedeExportarExpediente ? (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={(e) => handleExportExpediente(fichaSeleccionada, 'PDF', e)}
                        disabled={descargandoId === `${fichaSeleccionada.id}-PDF`}
                        style={{
                          background: '#3f6c52',
                          color: '#fff',
                          border: 'none',
                          padding: '9px 14px',
                          borderRadius: '8px',
                          fontWeight: '700',
                          fontSize: '0.82rem',
                          cursor: 'pointer'
                        }}
                      >
                        {descargandoId === `${fichaSeleccionada.id}-PDF` ? 'Generando PDF...' : '📄 Exportar Expediente (PDF)'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleExportExpediente(fichaSeleccionada, 'CSV', e)}
                        disabled={descargandoId === `${fichaSeleccionada.id}-CSV`}
                        style={{
                          background: '#4550c0',
                          color: '#fff',
                          border: 'none',
                          padding: '9px 14px',
                          borderRadius: '8px',
                          fontWeight: '700',
                          fontSize: '0.82rem',
                          cursor: 'pointer'
                        }}
                      >
                        {descargandoId === `${fichaSeleccionada.id}-CSV` ? 'Generando CSV...' : '📊 Exportar Expediente (CSV)'}
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: '#7c8592' }}>
                      🔒 Exportación de expedientes habilitada para Personal del Refugio y Directora
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setFichaSeleccionada(null)}
                    style={{
                      background: '#f8f9fa',
                      border: '1px solid #e9eaed',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}