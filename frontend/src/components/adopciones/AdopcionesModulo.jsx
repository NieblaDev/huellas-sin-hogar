import React, { useState } from 'react';
import { ClipboardList, FilePenLine, FileText, House, PhoneCall, Plus } from 'lucide-react';
import SolicitudesLista from './SolicitudesLista';
import SolicitudForm from './SolicitudForm';
import SolicitudDetalle from './SolicitudDetalle';
import SeguimientosLista from './SeguimientosLista';
import './adopciones.css';

export default function AdopcionesModulo({ user }) {
  const [vista, setVista] = useState('lista');
  const [solicitudId, setSolicitudId] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);
  if (!['DIRECTORA', 'ENCARGADA_ADOPCIONES'].includes(user?.rol)) return null;

  const verDetalle = id => { setSolicitudId(id); setVista('detalle'); };
  return (
    <section className="adopciones" aria-labelledby="adopciones-title">
      <div className="portal-header">
        <div>
          <h2 id="adopciones-title" className="portal-header-title">
            <House size={24} aria-hidden="true" />
            <span>Gestión de Adopciones</span>
          </h2>
          <p className="portal-header-subtitle">
            Solicitudes de adopción, evaluación de adoptantes, seguimientos post-adopción y devoluciones
          </p>
        </div>
        <div className="portal-header-actions">
          <button
            onClick={() => { setVista('crear'); setConfirmacion(null); }}
            className="portal-btn portal-btn-primary"
          >
            <Plus size={16} aria-hidden="true" /> Nueva Solicitud
          </button>
        </div>
      </div>

      {/* Subnavegación del Módulo de Adopciones */}
      <div className="portal-subtabs" role="tablist" aria-label="Gestión de adopciones">
        <button
          className={`portal-subtab-btn ${vista === 'lista' ? 'active' : ''}`}
          onClick={() => { setVista('lista'); setConfirmacion(null); }}
        >
          <ClipboardList size={15} aria-hidden="true" /> Consultar Solicitudes
        </button>
        <button
          className={`portal-subtab-btn ${vista === 'seguimientos' ? 'active' : ''}`}
          onClick={() => { setVista('seguimientos'); setConfirmacion(null); }}
        >
          <PhoneCall size={15} aria-hidden="true" /> Seguimientos Post-Adopción
        </button>
        <button
          className={`portal-subtab-btn ${vista === 'crear' ? 'active' : ''}`}
          onClick={() => { setVista('crear'); setConfirmacion(null); }}
        >
          <FilePenLine size={15} aria-hidden="true" /> Formulario de Solicitud
        </button>
        {vista === 'detalle' && (
          <button
            className="portal-subtab-btn active"
            onClick={() => setVista('detalle')}
          >
            <FileText size={15} aria-hidden="true" /> Expediente #{solicitudId}
          </button>
        )}
      </div>

      {confirmacion && <div role="status" className="adopciones-success" style={{ marginBottom: '20px' }}>
        Solicitud #{confirmacion.solicitud.id} registrada correctamente.
        {confirmacion.alertas.map(alerta => <p key={alerta.codigo}>{alerta.mensaje}</p>)}
      </div>}
      {vista === 'lista' && <SolicitudesLista onVer={verDetalle} />}
      {vista === 'seguimientos' && <SeguimientosLista user={user} />}
      {vista === 'crear' && <SolicitudForm onSuccess={resultado => { setConfirmacion(resultado); verDetalle(resultado.solicitud.id); }} />}
      {vista === 'detalle' && <SolicitudDetalle key={solicitudId} id={solicitudId} />}
    </section>
  );
}
