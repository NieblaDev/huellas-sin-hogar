import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Input from '../components/ui/Input.jsx';
import Modal from '../components/ui/Modal.jsx';
import { formatearErrorApi } from '../utils/errores';
import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Eye,
  FileText,
  Filter,
  Info,
  Lock,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  User,
  X
} from 'lucide-react';
import { listarAuditorias } from '../services/audit.service.js';

const ETIQUETAS_ENTIDADES = {
  SolicitudAdopcion: 'Solicitud de adopción',
  EtapaAdopcion: 'Etapa de adopción',
  SeguimientoAdopcion: 'Seguimiento de adopción',
  Adopcion: 'Adopción',
  ConfiguracionSistema: 'Configuración del sistema',
  Devolucion: 'Devolución',
  IndicacionCuidado: 'Indicación de cuidado',
  BitacoraCuidado: 'Bitácora de cuidado',
  VacunaAnimal: 'Vacuna',
  AtencionClinica: 'Atención clínica',
  CuarentenaAnimal: 'Cuarentena',
  PermutaTurnos: 'Permuta de turnos',
  BitacoraTurnos: 'Bitácora de turnos'
};

const etiquetaEntidad = entidad => ETIQUETAS_ENTIDADES[entidad] || entidad;

// Campos de auditoría que se pueden mostrar con una etiqueta legible.
const ETIQUETAS_CAMPOS = {
  nombre: 'Nombre',
  especie: 'Especie',
  raza: 'Raza',
  sexo: 'Sexo',
  edadEstimada: 'Edad estimada (años)',
  peso: 'Peso (kg)',
  color: 'Color / Pelaje',
  tamano: 'Tamaño',
  estadoSalud: 'Estado de salud',
  estadoAdopcion: 'Estado de adopción',
  canil: 'Canil',
  descripcion: 'Descripción',
  observaciones: 'Observaciones',
  motivoIngreso: 'Motivo de ingreso',
  fechaIngreso: 'Fecha de ingreso',
  activo: 'Activo',
  esterilizado: 'Esterilizado/a',
  microchip: 'Número de microchip',
  vacunado: 'Vacunado',
  desparasitado: 'Desparasitado',
  sector: 'Sector',
  estado: 'Estado',
  capacidad: 'Capacidad',
  tipo: 'Tipo',
  destinoNombre: 'Destino (Nombre)',
  destinoContacto: 'Contacto de destino',
  destinoDireccion: 'Dirección de destino',
  motivo: 'Motivo',
  email: 'Correo electrónico',
  rol: 'Rol asignado',
  telefono: 'Teléfono',
  direccion: 'Dirección',
  identificacion: 'Identificación / RUT',
  tipoIdentificacion: 'Tipo de identificación',
  cantidad: 'Cantidad',
  unidadMedida: 'Unidad de medida',
  stockMinimo: 'Stock mínimo',
  stockActual: 'Stock actual',
  ubicacion: 'Ubicación',
  animal: 'Animal',
  diagnostico: 'Diagnóstico',
  codigo: 'Código',
  notaMantencion: 'Nota de mantención',
  chip: 'Número de microchip',
  edad: 'Edad',
  tipoIngreso: 'Tipo de ingreso',
  historialMedico: 'Historial médico',
  nota: 'Nota',
  categoria: 'Categoría',
  lote: 'Lote',
  fechaVencimiento: 'Fecha de vencimiento',
  stock: 'Stock',
  unidad: 'Unidad de medida',
  fecha: 'Fecha',
  estadoAnterior: 'Estado anterior',
  estadoNuevo: 'Estado nuevo',
  estadoPlanificacion: 'Estado de la planificación',
  animalAnterior: 'Animal anterior',
  animalAsignado: 'Animal asignado',
  voluntario: 'Voluntario',
  aprobadoPor: 'Aprobado por',
  resueltoPor: 'Resuelto por',
  comentario: 'Comentario',
  cupoMaximo: 'Cupo máximo',
  tareasRealizadas: 'Tareas realizadas',
  incidentes: 'Incidentes',
  instruccion: 'Instrucción de cuidado',
  fechaInicio: 'Fecha de inicio',
  fechaFin: 'Fecha de término',
  nombreVacuna: 'Vacuna',
  fechaAplicacion: 'Fecha de aplicación',
  resultado: 'Resultado'
};

// Formateador amigable para valores booleanos, nulos, fechas o enums
const formatearValorLegible = (valor) => {
  if (valor === null || valor === undefined || valor === '') {
    return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No especificado</span>;
  }
  if (typeof valor === 'boolean') {
    return valor ? 'Sí' : 'No';
  }
  if (typeof valor === 'object') {
    if (Array.isArray(valor)) {
      const nombres = valor.map(item => item?.nombre).filter(Boolean);
      return nombres.join(', ') || 'Sin detalles disponibles';
    }
    return valor.nombre || 'Sin detalles disponibles';
  }

  const str = String(valor);

  // Formatear fechas ISO
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) {
    const fecha = new Date(str);
    if (!Number.isNaN(fecha.getTime())) {
      return fecha.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  // Traducción o formateo de Enums comunes
  const traducciones = {
    CANINO: 'Perro / Canino',
    FELINO: 'Gato / Felino',
    OTRO: 'Otro',
    MACHO: 'Macho',
    HEMBRA: 'Hembra',
    DISPONIBLE: 'Disponible',
    EN_TRATAMIENTO: 'En tratamiento',
    EN_REFUGIO: 'En refugio',
    ADOPTADO: 'Adoptado',
    FALLECIDO: 'Fallecido',
    LIBRE: 'Libre',
    OCUPADO: 'Ocupado',
    CUARENTENA: 'Cuarentena',
    MANTENIMIENTO: 'Mantenimiento',
    BUENO: 'Bueno',
    REGULAR: 'Regular',
    CRITICO: 'Crítico',
    FEMENINO: 'Femenino',
    MASCULINO: 'Masculino',
    NEUTRO: 'Neutro'
  };

  return traducciones[str] || str.replace(/_/g, ' ');
};

export default function AuditoriaPage({ user }) {
  const [resultado, setResultado] = useState(null);
  const auditorias = resultado ?? [];
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Filtros
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroEntidad, setFiltroEntidad] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // Registro seleccionado para ver detalle
  const [detalleRegistro, setDetalleRegistro] = useState(null);
  const [tabAccion, setTabAccion] = useState('TODAS'); // 'TODAS' | 'CREACION' | 'MODIFICACION' | 'BAJA_LOGICA'

  useEffect(() => {
    const controller = new AbortController();
    setCargando(true);
    setError(null);
    const timer = setTimeout(() => fetchAuditorias(controller.signal), 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filtroUsuario, filtroEntidad, fechaDesde, fechaHasta]);

  const fetchAuditorias = async (signal) => {
    try {
      const params = new URLSearchParams();
      if (filtroUsuario.trim()) params.append('usuarioResponsable', filtroUsuario.trim());
      if (filtroEntidad) params.append('entidad', filtroEntidad);
      if (fechaDesde) params.append('fechaDesde', fechaDesde);
      if (fechaHasta) params.append('fechaHasta', fechaHasta);

      const res = await listarAuditorias(params, signal);

      if (res.status === 403) {
        throw new Error('Acceso restringido: Módulo exclusivo para Dirección');
      }

      if (!res.ok) throw new Error('Error al consultar bitácora de auditoría');

      const data = await res.json();
      if (signal.aborted) return;
      setResultado(data.registros || []);
      setTotal(data.total || 0);
    } catch (err) {
      if (!signal.aborted) setError(formatearErrorApi(err));
    } finally {
      if (!signal.aborted) setCargando(false);
    }
  };

  const hayFiltrosActivos = Boolean(filtroUsuario || filtroEntidad || fechaDesde || fechaHasta);

  const handleLimpiarFiltros = () => {
    setFiltroUsuario('');
    setFiltroEntidad('');
    setFechaDesde('');
    setFechaHasta('');
  };

  const accionColor = {
    CREACION: { bg: 'var(--portal-primary-soft)', color: 'var(--portal-primary-dark)', label: 'Creación' },
    MODIFICACION: { bg: '#e5e8ff', color: '#4550c0', label: 'Modificación' },
    BAJA_LOGICA: { bg: '#ffe4e6', color: '#b82d44', label: 'Baja Lógica' }
  };

  const accionNombres = {
    CREACION: 'Creación',
    MODIFICACION: 'Modificación',
    BAJA_LOGICA: 'Baja lógica'
  };

  const describirAccion = (item) => {
    const accion = accionNombres[item.accion] || item.accion;
    const nombre = item.entidadNombre;
    if (item.entidad === 'Animal') {
      return nombre
        ? `${accion} de la ficha del animal: ${nombre}`
        : `${accion} de ficha de animal`;
    }
    return nombre
      ? `${accion} de registro en ${etiquetaEntidad(item.entidad)} — ${nombre}`
      : `${accion} de registro en ${etiquetaEntidad(item.entidad)}`;
  };

  const auditoriasFiltradas = auditorias.filter(item => tabAccion === 'TODAS' || item.accion === tabAccion);

  // Obtener la lista unificada de campos cambiados o registrados
  const obtenerCamposRelevantes = (anterior, nuevo, entidad) => {
    const claves = new Set([
      ...Object.keys(anterior || {}),
      ...Object.keys(nuevo || {})
    ]);

    return Array.from(claves).filter(c => Object.hasOwn(ETIQUETAS_CAMPOS, c) && !(entidad === 'Canil' && ['codigo', 'tipo'].includes(c)));
  };

  return (
    <div className="portal-page-container portal-page-scroll portal-page-scroll-con-filtros">
      {/* ENCABEZADO */}
      <div className="portal-header">
        <div>
          <h2 className="portal-header-title">
            <ShieldCheck size={26} aria-hidden="true" />
            <span>Módulo de Auditoría y Trazabilidad</span>
          </h2>
          <p className="portal-header-subtitle">
            Bitácora histórica inmutable de solo lectura. Registro automático de creaciones, modificaciones y bajas lógicas.
          </p>
        </div>
        <div className="portal-header-actions">
          <div style={{
            background: 'var(--portal-surface)', border: 'var(--portal-border-emphasis) solid var(--portal-border)', borderRadius: 'var(--portal-radius-sm)', padding: '6px 14px',
            fontSize: '0.78rem', color: 'var(--portal-text-muted)', display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <Lock size={14} aria-hidden="true" /> Solo lectura (Inmutable)
          </div>
        </div>
      </div>

      {/* Subnavegación de Auditoría — Estilo portal-subtabs */}
      <div className="portal-subtabs">
        <Button
          onClick={() => setTabAccion('TODAS')}
          className={`portal-subtab-btn ${tabAccion === 'TODAS' ? 'active' : ''}`}
        >
          <ClipboardList size={15} aria-hidden="true" /> Toda la Bitácora ({auditorias.length})
        </Button>
        <Button
          onClick={() => setTabAccion('CREACION')}
          className={`portal-subtab-btn ${tabAccion === 'CREACION' ? 'active' : ''}`}
        >
          <Plus size={15} aria-hidden="true" /> Creaciones ({auditorias.filter(a => a.accion === 'CREACION').length})
        </Button>
        <Button
          onClick={() => setTabAccion('MODIFICACION')}
          className={`portal-subtab-btn ${tabAccion === 'MODIFICACION' ? 'active' : ''}`}
        >
          <Pencil size={15} aria-hidden="true" /> Modificaciones ({auditorias.filter(a => a.accion === 'MODIFICACION').length})
        </Button>
        <Button
          onClick={() => setTabAccion('BAJA_LOGICA')}
          className={`portal-subtab-btn ${tabAccion === 'BAJA_LOGICA' ? 'active' : ''}`}
        >
          <Trash2 size={15} aria-hidden="true" /> Bajas Lógicas ({auditorias.filter(a => a.accion === 'BAJA_LOGICA').length})
        </Button>
      </div>

      {error && (
        <div style={{ background: '#ffe4e6', border: 'var(--portal-border-emphasis) solid #f3c9c4', color: '#b82d44', padding: '14px', borderRadius: '10px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <Card className="portal-card portal-filtros-card">
        <div className="portal-filtros portal-filtros-cuatro-campos">
          <div className="portal-filtros-campo portal-filtros-campo-busqueda">
            <label htmlFor="auditoria-usuario" className="portal-filtros-etiqueta">Usuario responsable</label>
            <div className="portal-filtros-buscador">
              <Search size={16} aria-hidden="true" className="portal-filtros-buscador-icono" />
              <Input
                id="auditoria-usuario"
                type="search"
                autoComplete="off"
                placeholder="Nombre o correo..."
                value={filtroUsuario}
                onChange={e => setFiltroUsuario(e.target.value)}
                className="portal-input"
              />
            </div>
          </div>

          <div className="portal-filtros-campo portal-filtros-campo-estado">
            <label htmlFor="auditoria-entidad" className="portal-filtros-etiqueta">Entidad afectada</label>
            <Input as="select"
              id="auditoria-entidad"
              value={filtroEntidad}
              onChange={e => setFiltroEntidad(e.target.value)}
              className="portal-select"
            >
              <option value="">Todas las entidades</option>
              <option value="Animal">Ficha Animal</option>
              <option value="Postulante">Postulantes Adopción</option>
              <option value="Inventario">Inventario / Insumos</option>
              <option value="Canil">Caniles / Espacios</option>
              <option value="Traslado">Traslados</option>
              <option value="Usuario">Usuarios / Perfiles</option>
            </Input>
          </div>

          <div className="portal-filtros-campo portal-filtros-campo-mitad">
            <label htmlFor="auditoria-desde" className="portal-filtros-etiqueta">Fecha desde</label>
            <Input
              id="auditoria-desde"
              type="date"
              value={fechaDesde}
              max={fechaHasta || undefined}
              onChange={e => setFechaDesde(e.target.value)}
              className="portal-input"
            />
          </div>

          <div className="portal-filtros-campo portal-filtros-campo-mitad">
            <label htmlFor="auditoria-hasta" className="portal-filtros-etiqueta">Fecha hasta</label>
            <Input
              id="auditoria-hasta"
              type="date"
              value={fechaHasta}
              min={fechaDesde || undefined}
              onChange={e => setFechaHasta(e.target.value)}
              className="portal-input"
            />
          </div>
        </div>

        {(hayFiltrosActivos || (cargando && resultado)) && (
          <div className="portal-filtros-acciones">
            {cargando && resultado && (
              <span className="portal-filtros-buscando" role="status">
                Actualizando resultados…
              </span>
            )}
            {hayFiltrosActivos && (
              <Button
                type="button"
                onClick={handleLimpiarFiltros}
                className="portal-btn portal-btn-secondary portal-filtros-limpiar"
              >
                <X size={14} aria-hidden="true" /> Limpiar filtros
              </Button>
            )}
          </div>
        )}
      </Card>

      <div className="portal-page-scroll-content">
        {/* TABLA DE AUDITORÍA CON CLIC EN FILA */}
        <div style={{ background: 'var(--portal-surface)', borderRadius: '16px', border: 'var(--portal-border-emphasis) solid var(--portal-border)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(20,24,32,0.03)' }}>
          <div style={{ padding: '16px 20px', borderBottom: 'var(--portal-border-emphasis) solid #f0f1f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: '700', color: '#1f2430' }}>
              Total de registros: {total} {auditoriasFiltradas.length !== auditorias.length && `(mostrando ${auditoriasFiltradas.length})`}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--portal-text-muted)', fontStyle: 'italic' }}>
              Haz clic en cualquier fila para ver el detalle comparativo y trazabilidad
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: 'var(--portal-surface-muted)', borderBottom: 'var(--portal-border-emphasis) solid var(--portal-border)', textAlign: 'left', color: 'var(--portal-text-muted)' }}>
                  <th style={{ padding: '12px 16px' }}>Fecha y Hora</th>
                  <th style={{ padding: '12px 16px' }}>Usuario Responsable</th>
                  <th style={{ padding: '12px 16px' }}>Entidad Afectada</th>
                  <th style={{ padding: '12px 16px' }}>Acción</th>
                  <th style={{ padding: '12px 16px' }}>Descripción de la Acción</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {cargando && !resultado ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--portal-text-muted)' }}>
                      Cargando bitácora de auditoría...
                    </td>
                  </tr>
                ) : auditoriasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--portal-text-muted)' }}>
                      No se encontraron registros que coincidan con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  auditoriasFiltradas.map(item => {
                    const badge = accionColor[item.accion] || { bg: '#e9eaed', color: 'var(--portal-text-muted)', label: item.accion };
                    const fechaObj = new Date(item.fechaHora);

                    return (
                      <tr
                        key={item.id}
                        onClick={() => setDetalleRegistro(item)}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--portal-surface-muted)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        style={{ borderBottom: 'var(--portal-border-emphasis) solid #f0f1f3', cursor: 'pointer', transition: 'background 0.15s ease' }}
                      >
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <strong>{fechaObj.toLocaleDateString('es-CL')}</strong>{' '}
                          <span style={{ color: 'var(--portal-text-muted)' }}>{fechaObj.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <strong>{item.usuarioNombre || 'Sistema'}</strong>
                          <div style={{ fontSize: '0.74rem', color: 'var(--portal-text-muted)' }}>{item.usuarioEmail || 'Automático'}</div>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: '700', color: '#1f2430' }}>
                          {etiquetaEntidad(item.entidad)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            fontSize: '0.72rem', fontWeight: '800', padding: '3px 8px', borderRadius: '6px',
                            background: badge.bg, color: badge.color, textTransform: 'uppercase'
                          }}>
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#1f2430' }}>
                          {describirAccion(item)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: 'var(--portal-primary)',
                            fontWeight: '700',
                            fontSize: '0.78rem'
                          }}>
                            Ver detalle <ChevronRight size={14} aria-hidden="true" />
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL DETALLE DE VALOR ANTERIOR VS VALOR NUEVO (ESTILO TRASLADOS CANILES EN LENGUAJE HUMANO) */}
      {detalleRegistro && (
        <Modal onClose={() => setDetalleRegistro(null)} nombre="Detalle del registro de auditoría" cerrarAlPulsarFondo={false}
          papel={{ style: {
            background: 'var(--portal-surface)', borderRadius: '18px', padding: '24px', width: '100%', maxWidth: '750px',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 40px rgba(20,24,32,0.25)'
          } }}>
            {/* Cabecera del modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#1f2430', fontSize: '1.2rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={20} color="var(--portal-primary)" aria-hidden="true" />
                  Detalle del Registro de Auditoría
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--portal-text-muted)', display: 'block', marginTop: '4px' }}>
                  {describirAccion(detalleRegistro)}
                </span>
              </div>
              <Button
                onClick={() => setDetalleRegistro(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--portal-text-muted)', padding: '4px' }}
                aria-label="Cerrar modal"
              >
                <X size={20} />
              </Button>
            </div>

            {/* Metadatos en formato tarjeta (similar a traslados caniles) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              background: 'var(--portal-surface-muted)',
              padding: '14px 16px',
              borderRadius: '12px',
              border: 'var(--portal-border-emphasis) solid var(--portal-border)',
              marginBottom: '20px'
            }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: 'var(--portal-text-muted)', textTransform: 'uppercase' }}>
                  Fecha y Hora
                </span>
                <div style={{ fontSize: '0.86rem', color: '#1f2430', marginTop: '2px', fontWeight: '600' }}>
                  {new Date(detalleRegistro.fechaHora).toLocaleString('es-CL')}
                </div>
              </div>

              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: 'var(--portal-text-muted)', textTransform: 'uppercase' }}>
                  Usuario Responsable
                </span>
                <div style={{ fontSize: '0.86rem', color: '#1f2430', marginTop: '2px', fontWeight: '600' }}>
                  {detalleRegistro.usuarioNombre || 'Sistema'}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--portal-text-muted)' }}>
                  {detalleRegistro.usuarioEmail || 'Automático'}
                </div>
              </div>

              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: 'var(--portal-text-muted)', textTransform: 'uppercase' }}>
                  Entidad
                </span>
                <div style={{ fontSize: '0.86rem', color: '#1f2430', marginTop: '2px', fontWeight: '600' }}>
                  {etiquetaEntidad(detalleRegistro.entidad)}
                </div>
              </div>

              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: 'var(--portal-text-muted)', textTransform: 'uppercase' }}>
                  Tipo de Acción
                </span>
                <div style={{ marginTop: '2px' }}>
                  {(() => {
                    const badge = accionColor[detalleRegistro.accion] || { bg: '#e9eaed', color: 'var(--portal-text-muted)', label: detalleRegistro.accion };
                    return (
                      <span style={{
                        fontSize: '0.72rem', fontWeight: '800', padding: '3px 8px', borderRadius: '6px',
                        background: badge.bg, color: badge.color, textTransform: 'uppercase'
                      }}>
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Comparativa estructurada en lenguaje humano */}
            <h4 style={{ fontSize: '0.94rem', fontWeight: '800', color: '#1f2430', margin: '0 0 12px' }}>
              Comparativa de Cambios y Valores
            </h4>

            {(() => {
              const campos = obtenerCamposRelevantes(detalleRegistro.valorAnterior, detalleRegistro.valorNuevo, detalleRegistro.entidad);

              if (campos.length === 0) {
                return (
                  <div style={{ padding: '24px', textAlign: 'center', background: 'var(--portal-surface-muted)', borderRadius: '10px', color: 'var(--portal-text-muted)', fontSize: '0.86rem' }}>
                    No hay campos comparables registrados para esta acción.
                  </div>
                );
              }

              return (
                <div style={{ border: 'var(--portal-border-emphasis) solid var(--portal-border)', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--portal-surface-muted)', borderBottom: 'var(--portal-border-emphasis) solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                        <th style={{ padding: '10px 14px', width: '28%', fontWeight: '800' }}>Campo / Atributo</th>
                        <th style={{ padding: '10px 14px', width: '36%', color: '#b91c1c', fontWeight: '800' }}>
                          <ArrowLeft size={13} style={{ verticalAlign: 'text-bottom', marginRight: '4px' }} />
                          Valor Anterior
                        </th>
                        <th style={{ padding: '10px 14px', width: '36%', color: 'var(--portal-primary-dark)', fontWeight: '800' }}>
                          <ArrowRight size={13} style={{ verticalAlign: 'text-bottom', marginRight: '4px' }} />
                          Valor Nuevo
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {campos.map((campo) => {
                        const valAnt = detalleRegistro.valorAnterior ? detalleRegistro.valorAnterior[campo] : null;
                        const valNue = detalleRegistro.valorNuevo ? detalleRegistro.valorNuevo[campo] : null;

                        const huboCambio = JSON.stringify(valAnt) !== JSON.stringify(valNue);

                        return (
                          <tr
                            key={campo}
                            style={{
                              borderBottom: 'var(--portal-border-emphasis) solid #f1f5f9',
                              background: huboCambio && detalleRegistro.accion === 'MODIFICACION' ? '#fffdf7' : 'transparent'
                            }}
                          >
                            <td style={{ padding: '10px 14px', fontWeight: '700', color: '#334155' }}>
                              {ETIQUETAS_CAMPOS[campo]}
                              {huboCambio && detalleRegistro.accion === 'MODIFICACION' && (
                                <span style={{ marginLeft: '6px', fontSize: '0.68rem', color: '#b45309', background: '#fef3c7', padding: '1px 5px', borderRadius: '4px' }}>
                                  Modificado
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#475569', background: valAnt !== null && valAnt !== undefined ? '#fef2f2' : 'transparent' }}>
                              {formatearValorLegible(campo === 'rol' ? detalleRegistro.rolEtiquetaAnterior || valAnt : valAnt)}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#1e293b', fontWeight: huboCambio ? '600' : 'normal', background: valNue !== null && valNue !== undefined ? 'var(--portal-surface-muted)' : 'transparent' }}>
                              {formatearValorLegible(campo === 'rol' ? detalleRegistro.rolEtiquetaNuevo || valNue : valNue)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Pie de modal */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px' }}>
              <Button
                type="button"
                onClick={() => setDetalleRegistro(null)}
                style={{
                  padding: '9px 20px',
                  background: 'var(--portal-primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Cerrar Detalle
              </Button>
            </div>
          </Modal>
      )}
    </div>
  );
}
