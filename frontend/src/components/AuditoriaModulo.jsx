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
  ShieldCheck,
  Tag,
  Trash2,
  User,
  X
} from 'lucide-react';
import { API_URL, getAuthHeaders } from '../api/config';

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

  // Registro seleccionado para ver detalle
  const [detalleRegistro, setDetalleRegistro] = useState(null);
  const [tabAccion, setTabAccion] = useState('TODAS'); // 'TODAS' | 'CREACION' | 'MODIFICACION' | 'BAJA_LOGICA'

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchAuditorias(controller.signal);
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filtroUsuario, filtroEntidad, fechaDesde, fechaHasta]);

  const fetchAuditorias = async (signal) => {
    setCargando(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filtroUsuario) params.append('usuarioResponsable', filtroUsuario);
      if (filtroEntidad) params.append('entidad', filtroEntidad);
      if (fechaDesde) params.append('fechaDesde', fechaDesde);
      if (fechaHasta) params.append('fechaHasta', fechaHasta);

      const res = await fetch(`${API_URL}/auditoria?${params.toString()}`, {
        headers: getAuthHeaders(), signal
      });

      if (res.status === 403) {
        throw new Error('Acceso restringido: Módulo exclusivo para Dirección');
      }

      if (!res.ok) throw new Error('Error al consultar bitácora de auditoría');

      const data = await res.json();
      if (signal.aborted) return;
      setAuditorias(data.registros || []);
      setTotal(data.total || 0);
    } catch (err) {
      if (!signal.aborted) setError(formatearErrorApi(err));
    } finally {
      if (!signal.aborted) setCargando(false);
    }
  };

  const handleLimpiarFiltros = () => {
    setFiltroUsuario('');
    setFiltroEntidad('');
    setFechaDesde('');
    setFechaHasta('');
  };

  const accionColor = {
    CREACION: { bg: '#e8f0e8', color: '#2f5540', label: 'Creación' },
    MODIFICACION: { bg: '#edeffb', color: '#4550c0', label: 'Modificación' },
    BAJA_LOGICA: { bg: '#fbeae8', color: '#d1453b', label: 'Baja Lógica' }
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
  const obtenerCamposRelevantes = (anterior, nuevo) => {
    const claves = new Set([
      ...Object.keys(anterior || {}),
      ...Object.keys(nuevo || {})
    ]);

    return Array.from(claves).filter(c => Object.hasOwn(ETIQUETAS_CAMPOS, c));
  };

  return (
    <div className="portal-page-container">
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
            background: 'var(--portal-surface)', border: '1px solid var(--portal-border)', borderRadius: 'var(--portal-radius-sm)', padding: '6px 14px',
            fontSize: '0.78rem', color: 'var(--portal-text-muted)', display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <Lock size={14} aria-hidden="true" /> Solo lectura (Inmutable)
          </div>
        </div>
      </div>

      {/* Subnavegación de Auditoría — Estilo portal-subtabs */}
      <div className="portal-subtabs">
        <button
          onClick={() => setTabAccion('TODAS')}
          className={`portal-subtab-btn ${tabAccion === 'TODAS' ? 'active' : ''}`}
        >
          <ClipboardList size={15} aria-hidden="true" /> Toda la Bitácora ({auditorias.length})
        </button>
        <button
          onClick={() => setTabAccion('CREACION')}
          className={`portal-subtab-btn ${tabAccion === 'CREACION' ? 'active' : ''}`}
        >
          <Plus size={15} aria-hidden="true" /> Creaciones ({auditorias.filter(a => a.accion === 'CREACION').length})
        </button>
        <button
          onClick={() => setTabAccion('MODIFICACION')}
          className={`portal-subtab-btn ${tabAccion === 'MODIFICACION' ? 'active' : ''}`}
        >
          <Pencil size={15} aria-hidden="true" /> Modificaciones ({auditorias.filter(a => a.accion === 'MODIFICACION').length})
        </button>
        <button
          onClick={() => setTabAccion('BAJA_LOGICA')}
          className={`portal-subtab-btn ${tabAccion === 'BAJA_LOGICA' ? 'active' : ''}`}
        >
          <Trash2 size={15} aria-hidden="true" /> Bajas Lógicas ({auditorias.filter(a => a.accion === 'BAJA_LOGICA').length})
        </button>
      </div>

      {error && (
        <div style={{ background: '#fbeae8', border: '1px solid #f3c9c4', color: '#d1453b', padding: '14px', borderRadius: '10px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* BARRA DE FILTROS */}
      <div style={{
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
            <option value="Usuario">Usuarios / Perfiles</option>
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
            type="button"
            onClick={handleLimpiarFiltros}
            style={{ padding: '9px 12px', background: '#f8f9fa', color: '#7c8592', border: '1.5px solid #e9eaed', borderRadius: '7px', fontWeight: '700', fontSize: '0.84rem', cursor: 'pointer' }}
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* TABLA DE AUDITORÍA CON CLIC EN FILA */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e9eaed', overflow: 'hidden', boxShadow: '0 1px 3px rgba(20,24,32,0.03)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f1f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: '700', color: '#1f2430' }}>
            Total de registros: {total} {auditoriasFiltradas.length !== auditorias.length && `(mostrando ${auditoriasFiltradas.length})`}
          </span>
          <span style={{ fontSize: '0.78rem', color: '#7c8592', fontStyle: 'italic' }}>
            Haz clic en cualquier fila para ver el detalle comparativo y trazabilidad
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
                <th style={{ padding: '12px 16px' }}>Descripción de la Acción</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#7c8592' }}>
                    Cargando bitácora de auditoría...
                  </td>
                </tr>
              ) : auditoriasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#a3aab5' }}>
                    No se encontraron registros que coincidan con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                auditoriasFiltradas.map(item => {
                  const badge = accionColor[item.accion] || { bg: '#e9eaed', color: '#7c8592', label: item.accion };
                  const fechaObj = new Date(item.fechaHora);

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setDetalleRegistro(item)}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f8faf8'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      style={{ borderBottom: '1px solid #f0f1f3', cursor: 'pointer', transition: 'background 0.15s ease' }}
                    >
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <strong>{fechaObj.toLocaleDateString('es-CL')}</strong>{' '}
                        <span style={{ color: '#7c8592' }}>{fechaObj.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <strong>{item.usuarioNombre || 'Sistema'}</strong>
                        <div style={{ fontSize: '0.74rem', color: '#7c8592' }}>{item.usuarioEmail || 'Automático'}</div>
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
                          color: '#3f6c52',
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

      {/* MODAL DETALLE DE VALOR ANTERIOR VS VALOR NUEVO (ESTILO TRASLADOS CANILES EN LENGUAJE HUMANO) */}
      {detalleRegistro && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(20,24,32,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '16px'
        }}>
          <div style={{
            background: '#fff', borderRadius: '18px', padding: '24px', width: '100%', maxWidth: '750px',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 40px rgba(20,24,32,0.25)'
          }}>
            {/* Cabecera del modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#1f2430', fontSize: '1.2rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={20} color="#3f6c52" aria-hidden="true" />
                  Detalle del Registro de Auditoría
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#7c8592', display: 'block', marginTop: '4px' }}>
                  {describirAccion(detalleRegistro)}
                </span>
              </div>
              <button
                onClick={() => setDetalleRegistro(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#7c8592', padding: '4px' }}
                aria-label="Cerrar modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Metadatos en formato tarjeta (similar a traslados caniles) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              background: '#f8fafc',
              padding: '14px 16px',
              borderRadius: '12px',
              border: '1px solid #e9eaed',
              marginBottom: '20px'
            }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: '#7c8592', textTransform: 'uppercase' }}>
                  Fecha y Hora
                </span>
                <div style={{ fontSize: '0.86rem', color: '#1f2430', marginTop: '2px', fontWeight: '600' }}>
                  {new Date(detalleRegistro.fechaHora).toLocaleString('es-CL')}
                </div>
              </div>

              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: '#7c8592', textTransform: 'uppercase' }}>
                  Usuario Responsable
                </span>
                <div style={{ fontSize: '0.86rem', color: '#1f2430', marginTop: '2px', fontWeight: '600' }}>
                  {detalleRegistro.usuarioNombre || 'Sistema'}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#7c8592' }}>
                  {detalleRegistro.usuarioEmail || 'Automático'}
                </div>
              </div>

              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: '#7c8592', textTransform: 'uppercase' }}>
                  Entidad
                </span>
                <div style={{ fontSize: '0.86rem', color: '#1f2430', marginTop: '2px', fontWeight: '600' }}>
                  {etiquetaEntidad(detalleRegistro.entidad)}
                </div>
              </div>

              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: '#7c8592', textTransform: 'uppercase' }}>
                  Tipo de Acción
                </span>
                <div style={{ marginTop: '2px' }}>
                  {(() => {
                    const badge = accionColor[detalleRegistro.accion] || { bg: '#e9eaed', color: '#7c8592', label: detalleRegistro.accion };
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
              const campos = obtenerCamposRelevantes(detalleRegistro.valorAnterior, detalleRegistro.valorNuevo);

              if (campos.length === 0) {
                return (
                  <div style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', color: '#7c8592', fontSize: '0.86rem' }}>
                    No hay campos comparables registrados para esta acción.
                  </div>
                );
              }

              return (
                <div style={{ border: '1px solid #e9eaed', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                        <th style={{ padding: '10px 14px', width: '28%', fontWeight: '800' }}>Campo / Atributo</th>
                        <th style={{ padding: '10px 14px', width: '36%', color: '#b91c1c', fontWeight: '800' }}>
                          <ArrowLeft size={13} style={{ verticalAlign: 'text-bottom', marginRight: '4px' }} />
                          Valor Anterior
                        </th>
                        <th style={{ padding: '10px 14px', width: '36%', color: '#2f5540', fontWeight: '800' }}>
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
                              borderBottom: '1px solid #f1f5f9',
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
                            <td style={{ padding: '10px 14px', color: '#1e293b', fontWeight: huboCambio ? '600' : 'normal', background: valNue !== null && valNue !== undefined ? '#f0fdf4' : 'transparent' }}>
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
              <button
                type="button"
                onClick={() => setDetalleRegistro(null)}
                style={{
                  padding: '9px 20px',
                  background: '#3f6c52',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
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
