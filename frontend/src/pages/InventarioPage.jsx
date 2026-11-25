import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Modal from '../components/ui/Modal.jsx';
import useFormulario from '../hooks/useFormulario.js';
import { insumoSchema, movimientoSchema } from '../schemas/insumo.schema.js';
import ErrorCampo from '../components/ui/ErrorCampo.jsx';
import { usePortalFeedback } from '../context/PortalFeedback.jsx';
import React, { useState, useEffect } from 'react';
import AnimalSelect from '../components/AnimalSelect';
import { formatearErrorApi } from '../utils/errores';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Ban,
  CircleCheck,
  CircleX,
  Clock,
  MapPin,
  Package,
  PackagePlus,
  PawPrint,
  Pencil,
  Pill,
  Plus,
  Search,
  Siren,
  TriangleAlert
} from 'lucide-react';
import { guardarInsumo, listarAlertasInventario, listarInsumos, registrarMovimiento } from '../services/insumo.service.js';
import { listarAnimales } from '../services/animal.service.js';

export default function InventarioPage({ user }) {
  const { avisar } = usePortalFeedback();
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
  const insumoForm = useFormulario(insumoSchema, {
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
  const formInsumo = insumoForm.valores;
  const setFormInsumo = actualizar => typeof actualizar === 'function' ? insumoForm.cambiarCampos(actualizar) : insumoForm.reset(actualizar);

  // Formulario Movimiento Clasificado
  const movimientoForm = useFormulario(movimientoSchema, {
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
  const formMovimiento = movimientoForm.valores;
  const setFormMovimiento = actualizar => typeof actualizar === 'function' ? movimientoForm.cambiarCampos(actualizar) : movimientoForm.reset(actualizar);

  const esAutorizadoFarmacos = ['DIRECCION', 'PERSONAL_VETERINARIO'].includes(user?.rol);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [resInsumos, resAlertas, resAnimales] = await Promise.all([
        listarInsumos(),
        listarAlertasInventario(),
        listarAnimales().catch(() => ({ ok: false }))
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

  const handleGuardarInsumo = async (formInsumo) => {
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


      const res = await guardarInsumo(insumoEditar?.id, payload);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(formatearErrorApi(data));
      }

      avisar(insumoEditar ? 'Insumo actualizado exitosamente' : 'Insumo registrado en el inventario', 'exito');
      setModalInsumoOpen(false);
      cargarDatos();
    } catch (err) {
      avisar(formatearErrorApi(err), 'error');
    }
  };

  const handleGuardarMovimiento = async (formMovimiento) => {
    if (!formMovimiento.insumoId) {
      return avisar('Debe seleccionar un insumo', 'error');
    }

    const insumoActual = insumos.find(i => i.id === Number(formMovimiento.insumoId));
    const cantidadNum = Number(formMovimiento.cantidad);

    // Validación preventiva de saldo no negativo
    if (formMovimiento.tipo === 'SALIDA' && insumoActual && cantidadNum > insumoActual.stock) {
      return avisar(`Operación rechazada: Stock insuficiente. El stock actual es de ${insumoActual.stock} ${insumoActual.unidad} y no se permiten saldos negativos.`, 'error');
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

      const res = await registrarMovimiento(formMovimiento.insumoId, payload);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(formatearErrorApi(data));
      }

      avisar('Movimiento registrado con éxito. El stock fue actualizado en tiempo real.', 'exito');
      setModalMovimientoOpen(false);
      cargarDatos();
    } catch (err) {
      avisar(formatearErrorApi(err), 'error');
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
            <Package size={26} aria-hidden="true" />
            <span>Inventario de Insumos</span>
          </h2>
          <p className="portal-header-subtitle">
            Control de existencias en tiempo real, registro clasificado de entradas y salidas y alertas de stock mínimo.
          </p>
        </div>

        <div className="portal-header-actions">
          <Button
            onClick={() => abrirModalMovimiento()}
            className="portal-btn portal-btn-primary"
          >
            <ArrowLeftRight size={16} aria-hidden="true" /> Registrar Movimiento
          </Button>

          <Button
            onClick={abrirModalCrearInsumo}
            className="portal-btn portal-btn-secondary"
          >
            <Plus size={16} aria-hidden="true" /> Nuevo Insumo
          </Button>
        </div>
      </div>

      {/* Subnavegación de Inventario — Estilo portal-subtabs */}
      <div className="portal-subtabs">
        <Button
          onClick={() => setActiveTab('catalogo')}
          className={`portal-subtab-btn ${activeTab === 'catalogo' ? 'active' : ''}`}
        >
          <Package size={15} aria-hidden="true" /> Catálogo de Insumos ({insumos.length})
        </Button>
        <Button
          onClick={() => setActiveTab('alertas')}
          className={`portal-subtab-btn ${activeTab === 'alertas' ? 'active' : ''}`}
        >
          <Siren size={15} aria-hidden="true" /> Alertas de Stock ({alertas.totalAlertas || 0})
        </Button>
      </div>

      {/* TARJETAS RESUMEN OPERACIONAL */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--portal-surface)', borderRadius: '12px', border: 'var(--portal-border-emphasis) solid var(--portal-border)', padding: '18px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--portal-text-muted)' }}>Total Insumos</div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#1f2430', marginTop: '4px' }}>{insumos.length}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--portal-text-muted)' }}>Artículos activos en catálogo</div>
        </div>

        <div style={{ background: 'var(--portal-surface)', borderRadius: '12px', border: 'var(--portal-border-emphasis) solid #f3c9c4', padding: '18px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: '#b82d44' }}>Stock Mínimo / Crítico</div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#b82d44', marginTop: '4px' }}>{alertas.stockCriticoCount}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--portal-text-muted)' }}>Requieren reposición urgente</div>
        </div>

        <div style={{ background: 'var(--portal-surface)', borderRadius: '12px', border: 'var(--portal-border-emphasis) solid #f2dfbe', padding: '18px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: '#895100' }}>Próximos a Vencer</div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#895100', marginTop: '4px' }}>{alertas.vencimientoCount}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--portal-text-muted)' }}>Vencen en los próximos 30 días</div>
        </div>

      </div>

      {/* BARRA DE FILTROS Y BÚSQUEDA */}
      <div style={{
        background: 'var(--portal-surface)', borderRadius: '12px', border: 'var(--portal-border-emphasis) solid var(--portal-border)',
        padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center'
      }}>
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <Search
            size={16}
            aria-hidden="true"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--portal-text-muted)' }}
          />
          <Input
            type="text"
            placeholder="Buscar insumo por nombre, lote o ubicación..."
            value={filtroTexto}
            onChange={e => setFiltroTexto(e.target.value)}
            style={{ width: '100%', padding: '10px 14px 10px 36px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid #dcdfe4', fontSize: '0.88rem', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.84rem', fontWeight: '700', color: 'var(--portal-text-muted)' }}>Categoría:</span>
          <Input as="select"
            value={filtroCategoria}
            onChange={e => setFiltroCategoria(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid #dcdfe4', fontSize: '0.88rem', background: 'var(--portal-surface)' }}
          >
            {categorias.map((c, i) => (
              <option key={i} value={c}>{c}</option>
            ))}
          </Input>
        </div>

        <Button
          onClick={() => { setFiltroTexto(''); setFiltroCategoria('TODAS'); }}
          style={{ background: 'transparent', border: 'none', color: 'var(--portal-text-muted)', fontSize: '0.84rem', cursor: 'pointer', fontWeight: '600' }}
        >
          Limpiar filtros
        </Button>
      </div>

      {/* TABLA PRINCIPAL DE INSUMOS */}
      <div style={{ background: 'var(--portal-surface)', borderRadius: '12px', border: 'var(--portal-border-emphasis) solid var(--portal-border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'var(--portal-surface-muted)', borderBottom: 'var(--portal-border-emphasis) solid var(--portal-border)' }}>
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
                <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: 'var(--portal-text-muted)' }}>
                  Cargando inventario de insumos...
                </td>
              </tr>
            ) : insumosFiltrados.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: 'var(--portal-text-muted)' }}>
                  No se encontraron insumos con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              insumosFiltrados.map(ins => {
                const stockCritico = ins.esStockBajo;
                const agotado = ins.esAgotado;

                return (
                  <tr key={ins.id} style={{ borderBottom: 'var(--portal-border-emphasis) solid #f0f1f3', transition: 'background 0.15s' }}>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: '800', color: '#1f2430', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {ins.esFarmaco && <Pill size={15} color="#3478c4" aria-label="Fármaco / Medicamento controlado" />}
                        {ins.nombre}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--portal-text-muted)', marginTop: '2px' }}>
                        {ins.ubicacion && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><MapPin size={12} aria-hidden="true" /> {ins.ubicacion} · </span>}
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

                    <td style={{ padding: '14px 18px', fontWeight: '800', fontSize: '1rem', color: agotado ? '#b82d44' : (stockCritico ? '#895100' : '#1f2430') }}>
                      {ins.stock} <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--portal-text-muted)' }}>{ins.unidad}</span>
                    </td>

                    <td style={{ padding: '14px 18px', color: 'var(--portal-text-muted)', fontSize: '0.84rem' }}>
                      {ins.stockMinimo} {ins.unidad}
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      {agotado ? (
                        <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800', background: '#ffe4e6', color: '#b82d44', border: 'var(--portal-border-emphasis) solid #f3c9c4', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CircleX size={12} aria-hidden="true" /> AGOTADO
                        </span>
                      ) : stockCritico ? (
                        <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800', background: '#fff4e5', color: '#895100', border: 'var(--portal-border-emphasis) solid #f2dfbe', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <TriangleAlert size={12} aria-hidden="true" /> STOCK CRÍTICO
                        </span>
                      ) : (
                        <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800', background: 'var(--portal-primary-soft)', color: 'var(--portal-primary-dark)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CircleCheck size={12} aria-hidden="true" /> NORMAL
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      {ins.fechaVencimiento ? (
                        <div>
                          <div style={{ fontSize: '0.84rem', fontWeight: '700', color: ins.estaVencido ? '#b82d44' : (ins.alertaVencimiento ? '#895100' : '#1f2430') }}>
                            {new Date(ins.fechaVencimiento).toLocaleDateString()}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: ins.estaVencido ? '#b82d44' : (ins.alertaVencimiento ? '#895100' : '#7c8592'), fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {ins.estaVencido ? <><Ban size={12} aria-hidden="true" /> ¡VENCIDO!</> : (ins.alertaVencimiento ? <><Clock size={12} aria-hidden="true" /> Vence en {ins.diasParaVencer}d</> : `${ins.diasParaVencer}d restantes`)}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--portal-text-muted)', fontSize: '0.78rem' }}>No perecible / S/V</span>
                      )}
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <Button
                          onClick={() => abrirModalMovimiento(ins)}
                          title="Registrar entrada o salida"
                          style={{
                            background: 'var(--portal-primary-soft)', color: 'var(--portal-primary-dark)', border: 'none', borderRadius: '6px',
                            padding: '6px 10px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer'
                          }}
                        >
                          ⇄ Mover
                        </Button>

                        <Button
                          onClick={() => abrirModalEditarInsumo(ins)}
                          title="Editar parámetros del insumo"
                          style={{
                            background: 'var(--portal-surface-muted)', color: '#57606a', border: 'var(--portal-border-emphasis) solid #dcdfe4', borderRadius: '6px',
                            padding: '6px 10px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer'
                          }}
                        >
                          <Pencil size={12} aria-hidden="true" /> Editar
                        </Button>
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
        <Modal onClose={() => setModalMovimientoOpen(false)} nombre="Registrar movimiento" bloqueado={movimientoForm.isSubmitting} cerrarAlPulsarFondo={false}
          papel={{ style: { background: 'var(--portal-surface)', borderRadius: '16px', maxWidth: '540px', width: '100%', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1f2430', margin: 0 }}>
                <ArrowLeftRight size={15} aria-hidden="true" /> Registrar Movimiento Clasificado
              </h3>
              <Button
                onClick={() => setModalMovimientoOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--portal-text-muted)' }}
              >
                ✕
              </Button>
            </div>

            <form noValidate onSubmit={movimientoForm.handleSubmit(handleGuardarMovimiento)}>
              {/* Selector de Insumo */}
              <div style={{ marginBottom: '14px' }}>
                <label htmlFor={movimientoForm.idCampo('insumoId')} style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '6px' }}>
                  Insumo *
                </label>
                <Input as="select" {...movimientoForm.campo("insumoId")}
                  value={formMovimiento.insumoId}
                  onChange={handleInsumoSelectChange}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid #dcdfe4', fontSize: '0.88rem' }}
                >
                  <option value="">— Seleccionar insumo —</option>
                  {insumos.map(ins => (
                    <option key={ins.id} value={ins.id}>
                      {ins.nombre} (Stock actual: {ins.stock} {ins.unidad})
                    </option>
                  ))}
                </Input>
              </div>

              {/* Muestra de Stock Disponible en Tiempo Real */}
              {insumoSeleccionado && (
                <div style={{
                  padding: '10px 14px', borderRadius: '8px', background: 'var(--portal-surface-muted)',
                  border: 'var(--portal-border-emphasis) solid var(--portal-border)', marginBottom: '14px', fontSize: '0.84rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Stock Disponible Actual:</span>
                    <strong style={{ color: insumoSeleccionado.stock === 0 ? '#b82d44' : 'var(--portal-primary-dark)' }}>
                      {insumoSeleccionado.stock} {insumoSeleccionado.unidad}
                    </strong>
                  </div>
                  {insumoSeleccionado.esFarmaco && (
                    <div style={{ fontSize: '0.76rem', color: '#3478c4', marginTop: '4px', fontWeight: '700' }}>
                      <Pill size={13} aria-hidden="true" /> Producto clasificado como Fármaco. Operación reservada a Personal Clínico Autorizado.
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
                  <Button
                    type="button"
                    onClick={() => setFormMovimiento(prev => ({ ...prev, tipo: 'SALIDA', subtipo: 'CONSUMO' }))}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer',
                      background: formMovimiento.tipo === 'SALIDA' ? '#ffe4e6' : '#f8f9fa',
                      color: formMovimiento.tipo === 'SALIDA' ? '#b82d44' : '#7c8592',
                      border: `var(--portal-border-emphasis) solid ${formMovimiento.tipo === 'SALIDA' ? '#b82d44' : '#e9eaed'}`
                    }}
                  >
                    <ArrowDown size={15} aria-hidden="true" /> Salida (Consumo / Tratamiento)
                  </Button>

                  <Button
                    type="button"
                    onClick={() => setFormMovimiento(prev => ({ ...prev, tipo: 'ENTRADA', subtipo: 'DONACION' }))}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer',
                      background: formMovimiento.tipo === 'ENTRADA' ? 'var(--portal-primary-soft)' : '#f8f9fa',
                      color: formMovimiento.tipo === 'ENTRADA' ? 'var(--portal-primary-dark)' : '#7c8592',
                      border: `var(--portal-border-emphasis) solid ${formMovimiento.tipo === 'ENTRADA' ? 'var(--portal-primary-dark)' : '#e9eaed'}`
                    }}
                  >
                    <ArrowUp size={15} aria-hidden="true" /> Entrada (Donación / Compra)
                  </Button>
                </div>
              </div>

              {/* Subtipo Clasificado */}
              <div style={{ marginBottom: '14px' }}>
                <label htmlFor={movimientoForm.idCampo('subtipo')} style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '6px' }}>
                  Clasificación del Movimiento *
                </label>
                <Input as="select" {...movimientoForm.campo("subtipo")}
                  value={formMovimiento.subtipo}
                  onChange={e => setFormMovimiento(prev => ({ ...prev, subtipo: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid #dcdfe4', fontSize: '0.88rem' }}
                >
                  {formMovimiento.tipo === 'ENTRADA' ? (
                    <>
                      <option value="DONACION">Donación (Comunidad / Campañas)</option>
                      <option value="COMPRA">Compra Directa del Refugio</option>
                      <option value="AJUSTE">Ajuste de Inventario (Entrada)</option>
                    </>
                  ) : (
                    <>
                      <option value="CONSUMO">Consumo General / Alimentación / Limpieza</option>
                      <option value="TRATAMIENTO_MEDICO">Vinculación a Tratamiento Médico de Animal</option>
                      <option value="MERMA">Merma / Deterioro</option>
                      <option value="AJUSTE">Ajuste de Inventario (Salida)</option>
                    </>
                  )}
                </Input>
              </div>

              {/* Si es Tratamiento Médico: Selector de Animal Vinculado */}
              {formMovimiento.tipo === 'SALIDA' && formMovimiento.subtipo === 'TRATAMIENTO_MEDICO' && (
                <div style={{ marginBottom: '14px', background: '#edf4fc', padding: '12px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid #cbe0f8' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#3478c4', marginBottom: '6px' }}>
                    <PawPrint size={13} aria-hidden="true" /> Animal Vinculado al Tratamiento Clínico *
                  </label>
                  <AnimalSelect
                    animales={animales}
                    value={formMovimiento.animalId}
                    onChange={animalId => setFormMovimiento(prev => ({ ...prev, animalId }))}
                    placeholder="— Seleccionar animal albergado —"
                    searchPlaceholder="Buscar por nombre, especie o estado..."
                  />
                  <ErrorCampo error={movimientoForm.errorCampo("animalId")} />
                </div>
              )}

              {/* Si es Entrada: Donante o Proveedor */}
              {formMovimiento.tipo === 'ENTRADA' && (
                <div style={{ marginBottom: '14px' }}>
                  <label htmlFor={movimientoForm.idCampo('donanteOProveedor')} style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '6px' }}>
                    {formMovimiento.subtipo === 'DONACION' ? 'Nombre del Donante / Organización' : 'Proveedor / Distribuidora'}
                  </label>
                  <Input {...movimientoForm.campo("donanteOProveedor")}
                    type="text"
                    placeholder="Ej: Fundación Huellitas, Tienda Mascotas..."
                    value={formMovimiento.donanteOProveedor}
                    onChange={e => setFormMovimiento(prev => ({ ...prev, donanteOProveedor: e.target.value }))}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid #dcdfe4', fontSize: '0.88rem' }}
                  />
                </div>
              )}

              {/* Cantidad y Verificación de Saldo no negativo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label htmlFor={movimientoForm.idCampo('cantidad')} style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '6px' }}>
                    Cantidad *
                  </label>
                  <Input {...movimientoForm.campo("cantidad")}
                    type="number"
                    min="1"
                    value={formMovimiento.cantidad}
                    onChange={e => setFormMovimiento(prev => ({ ...prev, cantidad: e.target.value }))}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid #dcdfe4', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label htmlFor={movimientoForm.idCampo('lote')} style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '6px' }}>
                    Lote (Opcional)
                  </label>
                  <Input {...movimientoForm.campo("lote")}
                    type="text"
                    placeholder="LOT-2026..."
                    value={formMovimiento.lote}
                    onChange={e => setFormMovimiento(prev => ({ ...prev, lote: e.target.value }))}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid #dcdfe4', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              {/* Advertencia visual en vivo si excede el saldo */}
              {formMovimiento.tipo === 'SALIDA' && insumoSeleccionado && Number(formMovimiento.cantidad) > insumoSeleccionado.stock && (
                <div style={{
                  padding: '10px 14px', borderRadius: '8px', background: '#ffe4e6',
                  border: 'var(--portal-border-emphasis) solid #b82d44', color: '#b82d44', fontSize: '0.82rem', fontWeight: '700', marginBottom: '14px'
                }}>
                  <Siren size={14} aria-hidden="true" /> Saldo negativo prohibido: El stock actual es {insumoSeleccionado.stock} {insumoSeleccionado.unidad} y no se puede retirar {formMovimiento.cantidad}.
                </div>
              )}

              {/* Motivo o Justificación */}
              <div style={{ marginBottom: '18px' }}>
                <label htmlFor={movimientoForm.idCampo('motivo')} style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '6px' }}>
                  Motivo / Justificación *
                </label>
                <Input as="textarea" {...movimientoForm.campo("motivo")}
                  rows="3"
                  placeholder="Detalle el motivo del movimiento..."
                  value={formMovimiento.motivo}
                  onChange={e => setFormMovimiento(prev => ({ ...prev, motivo: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid #dcdfe4', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <Button
                  type="button"
                  onClick={() => setModalMovimientoOpen(false)}
                  style={{ background: 'var(--portal-surface-muted)', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: '700', cursor: 'pointer', color: '#57606a' }}
                >
                  Cancelar
                </Button>

                <Button cargando={movimientoForm.isSubmitting}
                  type="submit"
                  disabled={formMovimiento.tipo === 'SALIDA' && insumoSeleccionado && Number(formMovimiento.cantidad) > insumoSeleccionado.stock}
                  style={{
                    background: formMovimiento.tipo === 'SALIDA' && insumoSeleccionado && Number(formMovimiento.cantidad) > insumoSeleccionado.stock ? '#ccc' : 'var(--portal-primary)',
                    color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: '800', cursor: 'pointer'
                  }}
                >
                  Confirmar Movimiento
                </Button>
              </div>
            </form>
          </Modal>
      )}

      {/* MODAL: CREAR / EDITAR INSUMO */}
      {modalInsumoOpen && (
        <Modal onClose={() => setModalInsumoOpen(false)} nombre="Ficha del insumo" bloqueado={insumoForm.isSubmitting} cerrarAlPulsarFondo={false}
          papel={{ style: { background: 'var(--portal-surface)', borderRadius: '16px', maxWidth: '520px', width: '100%', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1f2430', margin: 0, display: 'flex', alignItems: 'center', gap: '7px' }}>
                {insumoEditar ? <><Pencil size={19} aria-hidden="true" /> Modificar Insumo</> : <><PackagePlus size={19} aria-hidden="true" /> Registrar Nuevo Insumo</>}
              </h3>
              <Button
                onClick={() => setModalInsumoOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--portal-text-muted)' }}
              >
                ✕
              </Button>
            </div>

            <form noValidate onSubmit={insumoForm.handleSubmit(handleGuardarInsumo)}>
              <div style={{ marginBottom: '12px' }}>
                <label htmlFor={insumoForm.idCampo('nombre')} style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                  Nombre del Insumo / Producto *
                </label>
                <Input {...insumoForm.campo("nombre")}
                  type="text"
                  required
                  value={formInsumo.nombre}
                  onChange={e => setFormInsumo(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej: Alimento Seco Adultos, Cefalexina..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid #dcdfe4', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label htmlFor={insumoForm.idCampo('categoria')} style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                    Categoría *
                  </label>
                  <Input as="select" {...insumoForm.campo("categoria")}
                    value={formInsumo.categoria}
                    onChange={e => {
                      const val = e.target.value;
                      const esMed = val.toLowerCase().includes('medicamento') || val.toLowerCase().includes('fármaco');
                      if (esMed && !esAutorizadoFarmacos) {
                        avisar('La categoría Medicamentos / Fármacos está restringida a personal médico autorizado.', 'error');
                        return;
                      }
                      setFormInsumo(prev => ({ ...prev, categoria: val, esFarmaco: esMed ? true : prev.esFarmaco }));
                    }}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid #dcdfe4', fontSize: '0.88rem' }}
                  >
                    <option value="Alimento">Alimento</option>
                    <option value="Higiene">Higiene y Limpieza</option>
                    <option value="Equipamiento">Equipamiento</option>
                    {esAutorizadoFarmacos && <option value="Medicamento">Medicamento / Fármaco</option>}
                  </Input>
                </div>

                <div>
                  <label htmlFor={insumoForm.idCampo('unidad')} style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                    Unidad de Medida
                  </label>
                  <Input {...insumoForm.campo("unidad")}
                    type="text"
                    value={formInsumo.unidad}
                    onChange={e => setFormInsumo(prev => ({ ...prev, unidad: e.target.value }))}
                    placeholder="Sacos, Latas, Cajas, Litros..."
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid #dcdfe4', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label htmlFor={insumoForm.idCampo('stock')} style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                    Stock Inicial *
                  </label>
                  <Input {...insumoForm.campo("stock")}
                    type="number"
                    min="0"
                    required
                    value={formInsumo.stock}
                    onChange={e => setFormInsumo(prev => ({ ...prev, stock: e.target.value }))}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid #dcdfe4', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label htmlFor={insumoForm.idCampo('stockMinimo')} style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                    Stock Mínimo Operacional *
                  </label>
                  <Input {...insumoForm.campo("stockMinimo")}
                    type="number"
                    min="0"
                    required
                    value={formInsumo.stockMinimo}
                    onChange={e => setFormInsumo(prev => ({ ...prev, stockMinimo: e.target.value }))}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid #dcdfe4', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label htmlFor={insumoForm.idCampo('fechaVencimiento')} style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                    Fecha de Vencimiento
                  </label>
                  <Input {...insumoForm.campo("fechaVencimiento")}
                    type="date"
                    value={formInsumo.fechaVencimiento}
                    onChange={e => setFormInsumo(prev => ({ ...prev, fechaVencimiento: e.target.value }))}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid #dcdfe4', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label htmlFor={insumoForm.idCampo('ubicacion')} style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                    Ubicación / Bodega
                  </label>
                  <Input {...insumoForm.campo("ubicacion")}
                    type="text"
                    value={formInsumo.ubicacion}
                    onChange={e => setFormInsumo(prev => ({ ...prev, ubicacion: e.target.value }))}
                    placeholder="Bodega Central, Cocina..."
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid #dcdfe4', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              {/* Checkbox es fármaco solo si el usuario tiene rol médico */}
              {esAutorizadoFarmacos && (
                <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Input {...insumoForm.campo("esFarmaco", "chkFarmaco")}
                    type="checkbox"
                    
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
                <Button
                  type="button"
                  onClick={() => setModalInsumoOpen(false)}
                  style={{ background: 'var(--portal-surface-muted)', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: '700', cursor: 'pointer', color: '#57606a' }}
                >
                  Cancelar
                </Button>

                <Button cargando={insumoForm.isSubmitting}
                  type="submit"
                  style={{ background: 'var(--portal-primary)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: '800', cursor: 'pointer' }}
                >
                  {insumoEditar ? 'Guardar Cambios' : 'Registrar Insumo'}
                </Button>
              </div>
            </form>
          </Modal>
      )}
    </div>
  );
}
