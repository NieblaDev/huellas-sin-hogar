import React, { useState, useEffect } from 'react';
import { API_URL, getAuthHeaders } from '../api/config';

export default function InventarioModulo({ user }) {
  const [insumos, setInsumos] = useState([]);
  const [animales, setAnimales] = useState([]);
  const [alertas, setAlertas] = useState({ totalAlertas: 0, stockCriticoCount: 0, vencimientoCount: 0, alertasStock: [], alertasVencimiento: [] });
  const [movimientosRecientes, setMovimientosRecientes] = useState([]);
  const [activeTab, setActiveTab] = useState('catalogo'); // 'catalogo' | 'movimientos' | 'alertas'
  const [cargando, setCargando] = useState(true);
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS');

  // Modales
  const [modalInsumoOpen, setModalInsumoOpen] = useState(false);
  const [insumoEditar, setInsumoEditar] = useState(null);
  const [modalMovimientoOpen, setModalMovimientoOpen] = useState(false);
  const [insumoSeleccionado, setInsumoSeleccionado] = useState(null);

  // Formulario Insumo
  const [formInsumo, setFormInsumo] = useState({
    nombre: '',
    categoria: 'Alimento',
    stock: 0,
    stockMinimo: 5,
    unidad: 'Unidades',
    esFarmaco: false,
    ubicacion: '',
    lote: '',
    fechaVencimiento: ''
  });

  // Formulario Movimiento Clasificado
  const [formMovimiento, setFormMovimiento] = useState({
    insumoId: '',
    tipo: 'SALIDA', // 'ENTRADA' | 'SALIDA'
    subtipo: 'CONSUMO', // ENTRADA: DONACION, COMPRA | SALIDA: CONSUMO, TRATAMIENTO_MEDICO, MERMA
    cantidad: 1,
    motivo: '',
    donanteOProveedor: '',
    animalId: '',
    lote: '',
    fechaVencimiento: ''
  });

  const esAutorizadoFarmacos = ['DIRECTORA', 'VETERINARIA'].includes(user?.rol);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [resInsumos, resAlertas, resAnimales] = await Promise.all([
        fetch(`${API_URL}/insumos`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/insumos/alertas`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/animals`, { headers: getAuthHeaders() }).catch(() => ({ ok: false }))
      ]);

      if (resInsumos.ok) {
        const data = await resInsumos.json();
        setInsumos(data || []);
      }
      if (resAlertas.ok) {
        const dataAlertas = await resAlertas.json();
        setAlertas(dataAlertas || { totalAlertas: 0, stockCriticoCount: 0, vencimientoCount: 0, alertasStock: [], alertasVencimiento: [] });
      }
      if (resAnimales && resAnimales.ok) {
        const dataAnimales = await resAnimales.json();
        setAnimales(dataAnimales || []);
      }
    } catch (e) {
      console.error('Error al cargar datos de inventario:', e);
    } finally {
      setCargando(false);
    }
  };

  const abrirModalCrearInsumo = () => {
    setInsumoEditar(null);
    setFormInsumo({
      nombre: '',
      categoria: 'Alimento',
      stock: 0,
      stockMinimo: 5,
      unidad: 'Unidades',
      esFarmaco: false,
      ubicacion: '',
      lote: '',
      fechaVencimiento: ''
    });
    setModalInsumoOpen(true);
  };

  const abrirModalEditarInsumo = (insumo) => {
    setInsumoEditar(insumo);
    setFormInsumo({
      nombre: insumo.nombre || '',
      categoria: insumo.categoria || 'Alimento',
      stock: insumo.stock || 0,
      stockMinimo: insumo.stockMinimo || 5,
      unidad: insumo.unidad || 'Unidades',
      esFarmaco: Boolean(insumo.esFarmaco),
      ubicacion: insumo.ubicacion || '',
      lote: insumo.lote || '',
      fechaVencimiento: insumo.fechaVencimiento ? insumo.fechaVencimiento.split('T')[0] : ''
    });
    setModalInsumoOpen(true);
  };

  const abrirModalMovimiento = (insumo = null) => {
    const id = insumo?.id || (insumos.length > 0 ? insumos[0].id : '');
    setInsumoSeleccionado(insumo || (insumos.length > 0 ? insumos[0] : null));
    setFormMovimiento({
      insumoId: id,
      tipo: 'SALIDA',
      subtipo: 'CONSUMO',
      cantidad: 1,
      motivo: '',
      donanteOProveedor: '',
      animalId: '',
      lote: insumo?.lote || '',
      fechaVencimiento: ''
    });
    setModalMovimientoOpen(true);
  };

  const handleInsumoSelectChange = (e) => {
    const id = Number(e.target.value);
    const encontrado = insumos.find(i => i.id === id);
    setInsumoSeleccionado(encontrado || null);
    setFormMovimiento(prev => ({
      ...prev,
      insumoId: id,
      lote: encontrado?.lote || ''
    }));
  };

  const handleGuardarInsumo = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        nombre: formInsumo.nombre,
        categoria: formInsumo.categoria,
        stock: Number(formInsumo.stock),
        stockMinimo: Number(formInsumo.stockMinimo),
        unidad: formInsumo.unidad,
        esFarmaco: Boolean(formInsumo.esFarmaco),
        ubicacion: formInsumo.ubicacion || null,
        lote: formInsumo.lote || null,
        fechaVencimiento: formInsumo.fechaVencimiento ? new Date(`${formInsumo.fechaVencimiento}T00:00:00.000Z`).toISOString() : null
      };

      const url = insumoEditar ? `${API_URL}/insumos/${insumoEditar.id}` : `${API_URL}/insumos`;
      const method = insumoEditar ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.detalles?.[0]?.mensaje || 'Error al guardar insumo');
      }

      alert(insumoEditar ? 'Insumo actualizado exitosamente' : 'Insumo registrado en el inventario');
      setModalInsumoOpen(false);
      cargarDatos();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleGuardarMovimiento = async (e) => {
    e.preventDefault();
    if (!formMovimiento.insumoId) {
      return alert('Debe seleccionar un insumo');
    }

    const insumoActual = insumos.find(i => i.id === Number(formMovimiento.insumoId));
    const cantidadNum = Number(formMovimiento.cantidad);

    // Validación preventiva de saldo no negativo
    if (formMovimiento.tipo === 'SALIDA' && insumoActual && cantidadNum > insumoActual.stock) {
      return alert(`Operación rechazada: Stock insuficiente. El stock actual es de ${insumoActual.stock} ${insumoActual.unidad} y no se permiten saldos negativos.`);
    }

    try {
      const payload = {
        tipo: formMovimiento.tipo,
        subtipo: formMovimiento.subtipo,
        cantidad: cantidadNum,
        motivo: formMovimiento.motivo,
        donanteOProveedor: formMovimiento.donanteOProveedor || null,
        animalId: formMovimiento.animalId ? Number(formMovimiento.animalId) : null,
        lote: formMovimiento.lote || null,
        fechaVencimiento: formMovimiento.fechaVencimiento ? new Date(`${formMovimiento.fechaVencimiento}T00:00:00.000Z`).toISOString() : null
      };

      const res = await fetch(`${API_URL}/insumos/${formMovimiento.insumoId}/movimientos`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.detalles?.[0]?.mensaje || 'Error al registrar movimiento');
      }

      alert('Movimiento registrado con éxito. El stock fue actualizado en tiempo real.');
      setModalMovimientoOpen(false);
      cargarDatos();
    } catch (err) {
      alert(err.message);
    }
  };

  // Filtrado de insumos
  const insumosFiltrados = insumos.filter(ins => {
    const coincideTexto = ins.nombre.toLowerCase().includes(filtroTexto.toLowerCase()) ||
      (ins.lote && ins.lote.toLowerCase().includes(filtroTexto.toLowerCase())) ||
      (ins.ubicacion && ins.ubicacion.toLowerCase().includes(filtroTexto.toLowerCase()));

    const coincideCat = filtroCategoria === 'TODAS' || ins.categoria === filtroCategoria;
    const coincideTab = activeTab === 'catalogo' || (activeTab === 'alertas' && (ins.esStockBajo || ins.esAgotado || ins.esProximoVencer));

    return coincideTexto && coincideCat && coincideTab;
  });

  // Categorías únicas
  const categorias = ['TODAS', ...new Set(insumos.map(i => i.categoria))];

  return (
    <div className="portal-page-container">
      {/* Encabezado Principal */}
      <div className="portal-header">
        <div>
          <h2 className="portal-header-title">
            <span>📦</span>
            <span>Inventario de Insumos</span>
          </h2>
          <p className="portal-header-subtitle">
            Control de existencias en tiempo real, registro clasificado de entradas y salidas y alertas de stock mínimo.
          </p>
        </div>

        <div className="portal-header-actions">
          <button
            onClick={() => abrirModalMovimiento()}
            className="portal-btn portal-btn-primary"
          >
            <span>⇄</span> Registrar Movimiento
          </button>

          <button
            onClick={abrirModalCrearInsumo}
            className="portal-btn portal-btn-secondary"
          >
            <span>+</span> Nuevo Insumo
          </button>
        </div>
      </div>

      {/* Subnavegación de Inventario — Estilo portal-subtabs */}
      <div className="portal-subtabs">
        <button
          onClick={() => setActiveTab('catalogo')}
          className={`portal-subtab-btn ${activeTab === 'catalogo' ? 'active' : ''}`}
        >
          📦 Catálogo de Insumos ({insumos.length})
        </button>
        <button
          onClick={() => setActiveTab('alertas')}
          className={`portal-subtab-btn ${activeTab === 'alertas' ? 'active' : ''}`}
        >
          🚨 Alertas de Stock ({alertas.totalAlertas || 0})
        </button>
        <button
          onClick={() => abrirModalMovimiento()}
          className="portal-subtab-btn"
        >
          ⇄ Registrar Movimiento
        </button>
        <button
          onClick={abrirModalCrearInsumo}
          className="portal-subtab-btn"
        >
          ➕ Nuevo Insumo
        </button>
      </div>

      {/* TARJETAS RESUMEN OPERACIONAL */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e9eaed', padding: '18px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: '#7c8592' }}>Total Insumos</div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#1f2430', marginTop: '4px' }}>{insumos.length}</div>
          <div style={{ fontSize: '0.78rem', color: '#7c8592' }}>Artículos activos en catálogo</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #f3c9c4', padding: '18px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: '#d1453b' }}>Stock Mínimo / Crítico</div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#d1453b', marginTop: '4px' }}>{alertas.stockCriticoCount}</div>
          <div style={{ fontSize: '0.78rem', color: '#7c8592' }}>Requieren reposición urgente</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #f2dfbe', padding: '18px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: '#b37416' }}>Próximos a Vencer</div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#b37416', marginTop: '4px' }}>{alertas.vencimientoCount}</div>
          <div style={{ fontSize: '0.78rem', color: '#7c8592' }}>Vencen en los próximos 30 días</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #c7dfc7', padding: '18px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: '#3f6c52' }}>Control de Saldo</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#3f6c52', marginTop: '10px' }}>Atómico 100%</div>
          <div style={{ fontSize: '0.78rem', color: '#7c8592' }}>Prohibición de saldos negativos activa</div>
        </div>
      </div>

      {/* BARRA DE FILTROS Y BÚSQUEDA */}
      <div style={{
        background: '#fff', borderRadius: '12px', border: '1px solid #e9eaed',
        padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center'
      }}>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <input
            type="text"
            placeholder="🔍 Buscar insumo por nombre, lote o ubicación..."
            value={filtroTexto}
            onChange={e => setFiltroTexto(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.84rem', fontWeight: '700', color: '#7c8592' }}>Categoría:</span>
          <select
            value={filtroCategoria}
            onChange={e => setFiltroCategoria(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem', background: '#fff' }}
          >
            {categorias.map((c, i) => (
              <option key={i} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => { setFiltroTexto(''); setFiltroCategoria('TODAS'); }}
          style={{ background: 'transparent', border: 'none', color: '#7c8592', fontSize: '0.84rem', cursor: 'pointer', fontWeight: '600' }}
        >
          Limpiar filtros
        </button>
      </div>

      {/* TABLA PRINCIPAL DE INSUMOS */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e9eaed', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #e9eaed' }}>
              <th style={{ padding: '14px 18px', fontWeight: '800', color: '#1f2430' }}>Producto</th>
              <th style={{ padding: '14px 18px', fontWeight: '800', color: '#1f2430' }}>Categoría</th>
              <th style={{ padding: '14px 18px', fontWeight: '800', color: '#1f2430' }}>Stock Actual</th>
              <th style={{ padding: '14px 18px', fontWeight: '800', color: '#1f2430' }}>Mínimo</th>
              <th style={{ padding: '14px 18px', fontWeight: '800', color: '#1f2430' }}>Estado Stock</th>
              <th style={{ padding: '14px 18px', fontWeight: '800', color: '#1f2430' }}>Vencimiento</th>
              <th style={{ padding: '14px 18px', fontWeight: '800', color: '#1f2430', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#7c8592' }}>
                  Cargando inventario de insumos...
                </td>
              </tr>
            ) : insumosFiltrados.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#7c8592' }}>
                  No se encontraron insumos con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              insumosFiltrados.map(ins => {
                const stockCritico = ins.esStockBajo;
                const agotado = ins.esAgotado;

                return (
                  <tr key={ins.id} style={{ borderBottom: '1px solid #f0f1f3', transition: 'background 0.15s' }}>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: '800', color: '#1f2430', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {ins.esFarmaco && <span title="Fármaco / Medicamento controlado" style={{ fontSize: '0.9rem' }}>💊</span>}
                        {ins.nombre}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#a3aab5', marginTop: '2px' }}>
                        {ins.ubicacion && <span>📍 {ins.ubicacion} · </span>}
                        {ins.lote && <span>Lote: {ins.lote}</span>}
                      </div>
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        padding: '4px 8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '700',
                        background: ins.esFarmaco ? '#edf4fc' : '#f0f1f3',
                        color: ins.esFarmaco ? '#3478c4' : '#57606a'
                      }}>
                        {ins.categoria}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px', fontWeight: '800', fontSize: '1rem', color: agotado ? '#d1453b' : (stockCritico ? '#b37416' : '#1f2430') }}>
                      {ins.stock} <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#7c8592' }}>{ins.unidad}</span>
                    </td>

                    <td style={{ padding: '14px 18px', color: '#7c8592', fontSize: '0.84rem' }}>
                      {ins.stockMinimo} {ins.unidad}
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      {agotado ? (
                        <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800', background: '#fbeae8', color: '#d1453b', border: '1px solid #f3c9c4' }}>
                          🔴 AGOTADO
                        </span>
                      ) : stockCritico ? (
                        <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800', background: '#fff4e5', color: '#b37416', border: '1px solid #f2dfbe' }}>
                          ⚠️ STOCK CRÍTICO
                        </span>
                      ) : (
                        <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800', background: '#e8f0e8', color: '#2f5540' }}>
                          🟢 NORMAL
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      {ins.fechaVencimiento ? (
                        <div>
                          <div style={{ fontSize: '0.84rem', fontWeight: '700', color: ins.estaVencido ? '#d1453b' : (ins.alertaVencimiento ? '#b37416' : '#1f2430') }}>
                            {new Date(ins.fechaVencimiento).toLocaleDateString()}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: ins.estaVencido ? '#d1453b' : (ins.alertaVencimiento ? '#b37416' : '#7c8592'), fontWeight: '600' }}>
                            {ins.estaVencido ? '⛔ ¡VENCIDO!' : (ins.alertaVencimiento ? `⏰ Vence en ${ins.diasParaVencer}d` : `${ins.diasParaVencer}d restantes`)}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#a3aab5', fontSize: '0.78rem' }}>No perecible / S/V</span>
                      )}
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          onClick={() => abrirModalMovimiento(ins)}
                          title="Registrar entrada o salida"
                          style={{
                            background: '#eef3ec', color: '#2f5540', border: 'none', borderRadius: '6px',
                            padding: '6px 10px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer'
                          }}
                        >
                          ⇄ Mover
                        </button>

                        <button
                          onClick={() => abrirModalEditarInsumo(ins)}
                          title="Editar parámetros del insumo"
                          style={{
                            background: '#f8f9fa', color: '#57606a', border: '1px solid #dcdfe4', borderRadius: '6px',
                            padding: '6px 10px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer'
                          }}
                        >
                          ✏️ Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: REGISTRAR MOVIMIENTO CLASIFICADO (ENTRADAS POR DONACIÓN/COMPRA Y SALIDAS POR CONSUMO/TRATAMIENTO) */}
      {modalMovimientoOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{ background: '#fff', borderRadius: '16px', maxWidth: '540px', width: '100%', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1f2430', margin: 0 }}>
                ⇄ Registrar Movimiento Clasificado
              </h3>
              <button
                onClick={() => setModalMovimientoOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#7c8592' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarMovimiento}>
              {/* Selector de Insumo */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '6px' }}>
                  Insumo *
                </label>
                <select
                  value={formMovimiento.insumoId}
                  onChange={handleInsumoSelectChange}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                >
                  <option value="">— Seleccionar insumo —</option>
                  {insumos.map(ins => (
                    <option key={ins.id} value={ins.id}>
                      {ins.nombre} (Stock actual: {ins.stock} {ins.unidad})
                    </option>
                  ))}
                </select>
              </div>

              {/* Muestra de Stock Disponible en Tiempo Real */}
              {insumoSeleccionado && (
                <div style={{
                  padding: '10px 14px', borderRadius: '8px', background: '#f8f9fa',
                  border: '1px solid #e9eaed', marginBottom: '14px', fontSize: '0.84rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Stock Disponible Actual:</span>
                    <strong style={{ color: insumoSeleccionado.stock === 0 ? '#d1453b' : '#2f5540' }}>
                      {insumoSeleccionado.stock} {insumoSeleccionado.unidad}
                    </strong>
                  </div>
                  {insumoSeleccionado.esFarmaco && (
                    <div style={{ fontSize: '0.76rem', color: '#3478c4', marginTop: '4px', fontWeight: '700' }}>
                      💊 Producto clasificado como Fármaco. Operación reservada a Personal Clínico Autorizado.
                    </div>
                  )}
                </div>
              )}

              {/* Tipo de Movimiento: Entrada vs Salida */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '6px' }}>
                  Tipo de Movimiento *
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setFormMovimiento(prev => ({ ...prev, tipo: 'SALIDA', subtipo: 'CONSUMO' }))}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer',
                      background: formMovimiento.tipo === 'SALIDA' ? '#fbeae8' : '#f8f9fa',
                      color: formMovimiento.tipo === 'SALIDA' ? '#d1453b' : '#7c8592',
                      border: `1.5px solid ${formMovimiento.tipo === 'SALIDA' ? '#d1453b' : '#e9eaed'}`
                    }}
                  >
                    ⬇️ Salida (Consumo / Tratamiento)
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormMovimiento(prev => ({ ...prev, tipo: 'ENTRADA', subtipo: 'DONACION' }))}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer',
                      background: formMovimiento.tipo === 'ENTRADA' ? '#eef3ec' : '#f8f9fa',
                      color: formMovimiento.tipo === 'ENTRADA' ? '#2f5540' : '#7c8592',
                      border: `1.5px solid ${formMovimiento.tipo === 'ENTRADA' ? '#2f5540' : '#e9eaed'}`
                    }}
                  >
                    ⬆️ Entrada (Donación / Compra)
                  </button>
                </div>
              </div>

              {/* Subtipo Clasificado */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '6px' }}>
                  Clasificación del Movimiento *
                </label>
                <select
                  value={formMovimiento.subtipo}
                  onChange={e => setFormMovimiento(prev => ({ ...prev, subtipo: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                >
                  {formMovimiento.tipo === 'ENTRADA' ? (
                    <>
                      <option value="DONACION">🎁 Donación (Comunidad / Campañas)</option>
                      <option value="COMPRA">🛒 Compra Directa del Refugio</option>
                      <option value="AJUSTE">⚙️ Ajuste de Inventario (Entrada)</option>
                    </>
                  ) : (
                    <>
                      <option value="CONSUMO">🥣 Consumo General / Alimentación / Limpieza</option>
                      <option value="TRATAMIENTO_MEDICO">🩺 Vinculación a Tratamiento Médico de Animal</option>
                      <option value="MERMA">🗑️ Merma / Deterioro</option>
                      <option value="AJUSTE">⚙️ Ajuste de Inventario (Salida)</option>
                    </>
                  )}
                </select>
              </div>

              {/* Si es Tratamiento Médico: Selector de Animal Vinculado */}
              {formMovimiento.tipo === 'SALIDA' && formMovimiento.subtipo === 'TRATAMIENTO_MEDICO' && (
                <div style={{ marginBottom: '14px', background: '#edf4fc', padding: '12px', borderRadius: '8px', border: '1px solid #cbe0f8' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#3478c4', marginBottom: '6px' }}>
                    🐾 Animal Vinculado al Tratamiento Clínico *
                  </label>
                  <select
                    value={formMovimiento.animalId}
                    onChange={e => setFormMovimiento(prev => ({ ...prev, animalId: e.target.value }))}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbe0f8', fontSize: '0.88rem' }}
                  >
                    <option value="">— Seleccionar animal albergado —</option>
                    {animales.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.nombre} ({a.especie} · Estado: {a.estadoSalud})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Si es Entrada: Donante o Proveedor */}
              {formMovimiento.tipo === 'ENTRADA' && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '6px' }}>
                    {formMovimiento.subtipo === 'DONACION' ? 'Nombre del Donante / Organización' : 'Proveedor / Distribuidora'}
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Fundación Huellitas, Tienda Mascotas..."
                    value={formMovimiento.donanteOProveedor}
                    onChange={e => setFormMovimiento(prev => ({ ...prev, donanteOProveedor: e.target.value }))}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                  />
                </div>
              )}

              {/* Cantidad y Verificación de Saldo no negativo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '6px' }}>
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formMovimiento.cantidad}
                    onChange={e => setFormMovimiento(prev => ({ ...prev, cantidad: e.target.value }))}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '6px' }}>
                    Lote (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="LOT-2026..."
                    value={formMovimiento.lote}
                    onChange={e => setFormMovimiento(prev => ({ ...prev, lote: e.target.value }))}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              {/* Advertencia visual en vivo si excede el saldo */}
              {formMovimiento.tipo === 'SALIDA' && insumoSeleccionado && Number(formMovimiento.cantidad) > insumoSeleccionado.stock && (
                <div style={{
                  padding: '10px 14px', borderRadius: '8px', background: '#fbeae8',
                  border: '1.5px solid #d1453b', color: '#d1453b', fontSize: '0.82rem', fontWeight: '700', marginBottom: '14px'
                }}>
                  🚨 Saldo negativo prohibido: El stock actual es {insumoSeleccionado.stock} {insumoSeleccionado.unidad} y no se puede retirar {formMovimiento.cantidad}.
                </div>
              )}

              {/* Motivo o Justificación */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '6px' }}>
                  Motivo / Justificación *
                </label>
                <textarea
                  rows="3"
                  placeholder="Detalle el motivo del movimiento..."
                  value={formMovimiento.motivo}
                  onChange={e => setFormMovimiento(prev => ({ ...prev, motivo: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalMovimientoOpen(false)}
                  style={{ background: '#f0f1f3', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: '700', cursor: 'pointer', color: '#57606a' }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={formMovimiento.tipo === 'SALIDA' && insumoSeleccionado && Number(formMovimiento.cantidad) > insumoSeleccionado.stock}
                  style={{
                    background: formMovimiento.tipo === 'SALIDA' && insumoSeleccionado && Number(formMovimiento.cantidad) > insumoSeleccionado.stock ? '#ccc' : '#3f6c52',
                    color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: '800', cursor: 'pointer'
                  }}
                >
                  Confirmar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREAR / EDITAR INSUMO */}
      {modalInsumoOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{ background: '#fff', borderRadius: '16px', maxWidth: '520px', width: '100%', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1f2430', margin: 0 }}>
                {insumoEditar ? '✏️ Modificar Insumo' : '📦 Registrar Nuevo Insumo'}
              </h3>
              <button
                onClick={() => setModalInsumoOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#7c8592' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarInsumo}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                  Nombre del Insumo / Producto *
                </label>
                <input
                  type="text"
                  required
                  value={formInsumo.nombre}
                  onChange={e => setFormInsumo(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej: Alimento Seco Adultos, Cefalexina..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                    Categoría *
                  </label>
                  <select
                    value={formInsumo.categoria}
                    onChange={e => {
                      const val = e.target.value;
                      const esMed = val.toLowerCase().includes('medicamento') || val.toLowerCase().includes('fármaco');
                      if (esMed && !esAutorizadoFarmacos) {
                        alert('La categoría Medicamentos / Fármacos está restringida a personal médico autorizado.');
                        return;
                      }
                      setFormInsumo(prev => ({ ...prev, categoria: val, esFarmaco: esMed ? true : prev.esFarmaco }));
                    }}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                  >
                    <option value="Alimento">Alimento</option>
                    <option value="Higiene">Higiene y Limpieza</option>
                    <option value="Equipamiento">Equipamiento</option>
                    {esAutorizadoFarmacos && <option value="Medicamento">Medicamento / Fármaco</option>}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                    Unidad de Medida
                  </label>
                  <input
                    type="text"
                    value={formInsumo.unidad}
                    onChange={e => setFormInsumo(prev => ({ ...prev, unidad: e.target.value }))}
                    placeholder="Sacos, Latas, Cajas, Litros..."
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                    Stock Inicial *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formInsumo.stock}
                    onChange={e => setFormInsumo(prev => ({ ...prev, stock: e.target.value }))}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                    Stock Mínimo Operacional *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formInsumo.stockMinimo}
                    onChange={e => setFormInsumo(prev => ({ ...prev, stockMinimo: e.target.value }))}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                    Fecha de Vencimiento
                  </label>
                  <input
                    type="date"
                    value={formInsumo.fechaVencimiento}
                    onChange={e => setFormInsumo(prev => ({ ...prev, fechaVencimiento: e.target.value }))}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                    Ubicación / Bodega
                  </label>
                  <input
                    type="text"
                    value={formInsumo.ubicacion}
                    onChange={e => setFormInsumo(prev => ({ ...prev, ubicacion: e.target.value }))}
                    placeholder="Bodega Central, Cocina..."
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdfe4', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              {/* Checkbox es fármaco solo si el usuario tiene rol médico */}
              {esAutorizadoFarmacos && (
                <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="chkFarmaco"
                    checked={formInsumo.esFarmaco}
                    onChange={e => setFormInsumo(prev => ({ ...prev, esFarmaco: e.target.checked }))}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <label htmlFor="chkFarmaco" style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1f2430', cursor: 'pointer' }}>
                    Clasificar como Fármaco / Medicamento Controlado (acceso restringido)
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalInsumoOpen(false)}
                  style={{ background: '#f0f1f3', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: '700', cursor: 'pointer', color: '#57606a' }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  style={{ background: '#3f6c52', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: '800', cursor: 'pointer' }}
                >
                  {insumoEditar ? 'Guardar Cambios' : 'Registrar Insumo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
