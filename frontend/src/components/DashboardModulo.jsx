import React, { useState, useEffect } from 'react';
import { API_URL, getAuthHeaders } from '../api/config';

export default function DashboardModulo({ user, onNavigate }) {
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    setCargando(true);
    try {
      const res = await fetch(`${API_URL}/dashboard/metrics`, { headers: getAuthHeaders() });
      const body = await res.json().catch(() => null);
      if (res.status === 401 || res.status === 403) {
        localStorage.clear();
        window.location.reload();
        return;
      }
      if (!res.ok) {
        throw new Error(body?.error || `Error ${res.status}: ${res.statusText}`);
      }
      setData(body);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  if (cargando) {
    return (
      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '40px 24px', textAlign: 'center', color: '#7c8592' }}>
        Cargando indicadores operativos en tiempo real...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '24px' }}>
        <div style={{ background: '#fbeae8', color: '#d1453b', padding: '16px', borderRadius: '12px', border: '1px solid #f3c9c4' }}>
          {error}
        </div>
      </div>
    );
  }

  const { resumen, tendencias, alertasPrioritarias, listadosOperativos, rolUsuario, trasladosPendientes, ultimasAuditorias } = data;
  const esDirectora = rolUsuario === 'DIRECTORA';

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '24px' }}>
      {/* Saludo y Rol */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: '800', color: '#1f2430', margin: 0 }}>
            ¡Hola, {user?.nombre || 'Equipo'}!
          </h2>
          <p style={{ color: '#7c8592', fontSize: '0.88rem', margin: '4px 0 0' }}>
            Panel de indicadores operativos en tiempo real · Vista configurada para rol: <strong>{rolUsuario}</strong>
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          style={{
            background: '#fff', border: '1.5px solid #e9eaed', borderRadius: '8px', padding: '8px 14px',
            fontSize: '0.8rem', fontWeight: '700', color: '#1f2430', cursor: 'pointer'
          }}
        >
          🔄 Actualizar Indicadores
        </button>
      </div>

      {/* AVISOS PRIORITARIOS EN TIEMPO REAL */}
      {alertasPrioritarias && alertasPrioritarias.length > 0 && (
        <div style={{ marginBottom: '26px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '800', letterSpacing: '0.07em', textTransform: 'uppercase', color: '#7c8592', marginBottom: '10px' }}>
            Avisos Prioritarios del Refugio
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {alertasPrioritarias.map((alerta, idx) => {
              const bg = alerta.tipo === 'CRITICA' ? '#fbeae8' : alerta.tipo === 'ALERTA' ? '#faf1de' : '#edeffb';
              const border = alerta.tipo === 'CRITICA' ? '#d1453b' : alerta.tipo === 'ALERTA' ? '#d99a3d' : '#6570e0';
              const color = alerta.tipo === 'CRITICA' ? '#d1453b' : alerta.tipo === 'ALERTA' ? '#b37416' : '#4550c0';

              return (
                <div
                  key={idx}
                  style={{
                    background: bg, borderLeft: `5px solid ${border}`, borderRadius: '10px',
                    padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    boxShadow: '0 2px 8px rgba(20,24,32,0.03)'
                  }}
                >
                  <div>
                    <strong style={{ color, fontSize: '0.92rem', display: 'block', marginBottom: '2px' }}>
                      {alerta.titulo}
                    </strong>
                    <span style={{ fontSize: '0.82rem', color: '#555e6d' }}>{alerta.mensaje}</span>
                  </div>
                  {alerta.categoria === 'CANILES' && onNavigate && (
                    <button
                      onClick={() => onNavigate('caniles')}
                      style={{ background: border, color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Ver Caniles
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TARJETAS RESUMEN INTERACTIVAS (KPIs) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '26px' }}>
        {/* KPI 1: Animales albergados */}
        <div
          onClick={() => onNavigate && onNavigate('animales')}
          style={{
            background: '#fff', border: '1px solid #e9eaed', borderRadius: '16px', padding: '20px',
            boxShadow: '0 1px 2px rgba(20,24,32,.04)', cursor: 'pointer', transition: 'transform 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: '#7c8592' }}>Animales Albergados</span>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#e8f0e8', color: '#3f6c52', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🐾</div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#1f2430' }}>{resumen.animalesAlbergados}</div>
          <div style={{ fontSize: '0.78rem', color: '#7c8592', marginTop: '4px' }}>
            Ver catálogo completo →
          </div>
        </div>

        {/* KPI 2: Caniles libres y ocupación */}
        <div
          onClick={() => onNavigate && onNavigate('caniles')}
          style={{
            background: '#fff', border: '1px solid #e9eaed', borderRadius: '16px', padding: '20px',
            boxShadow: '0 1px 2px rgba(20,24,32,.04)', cursor: 'pointer', transition: 'transform 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: '#7c8592' }}>Caniles Libres</span>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#e8f0e8', color: '#3f6c52', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🚪</div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: resumen.alertaSobrecupo ? '#d1453b' : '#3f6c52' }}>
            {resumen.canilesLibres} <span style={{ fontSize: '1rem', color: '#7c8592', fontWeight: '600' }}>/ {resumen.totalCaniles}</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: resumen.alertaSobrecupo ? '#d1453b' : '#7c8592', marginTop: '4px' }}>
            Ocupación al {resumen.ocupacionPorcentaje}% {resumen.alertaSobrecupo && '⚠️ SOBRECUPO'}
          </div>
        </div>

        {/* KPI 3: Stock Crítico */}
        <div
          style={{
            background: '#fff', border: '1px solid #e9eaed', borderRadius: '16px', padding: '20px',
            boxShadow: '0 1px 2px rgba(20,24,32,.04)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: '#7c8592' }}>Stock Crítico</span>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#fbe9e5', color: '#e0705c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📦</div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: resumen.stockCriticoCount > 0 ? '#d1453b' : '#1f2430' }}>
            {resumen.stockCriticoCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#7c8592', marginTop: '4px' }}>
            {resumen.stockCriticoCount > 0 ? 'Artículos bajo mínimo' : 'Inventario abastecido'}
          </div>
        </div>

        {/* KPI 4: Turnos descubiertos */}
        <div
          style={{
            background: '#fff', border: '1px solid #e9eaed', borderRadius: '16px', padding: '20px',
            boxShadow: '0 1px 2px rgba(20,24,32,.04)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: '#7c8592' }}>Turnos Descubiertos</span>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#faf1de', color: '#d99a3d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>👥</div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: resumen.turnosDescubiertosCount > 0 ? '#d99a3d' : '#3f6c52' }}>
            {resumen.turnosDescubiertosCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#7c8592', marginTop: '4px' }}>
            Requieren voluntario asignado
          </div>
        </div>
      </div>

      {/* GRÁFICOS DE TENDENCIAS Y DISTRIBUCIÓN (Solo lectura) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '26px' }}>
        {/* Distribución por Especie y Ocupación */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e9eaed', padding: '22px' }}>
          <div style={{ fontSize: '1rem', fontWeight: '800', color: '#1f2430', marginBottom: '16px' }}>
            📊 Gráfico de Distribución y Capacidad
          </div>
          <p style={{ fontSize: '0.78rem', color: '#a3aab5', marginBottom: '16px' }}>
            * Gráfica informativa consolidada de solo lectura (restringida edición directa de registros).
          </p>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: '700', marginBottom: '6px' }}>
              <span>Ocupación de Caniles</span>
              <span>{resumen.ocupacionPorcentaje}% ({resumen.canilesOcupados + resumen.canilesCuarentena} / {resumen.totalCaniles})</span>
            </div>
            <div style={{ width: '100%', height: '12px', background: '#e9eaed', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(resumen.ocupacionPorcentaje, 100)}%`,
                height: '100%',
                background: resumen.ocupacionPorcentaje > 90 ? '#d1453b' : '#3f6c52',
                transition: 'width 0.5s ease'
              }} />
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#7c8592', textTransform: 'uppercase' }}>Animales por Especie</span>
            <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
              {tendencias.especies.map((item, i) => (
                <div key={i} style={{ flex: 1, background: '#f8f9fa', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1f2430' }}>{item.cantidad}</div>
                  <div style={{ fontSize: '0.78rem', color: '#7c8592', fontWeight: '600' }}>{item.especie}s</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Distribución por Estado de Salud */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e9eaed', padding: '22px' }}>
          <div style={{ fontSize: '1rem', fontWeight: '800', color: '#1f2430', marginBottom: '16px' }}>
            🩺 Estado Clínico de la Población
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {tendencias.salud.map((st, i) => {
              const labelMap = { NORMAL: 'Normal', CONDICION_ESPECIAL: 'Condición Especial', CRITICO: 'Crítico' };
              const colorMap = { NORMAL: '#3f6c52', CONDICION_ESPECIAL: '#d99a3d', CRITICO: '#d1453b' };
              const pct = resumen.animalesAlbergados > 0 ? Math.round((st.cantidad / resumen.animalesAlbergados) * 100) : 0;

              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                    <strong>{labelMap[st.estado] || st.estado}</strong>
                    <span style={{ color: '#7c8592' }}>{st.cantidad} ({pct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#f0f1f3', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: colorMap[st.estado] || '#7c8592' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECCIÓN OPERATIVA: STOCK CRÍTICO Y TURNOS DESATENDIDOS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '26px' }}>
        {/* Insumos Críticos */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e9eaed', padding: '20px' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#1f2430', marginBottom: '12px' }}>
            ⚠️ Insumos con Stock Bajo o Crítico
          </div>
          {listadosOperativos.insumosBajoStock.length === 0 ? (
            <div style={{ fontSize: '0.82rem', color: '#3f6c52', padding: '12px', background: '#e8f0e8', borderRadius: '8px' }}>
              ✓ No hay insumos en estado crítico actualmente.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {listadosOperativos.insumosBajoStock.map(ins => (
                <div key={ins.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fbeae8', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#d1453b' }}>{ins.nombre}</span>
                  <span style={{ fontSize: '0.78rem', color: '#7c8592' }}>
                    Stock: <strong style={{ color: '#d1453b' }}>{ins.stock}</strong> (Mínimo: {ins.stockMinimo})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Turnos Descubiertos */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e9eaed', padding: '20px' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#1f2430', marginBottom: '12px' }}>
            🚨 Turnos Descubiertos de la Semana
          </div>
          {listadosOperativos.turnosSinCubrir.length === 0 ? (
            <div style={{ fontSize: '0.82rem', color: '#3f6c52', padding: '12px', background: '#e8f0e8', borderRadius: '8px' }}>
              ✓ Todos los turnos se encuentran cubiertos por voluntarios.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {listadosOperativos.turnosSinCubrir.map(tur => (
                <div key={tur.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#faf1de', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#b37416' }}>
                    {tur.diaSemana} ({tur.franja}) — {tur.area}
                  </span>
                  <span style={{ fontSize: '0.74rem', background: '#d1453b', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                    Sin voluntario
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECCIÓN EXCLUSIVA DIRECTORA: TRASLADOS PENDIENTES & AUDITORÍA RECIENTE */}
      {esDirectora && (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e9eaed', padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ fontSize: '1rem', fontWeight: '800', color: '#1f2430' }}>
              🛡️ Supervisión Directiva: Traslados y Actividad de Auditoría
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('auditoria')}
                style={{ background: '#3f6c52', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '7px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}
              >
                Ir a Bitácora Completa →
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Traslados Pendientes */}
            <div>
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', textTransform: 'uppercase' }}>
                Traslados esperando tu aprobación
              </span>
              <div style={{ marginTop: '10px' }}>
                {trasladosPendientes && trasladosPendientes.length > 0 ? (
                  trasladosPendientes.map(t => (
                    <div key={t.id} style={{ padding: '10px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{t.animal?.nombre}</strong> ({t.tipo.replace('_', ' ')})
                        <div style={{ fontSize: '0.74rem', color: '#7c8592' }}>Solicitado por: {t.responsable?.nombre}</div>
                      </div>
                      <button
                        onClick={() => onNavigate && onNavigate('caniles')}
                        style={{ fontSize: '0.74rem', background: '#3f6c52', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '5px', cursor: 'pointer' }}
                      >
                        Revisar
                      </button>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '0.8rem', color: '#7c8592' }}>No hay traslados pendientes de aprobación.</div>
                )}
              </div>
            </div>

            {/* Últimos registros de auditoría */}
            <div>
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', textTransform: 'uppercase' }}>
                Últimos Cambios en Datos Sensibles
              </span>
              <div style={{ marginTop: '10px' }}>
                {ultimasAuditorias && ultimasAuditorias.length > 0 ? (
                  ultimasAuditorias.map(a => (
                    <div key={a.id} style={{ fontSize: '0.78rem', padding: '6px 0', borderBottom: '1px solid #f0f1f3', display: 'flex', justifyContent: 'space-between' }}>
                      <span><strong>{a.entidad}</strong>: {a.accion}</span>
                      <span style={{ color: '#7c8592' }}>{a.usuarioNombre || 'Sistema'}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '0.8rem', color: '#7c8592' }}>Sin registros de auditoría recientes.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
