import React, { useState, useEffect } from 'react';
import { API_URL, getAuthHeaders } from '../api/config';

export default function AuditoriaModulo({ user }) {
  const [auditorias, setAuditorias] = useState([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Filtros
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroEntidad, setFiltroEntidad] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // Registro seleccionado para ver detalle de Diff (valor anterior vs nuevo)
  const [detalleRegistro, setDetalleRegistro] = useState(null);

  useEffect(() => {
    fetchAuditorias();
  }, []);

  const fetchAuditorias = async () => {
    setCargando(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filtroUsuario) params.append('usuarioResponsable', filtroUsuario);
      if (filtroEntidad) params.append('entidad', filtroEntidad);
      if (fechaDesde) params.append('fechaDesde', fechaDesde);
      if (fechaHasta) params.append('fechaHasta', fechaHasta);

      const res = await fetch(`${API_URL}/auditoria?${params.toString()}`, {
        headers: getAuthHeaders()
      });

      if (res.status === 403) {
        throw new Error('Acceso restringido: Módulo exclusivo para la Directora del refugio');
      }

      if (!res.ok) throw new Error('Error al consultar bitácora de auditoría');

      const data = await res.json();
      setAuditorias(data.registros || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    fetchAuditorias();
  };

  const handleLimpiarFiltros = () => {
    setFiltroUsuario('');
    setFiltroEntidad('');
    setFechaDesde('');
    setFechaHasta('');
    setTimeout(fetchAuditorias, 0);
  };

  const accionColor = {
    CREACION: { bg: '#e8f0e8', color: '#2f5540', label: 'Creación' },
    MODIFICACION: { bg: '#edeffb', color: '#4550c0', label: 'Modificación' },
    BAJA_LOGICA: { bg: '#fbeae8', color: '#d1453b', label: 'Baja Lógica' }
  };

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '24px' }}>
      {/* ENCABEZADO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#1f2430', margin: 0 }}>
            🛡️ Módulo de Auditoría y Trazabilidad
          </h2>
          <p style={{ color: '#7c8592', fontSize: '0.88rem', margin: '4px 0 0' }}>
            Bitácora histórica inmutable de solo lectura. Registro automático de creaciones, modificaciones y bajas lógicas.
          </p>
        </div>
        <div style={{
          background: '#f8f9fa', border: '1px solid #e9eaed', borderRadius: '8px', padding: '6px 14px',
          fontSize: '0.78rem', color: '#7c8592', display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          <span>🔒</span> Solo lectura (Inmutable)
        </div>
      </div>

      {error && (
        <div style={{ background: '#fbeae8', border: '1px solid #f3c9c4', color: '#d1453b', padding: '14px', borderRadius: '10px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* BARRA DE FILTROS */}
      <form onSubmit={handleFiltrar} style={{
        background: '#fff', borderRadius: '14px', border: '1px solid #e9eaed', padding: '18px 20px',
        marginBottom: '22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'flex-end'
      }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px', textTransform: 'uppercase' }}>
            Usuario Responsable
          </label>
          <input
            type="text"
            placeholder="Nombre o correo..."
            value={filtroUsuario}
            onChange={e => setFiltroUsuario(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1.5px solid #e9eaed', fontSize: '0.85rem', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px', textTransform: 'uppercase' }}>
            Entidad Afectada
          </label>
          <select
            value={filtroEntidad}
            onChange={e => setFiltroEntidad(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1.5px solid #e9eaed', fontSize: '0.85rem', boxSizing: 'border-box' }}
          >
            <option value="">Todas las entidades</option>
            <option value="Animal">Ficha Animal</option>
            <option value="Postulante">Postulantes Adopción</option>
            <option value="Inventario">Inventario / Insumos</option>
            <option value="Canil">Caniles / Espacios</option>
            <option value="Traslado">Traslados</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px', textTransform: 'uppercase' }}>
            Fecha Desde
          </label>
          <input
            type="date"
            value={fechaDesde}
            onChange={e => setFechaDesde(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1.5px solid #e9eaed', fontSize: '0.85rem', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px', textTransform: 'uppercase' }}>
            Fecha Hasta
          </label>
          <input
            type="date"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1.5px solid #e9eaed', fontSize: '0.85rem', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="submit"
            style={{ flex: 1, padding: '9px', background: '#3f6c52', color: '#fff', border: 'none', borderRadius: '7px', fontWeight: '700', fontSize: '0.84rem', cursor: 'pointer' }}
          >
            🔍 Filtrar
          </button>
          <button
            type="button"
            onClick={handleLimpiarFiltros}
            style={{ padding: '9px 12px', background: '#f8f9fa', color: '#7c8592', border: '1.5px solid #e9eaed', borderRadius: '7px', fontWeight: '700', fontSize: '0.84rem', cursor: 'pointer' }}
          >
            Limpiar
          </button>
        </div>
      </form>

      {/* TABLA DE AUDITORÍA */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e9eaed', overflow: 'hidden', boxShadow: '0 1px 3px rgba(20,24,32,0.03)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f1f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: '700', color: '#1f2430' }}>
            Total de registros encontrados: {total}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#7c8592' }}>
            Protección de integridad: No se permite edición ni eliminación de entradas
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '1.5px solid #e9eaed', textAlign: 'left', color: '#7c8592' }}>
                <th style={{ padding: '12px 16px' }}>Fecha y Hora</th>
                <th style={{ padding: '12px 16px' }}>Usuario Responsable</th>
                <th style={{ padding: '12px 16px' }}>Entidad Afectada</th>
                <th style={{ padding: '12px 16px' }}>Acción</th>
                <th style={{ padding: '12px 16px' }}>ID Registro</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Comparativa de Valores</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#7c8592' }}>
                    Cargando bitácora de auditoría...
                  </td>
                </tr>
              ) : auditorias.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#a3aab5' }}>
                    No se encontraron registros que coincidan con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                auditorias.map(item => {
                  const badge = accionColor[item.accion] || { bg: '#e9eaed', color: '#7c8592', label: item.accion };
                  const fechaObj = new Date(item.fechaHora);

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f0f1f3' }}>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <strong>{fechaObj.toLocaleDateString()}</strong>{' '}
                        <span style={{ color: '#7c8592' }}>{fechaObj.toLocaleTimeString()}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <strong>{item.usuarioNombre || 'Sistema'}</strong>
                        <div style={{ fontSize: '0.74rem', color: '#7c8592' }}>{item.usuarioEmail || 'Automático'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: '#1f2430' }}>
                        {item.entidad}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: '800', padding: '3px 8px', borderRadius: '6px',
                          background: badge.bg, color: badge.color, textTransform: 'uppercase'
                        }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#7c8592' }}>
                        #{item.entidadId || '—'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          onClick={() => setDetalleRegistro(item)}
                          style={{
                            background: '#f0f1f3', border: 'none', padding: '5px 12px', borderRadius: '6px',
                            fontSize: '0.76rem', fontWeight: '700', color: '#1f2430', cursor: 'pointer'
                          }}
                        >
                          Ver Diff / Detalle 🔍
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DETALLE DE VALOR ANTERIOR VS VALOR NUEVO */}
      {detalleRegistro && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(20,24,32,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '16px'
        }}>
          <div style={{
            background: '#fff', borderRadius: '18px', padding: '24px', width: '100%', maxWidth: '780px',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 40px rgba(20,24,32,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#1f2430' }}>
                  Auditoría #{detalleRegistro.id} — {detalleRegistro.entidad} ({detalleRegistro.accion})
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#7c8592' }}>
                  Registrado el {new Date(detalleRegistro.fechaHora).toLocaleString()} por {detalleRegistro.usuarioNombre || 'Sistema'}
                </span>
              </div>
              <button
                onClick={() => setDetalleRegistro(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#7c8592' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              {/* Valor Anterior */}
              <div style={{ background: '#fcf8f7', border: '1px solid #f3c9c4', borderRadius: '10px', padding: '14px' }}>
                <strong style={{ fontSize: '0.8rem', color: '#d1453b', display: 'block', marginBottom: '8px' }}>
                  ◀ VALOR ANTERIOR (Previo a la acción)
                </strong>
                {detalleRegistro.valorAnterior ? (
                  <pre style={{ margin: 0, fontSize: '0.75rem', color: '#1f2430', whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto' }}>
                    {JSON.stringify(detalleRegistro.valorAnterior, null, 2)}
                  </pre>
                ) : (
                  <span style={{ fontSize: '0.78rem', color: '#a3aab5', fontStyle: 'italic' }}>
                    Sin valor previo (Registro nuevo / Creación)
                  </span>
                )}
              </div>

              {/* Valor Nuevo */}
              <div style={{ background: '#f5f9f6', border: '1px solid #c9dfcd', borderRadius: '10px', padding: '14px' }}>
                <strong style={{ fontSize: '0.8rem', color: '#2f5540', display: 'block', marginBottom: '8px' }}>
                  ▶ NUEVO VALOR REGISTRADO
                </strong>
                {detalleRegistro.valorNuevo ? (
                  <pre style={{ margin: 0, fontSize: '0.75rem', color: '#1f2430', whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto' }}>
                    {JSON.stringify(detalleRegistro.valorNuevo, null, 2)}
                  </pre>
                ) : (
                  <span style={{ fontSize: '0.78rem', color: '#a3aab5', fontStyle: 'italic' }}>
                    Sin nuevo valor
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDetalleRegistro(null)}
                style={{ padding: '8px 18px', background: '#3f6c52', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
