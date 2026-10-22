import React, { useState } from 'react';
import SolicitudesLista from './SolicitudesLista';
import SolicitudForm from './SolicitudForm';
import SolicitudDetalle from './SolicitudDetalle';
import './adopciones.css';

export default function AdopcionesModulo({ user }) {
  const [vista, setVista] = useState('lista');
  const [solicitudId, setSolicitudId] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);
  if (!['DIRECTORA', 'ENCARGADA_ADOPCIONES'].includes(user?.rol)) return null;

  const verDetalle = id => { setSolicitudId(id); setVista('detalle'); };
  return (
    <section className="adopciones" aria-labelledby="adopciones-title">
      <div className="adopciones-toolbar">
        <div className="adopciones-header"><h2 id="adopciones-title">Adopciones</h2><p className="adopciones-muted">Solicitudes y antecedentes de postulantes</p></div>
        <nav className="adopciones-toolbar" aria-label="Gestión de adopciones">
          <button onClick={() => { setVista('lista'); setConfirmacion(null); }}>Consultar solicitudes</button>
          <button className="primary" onClick={() => { setVista('crear'); setConfirmacion(null); }}>Nueva solicitud</button>
        </nav>
      </div>
      {confirmacion && <div role="status" className="adopciones-success">
        Solicitud #{confirmacion.solicitud.id} registrada correctamente.
        {confirmacion.alertas.map(alerta => <p key={alerta.codigo}>{alerta.mensaje}</p>)}
      </div>}
      {vista === 'lista' && <SolicitudesLista onVer={verDetalle} />}
      {vista === 'crear' && <SolicitudForm onSuccess={resultado => { setConfirmacion(resultado); verDetalle(resultado.solicitud.id); }} />}
      {vista === 'detalle' && <SolicitudDetalle key={solicitudId} id={solicitudId} />}
    </section>
  );
}
