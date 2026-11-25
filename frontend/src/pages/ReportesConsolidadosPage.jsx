import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Input from '../components/ui/Input.jsx';
import useFormulario from '../hooks/useFormulario.js';
import { reporteSchema } from '../schemas/reporte.schema.js';
import React, { useState } from 'react';
import {
  Ban,
  BarChart3,
  Calendar,
  CircleCheck,
  Download,
  FileSpreadsheet,
  FileText,
  Lock,
  RotateCcw
} from 'lucide-react';
import { exportarConsolidado } from '../services/animal.service.js';
import { formatearErrorApi } from '../utils/errores';

const CONFIG_INICIAL = {
  fechaDesde: '',
  fechaHasta: '',
  tipoInformacion: 'TODOS',
  especie: '',
  estadoSalud: '',
  tipoIngreso: '',
  formato: 'CSV'
};

export default function ReportesConsolidadosPage({ user }) {
  const reporteForm = useFormulario(reporteSchema, CONFIG_INICIAL);
  const configReporte = reporteForm.valores;
  const setConfigReporte = actualizar => reporteForm.reset(actualizar);
  const descargandoConsolidado = reporteForm.isSubmitting;
  const [exito, setExito] = useState('');
  const [error, setError] = useState('');

  const esDireccion = user?.rol === 'DIRECCION';

  const handleExportConsolidado = async (configReporte) => {
    setError('');
    setExito('');

    if (!esDireccion) {
      setError('Acceso exclusivo: Solo la Dirección del refugio cuenta con permisos para exportar reportes consolidados.');
      return;
    }

    if (configReporte.fechaDesde && configReporte.fechaHasta && configReporte.fechaDesde > configReporte.fechaHasta) {
      setError('La fecha de inicio no puede ser posterior a la fecha de término.');
      return;
    }

    try {
      const params = new URLSearchParams();
      if (configReporte.fechaDesde) params.append('fechaDesde', configReporte.fechaDesde);
      if (configReporte.fechaHasta) params.append('fechaHasta', configReporte.fechaHasta);
      if (configReporte.tipoInformacion) params.append('tipoInformacion', configReporte.tipoInformacion);
      if (configReporte.especie) params.append('especie', configReporte.especie);
      if (configReporte.estadoSalud) params.append('estadoSalud', configReporte.estadoSalud);
      if (configReporte.tipoIngreso) params.append('tipoIngreso', configReporte.tipoIngreso);
      if (configReporte.formato) params.append('formato', configReporte.formato);

      const res = await exportarConsolidado(params);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(formatearErrorApi(errData, 'No pudimos generar el reporte. Inténtalo nuevamente en unos minutos.'));
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
        : `Tu reporte consolidado (${configReporte.formato}) se descargó correctamente.`;
      setExito(msgNotif);
      window.dispatchEvent(
        new CustomEvent('refugio:notificacion', {
          detail: {
            titulo: `Reporte consolidado (${configReporte.formato}) descargado`,
            mensaje: msgNotif
          }
        })
      );
    } catch (err) {
      setError(formatearErrorApi(err, 'No pudimos generar el reporte. Inténtalo nuevamente.'));
    }
  };

  if (!esDireccion) {
    return (
      <div className="portal-page-container">
        <div className="portal-header">
          <div>
            <h2 className="portal-header-title">
              <BarChart3 size={26} aria-hidden="true" />
              <span>Reportes Consolidados</span>
            </h2>
            <p className="portal-header-subtitle">
              Exportación general de gestión operativa en formatos PDF y CSV.
            </p>
          </div>
        </div>

        <Card component="section" className="portal-card" style={{ padding: '28px' }}>
          <div className="portal-alert portal-alert-warning" role="alert" style={{ marginBottom: 0 }}>
            <Lock size={18} aria-hidden="true" />
            <span>
              Acceso exclusivo: Solo la Dirección del refugio cuenta con permisos para generar y exportar reportes consolidados.
            </span>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="portal-page-container">
      <div className="portal-header">
        <div>
          <h2 className="portal-header-title">
            <BarChart3 size={26} aria-hidden="true" />
            <span>Reportes Consolidados</span>
          </h2>
          <p className="portal-header-subtitle">
            Genera y exporta balances consolidados de ingresos, adopciones, devoluciones, censo y estado de insumos en PDF o CSV.
          </p>
        </div>

      </div>

      {exito && (
        <div className="portal-alert portal-alert-success" role="status">
          <CircleCheck size={18} aria-hidden="true" />
          <span style={{ flex: 1 }}>{exito}</span>
          <Button
            type="button"
            onClick={() => setExito('')}
            aria-label="Cerrar aviso"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700, minHeight: 'auto' }}
          >
            ✕
          </Button>
        </div>
      )}

      {error && (
        <div className="portal-alert portal-alert-danger" role="alert">
          <Ban size={18} aria-hidden="true" />
          <span style={{ flex: 1 }}>{error}</span>
          <Button
            type="button"
            onClick={() => setError('')}
            aria-label="Cerrar error"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700, minHeight: 'auto' }}
          >
            ✕
          </Button>
        </div>
      )}

      <Card component="section" className="portal-card" style={{ padding: '26px 28px' }}>
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
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--portal-text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={19} color="var(--portal-primary)" aria-hidden="true" />
              <span>Configuración del reporte de gestión</span>
            </h3>
            <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'var(--portal-text-muted)' }}>
              Selecciona el rango de fechas, la dimensión operativa, los filtros complementarios y el formato de descarga.
            </p>
          </div>
        </div>

        <form noValidate onSubmit={reporteForm.handleSubmit(handleExportConsolidado)}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              marginBottom: '22px'
            }}
          >
            <div>
              <label
                htmlFor="reporte-fecha-desde"
                style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: 'var(--portal-text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}
              >
                Fecha Desde
              </label>
              <Input {...reporteForm.campo("fechaDesde", "reporte-fecha-desde")}
                
                type="date"
                value={configReporte.fechaDesde}
                onChange={(e) => reporteForm.cambiar('fechaDesde', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid var(--portal-border)', fontSize: '0.86rem', background: 'var(--portal-surface)' }}
              />
            </div>

            <div>
              <label
                htmlFor="reporte-fecha-hasta"
                style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: 'var(--portal-text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}
              >
                Fecha Hasta
              </label>
              <Input {...reporteForm.campo("fechaHasta", "reporte-fecha-hasta")}
                
                type="date"
                value={configReporte.fechaHasta}
                onChange={(e) => reporteForm.cambiar('fechaHasta', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid var(--portal-border)', fontSize: '0.86rem', background: 'var(--portal-surface)' }}
              />
            </div>

            <div>
              <label
                htmlFor="reporte-tipo-info"
                style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: 'var(--portal-text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}
              >
                Tipo de Información
              </label>
              <Input as="select" {...reporteForm.campo("tipoInformacion", "reporte-tipo-info")}
                
                value={configReporte.tipoInformacion}
                onChange={(e) => reporteForm.cambiar('tipoInformacion', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid var(--portal-border)', background: 'var(--portal-surface)', fontSize: '0.86rem' }}
              >
                <option value="TODOS">Consolidado Completo (Todos)</option>
                <option value="INGRESOS">Balance de Ingresos</option>
                <option value="ADOPCIONES">Balance de Adopciones</option>
                <option value="DEVOLUCIONES">Balance de Devoluciones</option>
                <option value="CENSO">Censo y Capacidad</option>
                <option value="INSUMOS">Estado de Insumos</option>
              </Input>
            </div>

            <div>
              <label
                htmlFor="reporte-especie"
                style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: 'var(--portal-text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}
              >
                Filtro Especie
              </label>
              <Input as="select" {...reporteForm.campo("especie", "reporte-especie")}
                
                value={configReporte.especie}
                onChange={(e) => reporteForm.cambiar('especie', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid var(--portal-border)', background: 'var(--portal-surface)', fontSize: '0.86rem' }}
              >
                <option value="">Todas las especies</option>
                <option value="Perro">Perro (Canina)</option>
                <option value="Gato">Gato (Felina)</option>
              </Input>
            </div>

            <div>
              <label
                htmlFor="reporte-estado-salud"
                style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: 'var(--portal-text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}
              >
                Filtro Estado de Salud
              </label>
              <Input as="select" {...reporteForm.campo("estadoSalud", "reporte-estado-salud")}
                
                value={configReporte.estadoSalud}
                onChange={(e) => reporteForm.cambiar('estadoSalud', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid var(--portal-border)', background: 'var(--portal-surface)', fontSize: '0.86rem' }}
              >
                <option value="">Todos los estados</option>
                <option value="NORMAL">Normal</option>
                <option value="CONDICION_ESPECIAL">Condición especial</option>
                <option value="CRITICO">Crítico</option>
              </Input>
            </div>

            <div>
              <label
                htmlFor="reporte-causal"
                style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: 'var(--portal-text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}
              >
                Filtro Causal Ingreso
              </label>
              <Input as="select" {...reporteForm.campo("tipoIngreso", "reporte-causal")}
                
                value={configReporte.tipoIngreso}
                onChange={(e) => reporteForm.cambiar('tipoIngreso', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid var(--portal-border)', background: 'var(--portal-surface)', fontSize: '0.86rem' }}
              >
                <option value="">Todas las causales</option>
                <option value="Rescate">Rescate</option>
                <option value="Abandono">Abandono</option>
                <option value="Decomiso">Decomiso</option>
              </Input>
            </div>

            <div>
              <label
                htmlFor="reporte-formato"
                style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: 'var(--portal-text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}
              >
                Formato de Exportación
              </label>
              <Input as="select" {...reporteForm.campo("formato", "reporte-formato")}
                
                value={configReporte.formato}
                onChange={(e) => reporteForm.cambiar('formato', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid var(--portal-border)', background: 'var(--portal-surface)', fontWeight: '700', fontSize: '0.86rem' }}
              >
                <option value="CSV">Planilla CSV (Datos / Excel)</option>
                <option value="PDF">Documento Oficial PDF</option>
              </Input>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              borderTop: 'var(--portal-border-emphasis) solid var(--portal-border-subtle)',
              paddingTop: '18px'
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--portal-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {configReporte.formato === 'PDF' ? (
                <FileText size={15} aria-hidden="true" />
              ) : (
                <FileSpreadsheet size={15} aria-hidden="true" />
              )}
              Cada exportación queda registrada automáticamente en la bitácora de auditoría.
            </span>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Button
                type="button"
                onClick={() => {
                  setConfigReporte(CONFIG_INICIAL);
                  setError('');
                  setExito('');
                }}
                className="portal-btn portal-btn-secondary"
              >
                <RotateCcw size={15} aria-hidden="true" /> Restablecer Filtros
              </Button>

              <Button cargando={reporteForm.isSubmitting}
                type="submit"
                disabled={descargandoConsolidado}
                className="portal-btn portal-btn-primary"
              >
                {descargandoConsolidado ? (
                  'Generando reporte...'
                ) : (
                  <>
                    <Download size={16} aria-hidden="true" /> Generar y Descargar Reporte ({configReporte.formato})
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
