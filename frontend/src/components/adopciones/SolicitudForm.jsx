import React, { useEffect, useRef, useState } from 'react';
import { crearSolicitud, editarSolicitud, obtenerAntecedentes, listarAnimalesDisponibles } from '../../api/adopciones';

const formatearIdentificacion = (valor, tipo) => {
  const limpio = valor.trim().toUpperCase();
  if (tipo !== 'RUT') return limpio.replace(/\s+/g, '');
  const rut = limpio.replace(/[.\s-]/g, '');
  if (!/^[1-9]\d{6,7}[0-9K]$/.test(rut)) return limpio;
  return `${rut.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${rut.slice(-1)}`;
};

const inicial = { tipoIdentificacion: 'RUT', identificacion: '', nombre: '', email: '', telefono: '', direccion: '' };

export default function SolicitudForm({ onSuccess, solicitud, onCancel }) {
  const [postulante, setPostulante] = useState(solicitud?.datosPostulante || inicial);
  const [animalId, setAnimalId] = useState(solicitud ? String(solicitud.animalId) : '');
  const [motivacion, setMotivacion] = useState(solicitud?.motivacion || '');
  const [animales, setAnimales] = useState([]);
  const [cargandoAnimales, setCargandoAnimales] = useState(true);
  const [errorAnimales, setErrorAnimales] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [antecedentes, setAntecedentes] = useState(solicitud ? { solicitudesActivas: [], devolucionesPrevias: [], alertas: [] } : null);
  const [consultando, setConsultando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [alertas, setAlertas] = useState([]);
  const consultaRef = useRef(null);
  const envioRef = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; consultaRef.current?.abort(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setCargandoAnimales(true); setErrorAnimales('');
    listarAnimalesDisponibles(controller.signal).then(setAnimales)
      .catch(err => { if (!controller.signal.aborted) setErrorAnimales(err.message); })
      .finally(() => { if (!controller.signal.aborted) setCargandoAnimales(false); });
    return () => controller.abort();
  }, [recarga]);

  const cambiarIdentidad = (campo, valor) => {
    consultaRef.current?.abort();
    setPostulante(prev => ({ ...prev, [campo]: valor }));
    setAntecedentes(null); setAlertas([]); setError(''); setConsultando(false);
  };
  const consultar = async () => {
    consultaRef.current?.abort();
    const controller = new AbortController();
    consultaRef.current = controller;
    setConsultando(true); setError(''); setAntecedentes(null); setAlertas([]);
    try {
      const result = await obtenerAntecedentes(postulante.tipoIdentificacion, postulante.identificacion, controller.signal);
      if (controller.signal.aborted) return;
      setAntecedentes(result); setAlertas(result.alertas);
      if (result.postulante) {
        const { nombre, email, telefono, direccion } = result.postulante;
        setPostulante(prev => ({ ...prev, nombre, email, telefono, direccion }));
      }
    } catch (err) {
      if (!controller.signal.aborted) setError([err.message, ...(err.detalles || []).map(d => d.mensaje)].join('. '));
    } finally {
      if (!controller.signal.aborted) setConsultando(false);
    }
  };

  const limpiarCampo = campo => setPostulante(prev => ({ ...prev, [campo]: campo === 'email' ? prev[campo].trim().toLowerCase() : prev[campo].trim() }));

  const guardar = async event => {
    event.preventDefault();
    if (envioRef.current || !antecedentes || antecedentes.solicitudesActivas.length || antecedentes.postulante?.activo === false || cargandoAnimales || errorAnimales) return;
    envioRef.current = true; setGuardando(true); setError('');
    try {
      const payload = { postulante, animalId: Number(animalId), motivacion };
      const resultado = solicitud ? await editarSolicitud(solicitud.id, { ...payload, actualizadoEn: solicitud.actualizadoEn }) : await crearSolicitud(payload);
      if (mounted.current) onSuccess(resultado);
    } catch (err) {
      if (mounted.current) {
        setError([err.message, ...(err.detalles || []).map(d => `${d.campo}: ${d.mensaje}`)].join('. '));
        setAlertas(err.alertas || []);
        // Solo exigir otra consulta cuando cambian los antecedentes o hay un conflicto.
        if (err.status === 409) setAntecedentes(null);
      }
    } finally {
      envioRef.current = false;
      if (mounted.current) setGuardando(false);
    }
  };

  return <form className="adopciones-card" onSubmit={guardar}>
    <h3>{solicitud ? `Editar solicitud #${solicitud.id}` : 'Nueva solicitud de adopción'}</h3>
    <p>{solicitud ? 'Corrige los datos de contacto, el animal o la motivación.' : 'Consulta la identificación para revisar solicitudes activas y devoluciones anteriores.'}</p>
    {error && <p role="alert" className="adopciones-error">{error}</p>}
    <fieldset disabled={guardando}>
      <legend>Identificación del postulante</legend>
      <div className="adopciones-grid">
        <label>Tipo de identificación<select disabled={!!solicitud} value={postulante.tipoIdentificacion} onChange={e => cambiarIdentidad('tipoIdentificacion', e.target.value)}>
          <option value="RUT">RUT chileno</option><option value="OTRO">Otro documento</option>
        </select></label>
        <label>Identificación<input disabled={!!solicitud} required maxLength={60} value={postulante.identificacion} onChange={e => cambiarIdentidad('identificacion', e.target.value)} onBlur={() => setPostulante(prev => ({ ...prev, identificacion: formatearIdentificacion(prev.identificacion, prev.tipoIdentificacion) }))} placeholder={postulante.tipoIdentificacion === 'RUT' ? 'Ej.: 12.345.678-5' : 'Ej.: AB123456'} /></label>
      </div>
      <button hidden={!!solicitud} type="button" onClick={consultar} disabled={consultando || !postulante.identificacion.trim()}>{consultando ? 'Consultando…' : 'Consultar antecedentes'}</button>
      <div aria-live="polite">
        {alertas.map(alerta => <p className="adopciones-alert" key={alerta.codigo}>{alerta.mensaje}</p>)}
        {!solicitud && antecedentes && !alertas.length && <p>Sin solicitudes activas ni devoluciones previas.</p>}
        {antecedentes?.solicitudesActivas.map(s => <p key={s.id}>Solicitud activa #{s.id}: {s.animal.nombre}.</p>)}
        {antecedentes?.devolucionesPrevias.map(d => <p key={d.id}>Devolución del {d.fecha ? new Date(d.fecha).toLocaleDateString('es-CL') : 'fecha no registrada'}: {d.motivo}</p>)}
      </div>
      <div className="adopciones-grid" style={{ marginTop: 16 }}>
        <label>Nombre completo<input required minLength={2} maxLength={100} autoComplete="name" value={postulante.nombre} placeholder="Ana Pérez González" onBlur={() => limpiarCampo('nombre')} onChange={e => setPostulante({ ...postulante, nombre: e.target.value })} /></label>
        <label>Correo electrónico<input required type="email" maxLength={120} autoComplete="email" value={postulante.email} placeholder="ana@ejemplo.cl" onBlur={() => limpiarCampo('email')} onChange={e => setPostulante({ ...postulante, email: e.target.value })} /></label>
        <label>Teléfono<input required type="tel" minLength={7} maxLength={30} autoComplete="tel" value={postulante.telefono} placeholder="+56 9 1234 5678" onBlur={() => limpiarCampo('telefono')} onChange={e => setPostulante({ ...postulante, telefono: e.target.value })} /></label>
        <label>Dirección del hogar<input required minLength={5} maxLength={200} autoComplete="street-address" value={postulante.direccion} placeholder="Los Aromos 123, depto. 4, Santiago" onBlur={() => limpiarCampo('direccion')} onChange={e => setPostulante({ ...postulante, direccion: e.target.value })} /></label>
      </div>
      {errorAnimales && <div className="adopciones-error" role="alert">{errorAnimales} <button type="button" onClick={() => setRecarga(k => k + 1)}>Reintentar carga de animales</button></div>}
      <label>Animal<select required disabled={cargandoAnimales || !!errorAnimales} value={animalId} onChange={e => setAnimalId(e.target.value)}>
        <option value="">{cargandoAnimales ? 'Cargando animales…' : 'Selecciona un animal'}</option>
        {animales.map(animal => <option key={animal.id} value={animal.id}>{animal.nombre} · {animal.especie} · #{animal.id}</option>)}
      </select></label>
      {!cargandoAnimales && !errorAnimales && animales.length === 0 && <p>No hay animales disponibles para solicitar adopción.</p>}
      <label>Motivación y condiciones del hogar<textarea required minLength={10} maxLength={4000} value={motivacion} aria-describedby="ayuda-motivacion" onBlur={() => setMotivacion(v => v.trim())} onChange={e => setMotivacion(e.target.value)} /><small id="ayuda-motivacion">Mínimo 10 caracteres y máximo 4000 caracteres.</small></label>
      {!antecedentes && <p className="adopciones-muted">Consulta los antecedentes antes de registrar.</p>}
      <button className="primary" type="submit" disabled={!antecedentes || antecedentes.solicitudesActivas.length > 0 || antecedentes.postulante?.activo === false || consultando || cargandoAnimales || !!errorAnimales || !animalId}>
        {guardando ? 'Guardando…' : solicitud ? 'Guardar cambios' : 'Registrar solicitud'}
      </button>
      {onCancel && <button type="button" onClick={onCancel} disabled={guardando}>Cancelar edición</button>}
    </fieldset>
  </form>;
}
