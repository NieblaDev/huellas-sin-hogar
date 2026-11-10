import React, { useState, useEffect } from 'react';
import { API_URL, getAuthHeaders } from '../api/config';

export default function DashboardModulo({ user, onNavigate }) {
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [avisosOpen, setAvisosOpen] = useState(false);

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

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
          {/* Icono de notificación con contador */}
          <button
            onClick={() => setAvisosOpen(v => !v)}
            aria-label="Avisos prioritarios del refugio"
            title="Avisos prioritarios del refugio"
            style={{
              position: 'relative', background: avisosOpen ? '#eef3ec' : '#fff',
              border: `1.5px solid ${avisosOpen ? '#3f6c52' : '#e9eaed'}`, borderRadius: '8px',
              width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.15rem', cursor: 'pointer'
            }}
          >
            🔔
            {alertasPrioritarias?.length > 0 && (
              <span style={{
                position: 'absolute', top: '-6px', right: '-6px', minWidth: '18px', height: '18px',
                padding: '0 4px', borderRadius: '9px', background: '#d1453b', color: '#fff',
                fontSize: '0.68rem', fontWeight: '800', display: 'flex', alignItems: 'center',
                justifyContent: 'center', boxSizing: 'border-box'
              }}>
                {alertasPrioritarias.length}
              </span>
            )}
          </button>

          <button
            onClick={fetchMetrics}
            style={{
              background: '#fff', border: '1.5px solid #e9eaed', borderRadius: '8px', padding: '8px 14px',
              fontSize: '0.8rem', fontWeight: '700', color: '#1f2430', cursor: 'pointer', height: '40px'
            }}
          >
            🔄 Actualizar Indicadores
          </button>

          {/* Panel desplegable de avisos prioritarios */}
          {avisosOpen && (
            <>
              <div
                onClick={() => setAvisosOpen(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 400 }}
              />
              <div style={{
                position: 'absolute', top: '48px', right: 0, width: 'min(420px, calc(100vw - 48px))',
                background: '#fff', border: '1px solid #e9eaed', borderRadius: '14px',
                boxShadow: '0 12px 32px rgba(20,24,32,0.14)', zIndex: 401, overflow: 'hidden'
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 16px', borderBottom: '1px solid #f0f1f3'
                }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: '800', letterSpacing: '0.05em', textTransform: 'uppercase', color: '#1f2430' }}>
                    Avisos Prioritarios
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#7c8592', fontWeight: '600' }}>
                    {alertasPrioritarias?.length || 0} activos
                  </span>
                </div>

                <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '10px' }}>
                  {!alertasPrioritarias || alertasPrioritarias.length === 0 ? (
                    <div style={{ padding: '18px 12px', textAlign: 'center', color: '#7c8592', fontSize: '0.84rem' }}>
                      ✓ No hay avisos prioritarios en este momento.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {alertasPrioritarias.map((alerta, idx) => {
                        const bg = alerta.tipo === 'CRITICA' ? '#fbeae8' : alerta.tipo === 'ALERTA' ? '#faf1de' : '#edeffb';
                        const border = alerta.tipo === 'CRITICA' ? '#d1453b' : alerta.tipo === 'ALERTA' ? '#d99a3d' : '#6570e0';
                        const color = alerta.tipo === 'CRITICA' ? '#d1453b' : alerta.tipo === 'ALERTA' ? '#b37416' : '#4550c0';

                        return (
                          <div
                            key={idx}
                            style={{ background: bg, borderLeft: `4px solid ${border}`, borderRadius: '9px', padding: '12px 14px' }}
                          >
                            <strong style={{ color, fontSize: '0.86rem', display: 'block', marginBottom: '3px' }}>
                              {alerta.titulo}
                            </strong>
                            <span style={{ fontSize: '0.78rem', color: '#555e6d', lineHeight: 1.35, display: 'block' }}>
                              {alerta.mensaje}
                            </span>
                            {alerta.categoria === 'CANILES' && onNavigate && (
                              <button
                                onClick={() => { setAvisosOpen(false); onNavigate('caniles'); }}
                                style={{ marginTop: '8px', background: border, color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '700', cursor: 'pointer' }}
                              >
                                Ver Caniles
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* TARJETAS RESUMEN INTERACTIVAS (KPIs DESTACADOS) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '26px' }}>
        {/* KPI 1: Animales albergados (Destacado) */}
        <div
          onClick={() => onNavigate && onNavigate('animales')}
          style={{
            background: '#fff', border: '1.5px solid #3f6c52', borderRadius: '16px', padding: '20px',
            boxShadow: '0 4px 14px rgba(63,108,82,0.08)', cursor: 'pointer', transition: 'transform 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: '800', textTransform: 'uppercase', color: '#3f6c52', letterSpacing: '0.04em' }}>
              🐾 Animales Albergados
            </span>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#e8f0e8', color: '#3f6c52', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🐾</div>
          </div>
          <div style={{ fontSize: '2.4rem', fontWeight: '800', color: '#1f2430', lineHeight: 1 }}>{resumen.animalesAlbergados}</div>
          <div style={{ fontSize: '0.78rem', color: '#7c8592', marginTop: '8px' }}>
            Total de residentes activos →
          </div>
        </div>

        {/* KPI 2: Caniles Ocupados (Destacado) */}
        <div
          onClick={() => onNavigate && onNavigate('caniles')}
          style={{
            background: '#fff', border: '1.5px solid #d1453b', borderRadius: '16px', padding: '20px',
            boxShadow: '0 4px 14px rgba(209,69,59,0.08)', cursor: 'pointer', transition: 'transform 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: '800', textTransform: 'uppercase', color: '#d1453b', letterSpacing: '0.04em' }}>
              🔒 Caniles Ocupados
            </span>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#fbeae8', color: '#d1453b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🚪</div>
          </div>
          <div style={{ fontSize: '2.4rem', fontWeight: '800', color: '#d1453b', lineHeight: 1 }}>
            {resumen.canilesOcupados + (resumen.canilesCuarentena || 0)}
            <span style={{ fontSize: '1.1rem', color: '#7c8592', fontWeight: '600' }}> / {resumen.totalCaniles}</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#7c8592', marginTop: '8px' }}>
            {resumen.canilesLibres} espacios libres disponibles
          </div>
        </div>

        {/* KPI 3: Porcentaje de Ocupación (Destacado) */}
        <div
          onClick={() => onNavigate && onNavigate('caniles')}
          style={{
            background: resumen.alertaSobrecupo ? '#fbeae8' : '#fff',
            border: resumen.alertaSobrecupo ? '2px solid #d1453b' : '1.5px solid #3f6c52',
            borderRadius: '16px', padding: '20px',
            boxShadow: '0 4px 14px rgba(20,24,32,0.06)', cursor: 'pointer', transition: 'transform 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: '800', textTransform: 'uppercase', color: resumen.alertaSobrecupo ? '#d1453b' : '#3f6c52', letterSpacing: '0.04em' }}>
              📈 Porcentaje de Ocupación
            </span>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: resumen.alertaSobrecupo ? '#d1453b' : '#e8f0e8',
              color: resumen.alertaSobrecupo ? '#fff' : '#3f6c52',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem'
            }}>
              %
            </div>
          </div>
          <div style={{ fontSize: '2.4rem', fontWeight: '800', color: resumen.alertaSobrecupo ? '#d1453b' : '#1f2430', lineHeight: 1 }}>
            {resumen.ocupacionPorcentaje}%
          </div>
          <div style={{ fontSize: '0.78rem', color: resumen.alertaSobrecupo ? '#d1453b' : '#7c8592', marginTop: '8px', fontWeight: resumen.alertaSobrecupo ? '700' : '400' }}>
            {resumen.alertaSobrecupo ? '🚨 Sobrecupo crítico (>90%)' : 'Dentro del umbral operacional'}
          </div>
        </div>

        {/* KPI 4: Stock Crítico */}
        <div
          onClick={() => onNavigate && onNavigate('inventario')}
          style={{
            background: '#fff', border: '1.5px solid #e0705c', borderRadius: '16px', padding: '20px',
            boxShadow: '0 4px 14px rgba(224,112,92,0.08)', cursor: 'pointer', transition: 'transform 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: '800', textTransform: 'uppercase', color: '#e0705c', letterSpacing: '0.04em' }}>Stock Crítico</span>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#fbe9e5', color: '#e0705c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📦</div>
          </div>
          <div style={{ fontSize: '2.4rem', fontWeight: '800', color: resumen.stockCriticoCount > 0 ? '#d1453b' : '#1f2430', lineHeight: 1 }}>
            {resumen.stockCriticoCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#7c8592', marginTop: '8px' }}>
            {resumen.stockCriticoCount > 0 ? 'Artículos bajo mínimo (Clic para ver)' : 'Inventario abastecido'}
          </div>
        </div>

        {/* KPI 5: Turnos Descubiertos */}
        <div
          onClick={() => onNavigate && onNavigate('voluntarios')}
          style={{
            background: '#fff', border: '1.5px solid #d99a3d', borderRadius: '16px', padding: '20px',
            boxShadow: '0 4px 14px rgba(217,154,61,0.08)', cursor: 'pointer', transition: 'transform 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: '800', textTransform: 'uppercase', color: '#b37416', letterSpacing: '0.04em' }}>Turnos Descubiertos</span>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#faf1de', color: '#d99a3d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>👥</div>
          </div>
          <div style={{ fontSize: '2.4rem', fontWeight: '800', color: resumen.turnosDescubiertosCount > 0 ? '#d99a3d' : '#3f6c52', lineHeight: 1 }}>
            {resumen.turnosDescubiertosCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#7c8592', marginTop: '8px' }}>
            {resumen.turnosDescubiertosCount > 0 ? 'Requieren asignación (Clic para ver)' : 'Todos los turnos cubiertos'}
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
