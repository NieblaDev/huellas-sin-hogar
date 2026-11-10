import React, { useState, useEffect } from 'react';
import { API_URL, getAuthHeaders } from '../api/config';

export default function CanilesModulo({ user }) {
  const [caniles, setCaniles] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [animales, setAnimales] = useState([]);
  const [traslados, setTraslados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState('mapa'); // 'mapa' | 'traslados' | 'solicitar'

  // Formulario Agregar Canil
  const [agregarCanilOpen, setAgregarCanilOpen] = useState(false);
  const [nuevoCanil, setNuevoCanil] = useState({ sector: '' });
  const [sectorMode, setSectorMode] = useState('select'); // 'select' | 'nuevo'
  const [errorNuevoCanil, setErrorNuevoCanil] = useState(null);
  const [creandoCanil, setCreandoCanil] = useState(false);

  // Confirmación Eliminar Canil
  const [eliminarCanil, setEliminarCanil] = useState(null);
  const [eliminarConfirmOpen, setEliminarConfirmOpen] = useState(false);
  const [eliminandoCanil, setEliminandoCanil] = useState(false);

  // Modal de Gestión de Canil
  const [modalCanilOpen, setModalCanilOpen] = useState(false);
  const [selectedCanil, setSelectedCanil] = useState(null);
  const [modalModo, setModalModo] = useState('asignar'); // 'asignar' | 'transferir' | 'cuarentena'
  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [canilDestinoId, setCanilDestinoId] = useState('');
  const [motivoMovimiento, setMotivoMovimiento] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState(null);
  const [mensajeExito, setMensajeExito] = useState(null);

  // Formulario Solicitud de Traslado Externo (Protectora o Hogar Temporal)
  const [trasladoExterno, setTrasladoExterno] = useState({
    animalId: '',
    tipo: 'PROTECTORA_ALIADA',
    destinoNombre: '',
    destinoContacto: '',
    destinoDireccion: '',
    motivo: ''
  });
  const [errorExterno, setErrorExterno] = useState(null);

  // Sectores ya registrados (se derivan de los caniles existentes, por lo que
  // quedan guardados en la base de datos al crear cada canil).
  const sectoresExistentes = React.useMemo(
    () => [...new Set(caniles.map(c => c.sector).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [caniles]
  );

  // Próximo número de canil a partir del mayor "Canil N" existente.
  const getProximoNumeroCanil = () => {
    const numeros = caniles
      .map(c => {
        const match = String(c.nombre || '').match(/(\d+)\s*$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);
    return (numeros.length ? Math.max(...numeros) : caniles.length) + 1;
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [resCaniles, resAnimals, resTraslados] = await Promise.all([
        fetch(`${API_URL}/caniles`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/animals`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/caniles/traslados`, { headers: getAuthHeaders() })
      ]);

      if (resCaniles.ok) {
        const dataCaniles = await resCaniles.json();
        setCaniles(dataCaniles.caniles || []);
        setResumen(dataCaniles.resumen || null);
      }
      if (resAnimals.ok) {
        const dataAnimals = await resAnimals.json();
        setAnimales(dataAnimals || []);
      }
      if (resTraslados.ok) {
        const dataT = await resTraslados.json();
        setTraslados(dataT || []);
      }
    } catch (err) {
      console.error('Error al cargar datos de caniles:', err);
    } finally {
      setCargando(false);
    }
  };

  const handleOpenModal = (canil) => {
    setSelectedCanil(canil);
    setModalModo('asignar');
    setSelectedAnimalId(canil.animalAlojado ? canil.animalAlojado.id.toString() : '');
    setCanilDestinoId('');
    setMotivoMovimiento('');
    setErrorModal(null);
    setModalCanilOpen(true);
  };

  const handleGuardarAsignacion = async (e) => {
    e.preventDefault();
    setErrorModal(null);

    setGuardando(true);
    try {
      const body = {
        canilId: selectedCanil.id,
        animalId: selectedAnimalId ? parseInt(selectedAnimalId) : null,
        motivo: motivoMovimiento.trim() || null,
        estado: selectedAnimalId ? 'OCUPADO' : 'LIBRE'
      };

      const res = await fetch(`${API_URL}/caniles/asignar`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar asignación');

      setMensajeExito(data.mensaje);
      setTimeout(() => setMensajeExito(null), 4000);
      setModalCanilOpen(false);
      await cargarDatos();
    } catch (err) {
      setErrorModal(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleTransferirCanil = async (e) => {
    e.preventDefault();
    setErrorModal(null);

    const animal = selectedCanil.animalAlojado;
    if (!animal) {
      setErrorModal('Este canil no tiene un animal para transferir');
      return;
    }
    if (!canilDestinoId) {
      setErrorModal('Selecciona el canil de destino');
      return;
    }

    setGuardando(true);
    try {
      const res = await fetch(`${API_URL}/caniles/asignar`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          canilId: parseInt(canilDestinoId),
          animalId: animal.id,
          motivo: motivoMovimiento.trim() || `Transferencia desde ${selectedCanil.nombre}`,
          estado: 'OCUPADO'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al transferir el animal');

      setMensajeExito(data.mensaje || 'Animal transferido correctamente');
      setTimeout(() => setMensajeExito(null), 4000);
      setModalCanilOpen(false);
      await cargarDatos();
    } catch (err) {
      setErrorModal(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleCambiarCuarentena = async (e) => {
    e.preventDefault();
    setErrorModal(null);

    const animal = selectedCanil.animalAlojado;
    if (!animal) {
      setErrorModal('Solo se puede poner en cuarentena un canil con un animal alojado');
      return;
    }

    const nuevoEstado = selectedCanil.estado === 'CUARENTENA' ? 'OCUPADO' : 'CUARENTENA';
    if (nuevoEstado === 'CUARENTENA' && !motivoMovimiento.trim()) {
      setErrorModal('El motivo es obligatorio para poner el canil en cuarentena');
      return;
    }

    setGuardando(true);
    try {
      const res = await fetch(`${API_URL}/caniles/asignar`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          canilId: selectedCanil.id,
          animalId: animal.id,
          motivo: motivoMovimiento.trim() || 'Fin de cuarentena',
          estado: nuevoEstado
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar el estado');

      setMensajeExito(nuevoEstado === 'CUARENTENA' ? 'Canil puesto en cuarentena' : 'Canil devuelto a operación normal');
      setTimeout(() => setMensajeExito(null), 4000);
      setModalCanilOpen(false);
      await cargarDatos();
    } catch (err) {
      setErrorModal(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleSolicitarExterno = async (e) => {
    e.preventDefault();
    setErrorExterno(null);

    if (!trasladoExterno.animalId) {
      setErrorExterno('Debes seleccionar un animal');
      return;
    }
    if (!trasladoExterno.motivo.trim()) {
      setErrorExterno('El motivo del traslado es obligatorio');
      return;
    }
    if (!trasladoExterno.destinoNombre.trim()) {
      setErrorExterno('Indica la protectora aliada u hogar de acogida');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/caniles/traslados`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...trasladoExterno,
          animalId: parseInt(trasladoExterno.animalId)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al solicitar traslado');

      setMensajeExito('Traslado registrado. Notificado a Directora para aprobación.');
      setTimeout(() => setMensajeExito(null), 4000);
      setTrasladoExterno({
        animalId: '',
        tipo: 'PROTECTORA_ALIADA',
        destinoNombre: '',
        destinoContacto: '',
        destinoDireccion: '',
        motivo: ''
      });
      setTab('traslados');
      await cargarDatos();
    } catch (err) {
      setErrorExterno(err.message);
    }
  };

  const handleOpenAgregarCanil = () => {
    // Preferir el sector del último canil creado; si no hay, el primero disponible.
    const ultimoCanil = [...caniles].sort((a, b) => b.id - a.id)[0];
    const sectorPorDefecto = ultimoCanil?.sector || sectoresExistentes[0] || '';
    setNuevoCanil({ sector: sectorPorDefecto });
    setSectorMode(sectorPorDefecto ? 'select' : 'nuevo');
    setErrorNuevoCanil(null);
    setAgregarCanilOpen(true);
  };

  const handleCrearCanil = async (e) => {
    e.preventDefault();
    setErrorNuevoCanil(null);

    if (!nuevoCanil.sector.trim()) {
      setErrorNuevoCanil('Selecciona un sector existente o escribe uno nuevo');
      return;
    }

    // Nombre y código automáticos: "Canil 12", "Canil 13", ...
    const numero = getProximoNumeroCanil();
    const nombre = `Canil ${numero}`;
    let codigo = `C-${String(numero).padStart(2, '0')}`;
    const codigosExistentes = new Set(caniles.map(c => c.codigo));
    let sufijo = 0;
    while (codigosExistentes.has(codigo)) {
      sufijo += 1;
      codigo = `C-${String(numero).padStart(2, '0')}-${sufijo}`;
    }

    setCreandoCanil(true);
    try {
      const res = await fetch(`${API_URL}/caniles`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          codigo,
          nombre,
          sector: nuevoCanil.sector.trim(),
          capacidad: 1,
          estado: 'LIBRE'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear canil');

      setMensajeExito(data.message || 'Canil creado con éxito');
      setTimeout(() => setMensajeExito(null), 4000);
      setAgregarCanilOpen(false);
      setNuevoCanil({ sector: '' });
      setSectorMode('select');
      setErrorNuevoCanil(null);
      await cargarDatos();
    } catch (err) {
      setErrorNuevoCanil(err.message);
    } finally {
      setCreandoCanil(false);
    }
  };

  const handleConfirmarEliminarCanil = async () => {
    if (!eliminarCanil) return;
    setEliminandoCanil(true);
    try {
      const res = await fetch(`${API_URL}/caniles/${eliminarCanil.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar canil');

      setMensajeExito(data.mensaje || 'Canil eliminado correctamente');
      setTimeout(() => setMensajeExito(null), 4000);
      setEliminarConfirmOpen(false);
      setEliminarCanil(null);
      await cargarDatos();
    } catch (err) {
      alert(err.message);
    } finally {
      setEliminandoCanil(false);
    }
  };

  const handleGestionarAprobacion = async (trasladoId, aprobar) => {
    const comentario = window.prompt(aprobar ? 'Comentario de aprobación (opcional):' : 'Motivo del rechazo:');
    if (!aprobar && !comentario) return;

    try {
      const res = await fetch(`${API_URL}/caniles/traslados/${trasladoId}/aprobacion`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ aprobar, comentario })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar aprobación');

      setMensajeExito(data.message);
      setTimeout(() => setMensajeExito(null), 4000);
      await cargarDatos();
    } catch (err) {
      alert(err.message);
    }
  };

  const esDirectora = user?.rol === 'DIRECTORA';

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '24px' }}>
      {/* ALERTA VISUAL DE SOBRECUPO (>90%) */}
      {resumen?.alertaSobrecupo && (
        <div style={{
          background: '#fbeae8', border: '2px solid #d1453b', borderRadius: '12px',
          padding: '16px 20px', marginBottom: '22px', display: 'flex', alignItems: 'center', gap: '14px',
          boxShadow: '0 4px 14px rgba(209,69,59,0.15)'
        }}>
          <span style={{ fontSize: '1.8rem' }}>🚨</span>
          <div>
            <strong style={{ color: '#d1453b', fontSize: '1.05rem', display: 'block' }}>
              ¡ALERTA CRÍTICA DE SOBRECUPO EN CANILES! Ocupación al {resumen.porcentajeOcupacion}%
            </strong>
            <span style={{ color: '#7c8592', fontSize: '0.86rem' }}>
              El refugio supera el 90% de capacidad operativa. Solo quedan {resumen.libres} caniles libres.
              Se recomienda priorizar traslados a protectoras aliadas o activar red de hogares temporales.
            </span>
          </div>
        </div>
      )}

      {mensajeExito && (
        <div style={{
          background: '#e8f0e8', border: '1px solid #3f6c52', color: '#2f5540',
          borderRadius: '9px', padding: '12px 18px', marginBottom: '18px', fontWeight: '600'
        }}>
          ✓ {mensajeExito}
        </div>
      )}

      {/* ENCABEZADO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#1f2430', margin: 0 }}>Módulo de Caniles y Traslados</h2>
          <p style={{ color: '#7c8592', fontSize: '0.88rem', margin: '4px 0 0' }}>
            Mapa visual de espacios, reubicaciones internas y traslados a protectoras / hogares temporales
          </p>
        </div>

        {/* Botón Agregar Canil */}
        <button
          onClick={handleOpenAgregarCanil}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: '1.5px solid #3f6c52', fontWeight: '700', fontSize: '0.84rem', cursor: 'pointer',
            background: '#fff', color: '#3f6c52', display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          ➕ Agregar Canil
        </button>

        {/* Pestañas */}
        <div style={{ display: 'flex', gap: '8px', background: '#fff', padding: '4px', borderRadius: '10px', border: '1px solid #e9eaed' }}>
          <button
            onClick={() => setTab('mapa')}
            style={{
              padding: '8px 16px', borderRadius: '7px', border: 'none', fontWeight: '700', fontSize: '0.84rem', cursor: 'pointer',
              background: tab === 'mapa' ? '#3f6c52' : 'transparent', color: tab === 'mapa' ? '#fff' : '#7c8592'
            }}
          >
            🗺️ Mapa de Caniles
          </button>
          <button
            onClick={() => setTab('traslados')}
            style={{
              padding: '8px 16px', borderRadius: '7px', border: 'none', fontWeight: '700', fontSize: '0.84rem', cursor: 'pointer',
              background: tab === 'traslados' ? '#3f6c52' : 'transparent', color: tab === 'traslados' ? '#fff' : '#7c8592'
            }}
          >
            📋 Bitácora de Traslados
          </button>
          <button
            onClick={() => setTab('solicitar')}
            style={{
              padding: '8px 16px', borderRadius: '7px', border: 'none', fontWeight: '700', fontSize: '0.84rem', cursor: 'pointer',
              background: tab === 'solicitar' ? '#3f6c52' : 'transparent', color: tab === 'solicitar' ? '#fff' : '#7c8592'
            }}
          >
            ➕ Solicitar Traslado Externo
          </button>
        </div>
      </div>

      {/* FORMULARIO AGREGAR CANIL */}
      {agregarCanilOpen && (
        <div style={{
          background: '#fff', borderRadius: '16px', border: '1px solid #e9eaed', padding: '26px',
          maxWidth: '640px', margin: '0 auto 24px', boxShadow: '0 4px 14px rgba(20,24,32,0.06)'
        }}>
          <h3 style={{ margin: '0 0 8px', color: '#1f2430' }}>➕ Agregar Nuevo Canil</h3>
          <p style={{ color: '#7c8592', fontSize: '0.84rem', margin: '0 0 18px' }}>
            Completa los datos del nuevo canil. Quedará disponible como LIBRE para asignar animales.
          </p>

          {errorNuevoCanil && (
            <div style={{ background: '#fbeae8', color: '#d1453b', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.82rem' }}>
              {errorNuevoCanil}
            </div>
          )}

          <form onSubmit={handleCrearCanil}>
            {/* Nombre y capacidad automáticos */}
            <div style={{
              background: '#f8f9fa', border: '1px solid #e9eaed', borderRadius: '10px',
              padding: '12px 14px', marginBottom: '14px', fontSize: '0.84rem', color: '#555e6d'
            }}>
              Se creará <strong>Canil {getProximoNumeroCanil()}</strong> · Capacidad: <strong>1 animal</strong>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                Sector *
              </label>
              <select
                value={sectorMode === 'nuevo' ? '__nuevo__' : nuevoCanil.sector}
                onChange={e => {
                  if (e.target.value === '__nuevo__') {
                    setSectorMode('nuevo');
                    setNuevoCanil({ sector: '' });
                  } else {
                    setSectorMode('select');
                    setNuevoCanil({ sector: e.target.value });
                  }
                }}
                style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed' }}
              >
                <option value="">— Seleccionar sector —</option>
                {sectoresExistentes.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
                <option value="__nuevo__">➕ Escribir un nuevo sector</option>
              </select>
            </div>

            {sectorMode === 'nuevo' && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                  Nuevo sector *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Patio Principal"
                  value={nuevoCanil.sector}
                  onChange={e => setNuevoCanil({ sector: e.target.value })}
                  style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed', boxSizing: 'border-box' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setAgregarCanilOpen(false)}
                style={{ padding: '9px 16px', background: 'transparent', border: '1.5px solid #e9eaed', borderRadius: '8px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={creandoCanil}
                style={{ padding: '9px 20px', background: '#3f6c52', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
              >
                {creandoCanil ? 'Creando...' : 'Crear Canil'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* KPI CARDS RESUMEN */}
      {resumen && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '16px 20px', border: '1px solid #e9eaed' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#7c8592', textTransform: 'uppercase' }}>Caniles Libres</span>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#3f6c52', marginTop: '4px' }}>{resumen.libres}</div>
            <span style={{ fontSize: '0.78rem', color: '#7c8592' }}>Disponibles para ingreso</span>
          </div>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '16px 20px', border: '1px solid #e9eaed' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#7c8592', textTransform: 'uppercase' }}>Caniles Ocupados</span>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#b37416', marginTop: '4px' }}>{resumen.ocupados}</div>
            <span style={{ fontSize: '0.78rem', color: '#7c8592' }}>Con animal alojado</span>
          </div>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '16px 20px', border: '1px solid #e9eaed' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#7c8592', textTransform: 'uppercase' }}>En Cuarentena</span>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#d1453b', marginTop: '4px' }}>{resumen.cuarentena}</div>
            <span style={{ fontSize: '0.78rem', color: '#7c8592' }}>Observación médica</span>
          </div>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '16px 20px', border: '1px solid #e9eaed' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#7c8592', textTransform: 'uppercase' }}>Ocupación Total</span>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: resumen.alertaSobrecupo ? '#d1453b' : '#1f2430', marginTop: '4px' }}>
              {resumen.porcentajeOcupacion}%
            </div>
            <span style={{ fontSize: '0.78rem', color: resumen.alertaSobrecupo ? '#d1453b' : '#7c8592' }}>
              {resumen.alertaSobrecupo ? '⚠️ > 90% (Sobrecupo)' : 'Operación normal'}
            </span>
          </div>
        </div>
      )}

      {/* CONTENIDO SEGÚN TAB */}
      {tab === 'mapa' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.9rem', color: '#7c8592', fontWeight: '600' }}>
              Haz clic en cualquier canil para reubicar, asignar o liberar un animal.
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', background: '#e8f0e8', color: '#2f5540', padding: '4px 10px', borderRadius: '6px', fontWeight: '700' }}>● LIBRE</span>
              <span style={{ fontSize: '0.75rem', background: '#faf1de', color: '#b37416', padding: '4px 10px', borderRadius: '6px', fontWeight: '700' }}>● OCUPADO</span>
              <span style={{ fontSize: '0.75rem', background: '#fbeae8', color: '#d1453b', padding: '4px 10px', borderRadius: '6px', fontWeight: '700' }}>● CUARENTENA</span>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '16px'
          }}>
            {caniles.map(canil => {
              const ocupado = canil.estado === 'OCUPADO';
              const libre = canil.estado === 'LIBRE';
              const cuarentena = canil.estado === 'CUARENTENA';

              const borderColor = libre ? '#3f6c52' : ocupado ? '#d99a3d' : '#d1453b';
              const badgeBg = libre ? '#e8f0e8' : ocupado ? '#faf1de' : '#fbeae8';
              const badgeColor = libre ? '#2f5540' : ocupado ? '#b37416' : '#d1453b';

              return (
                <div
                  key={canil.id}
                  onClick={() => handleOpenModal(canil)}
                  style={{
                    background: '#fff',
                    borderRadius: '14px',
                    border: '1px solid #e9eaed',
                    borderTop: `4px solid ${borderColor}`,
                    padding: '16px',
                    boxShadow: '0 2px 8px rgba(20,24,32,0.04)',
                    cursor: 'pointer',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    position: 'relative'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(20,24,32,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(20,24,32,0.04)'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <strong style={{ fontSize: '0.98rem', color: '#1f2430' }}>{canil.nombre}</strong>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: '800', background: badgeBg, color: badgeColor,
                      padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase'
                    }}>
                      {canil.estado}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: '#7c8592', marginBottom: '10px' }}>
                    Sector: <strong>{canil.sector}</strong>
                  </div>

                  {canil.animalAlojado ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8f9fa', padding: '10px', borderRadius: '10px' }}>
                      <div style={{
                        width: '42px', height: '42px', borderRadius: '8px', background: '#e9eaed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0
                      }}>
                        {canil.animalAlojado.fotoUrl ? (
                          <img src={canil.animalAlojado.fotoUrl} alt={canil.animalAlojado.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '1.2rem' }}>🐾</span>
                        )}
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: '800', fontSize: '0.88rem', color: '#1f2430', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {canil.animalAlojado.nombre}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#7c8592' }}>
                          {canil.animalAlojado.especie} · {canil.animalAlojado.sexo} · {canil.animalAlojado.estadoSalud}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px', color: '#a3aab5',
                      fontSize: '0.82rem', padding: '14px 10px', background: '#fafbfc', borderRadius: '10px'
                    }}>
                      <span>🚪</span> Canil disponible (Capacidad libre)
                    </div>
                  )}

                  <div style={{ marginTop: '12px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenModal(canil); }}
                      style={{
                        padding: '5px 10px', background: '#eef3ec', border: '1px solid #cfe0d3', borderRadius: '6px',
                        color: '#2f5540', fontSize: '0.74rem', fontWeight: '700', cursor: 'pointer'
                      }}
                    >
                      Gestionar Canil
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB BITÁCORA DE TRASLADOS */}
      {tab === 'traslados' && (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e9eaed', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', color: '#1f2430' }}>Historial y Estado de Traslados</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: '1.5px solid #e9eaed', textAlign: 'left', color: '#7c8592' }}>
                  <th style={{ padding: '10px' }}>Fecha</th>
                  <th style={{ padding: '10px' }}>Animal</th>
                  <th style={{ padding: '10px' }}>Tipo</th>
                  <th style={{ padding: '10px' }}>Origen / Destino</th>
                  <th style={{ padding: '10px' }}>Motivo</th>
                  <th style={{ padding: '10px' }}>Responsable</th>
                  <th style={{ padding: '10px' }}>Estado</th>
                  {esDirectora && <th style={{ padding: '10px', textAlign: 'center' }}>Acción Directora</th>}
                </tr>
              </thead>
              <tbody>
                {traslados.length === 0 ? (
                  <tr>
                    <td colSpan={esDirectora ? 8 : 7} style={{ textAlign: 'center', padding: '24px', color: '#a3aab5' }}>
                      No se registran movimientos ni traslados aún
                    </td>
                  </tr>
                ) : (
                  traslados.map(t => {
                    const badgeState = {
                      COMPLETADO: { bg: '#e8f0e8', color: '#2f5540' },
                      APROBADO: { bg: '#e8f0e8', color: '#2f5540' },
                      PENDIENTE_APROBACION: { bg: '#faf1de', color: '#d99a3d' },
                      RECHAZADO: { bg: '#fbeae8', color: '#d1453b' }
                    }[t.estado] || { bg: '#e9eaed', color: '#7c8592' };

                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid #f0f1f3' }}>
                        <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                          {new Date(t.fechaRegistro).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '10px', fontWeight: '700' }}>{t.animal?.nombre}</td>
                        <td style={{ padding: '10px' }}>{t.tipo.replace('_', ' ')}</td>
                        <td style={{ padding: '10px' }}>
                          {t.tipo === 'INTERNO_CANIL' ? (
                            <span>{t.canilOrigen?.nombre || 'Ingreso'} → {t.canilDestino?.nombre}</span>
                          ) : (
                            <span><strong>{t.destinoNombre}</strong> {t.destinoContacto ? `(${t.destinoContacto})` : ''}</span>
                          )}
                        </td>
                        <td style={{ padding: '10px', maxWidth: '200px' }}>{t.motivo}</td>
                        <td style={{ padding: '10px' }}>{t.responsable?.nombre}</td>
                        <td style={{ padding: '10px' }}>
                          <span style={{
                            fontSize: '0.72rem', fontWeight: '700', padding: '3px 8px', borderRadius: '6px',
                            background: badgeState.bg, color: badgeState.color
                          }}>
                            {t.estado.replace('_', ' ')}
                          </span>
                        </td>
                        {esDirectora && (
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            {t.estado === 'PENDIENTE_APROBACION' ? (
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => handleGestionarAprobacion(t.id, true)}
                                  style={{ background: '#3f6c52', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.75rem' }}
                                >
                                  Aprobar
                                </button>
                                <button
                                  onClick={() => handleGestionarAprobacion(t.id, false)}
                                  style={{ background: '#d1453b', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.75rem' }}
                                >
                                  Rechazar
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: '#7c8592' }}>
                                {t.aprobadoPor ? `Por ${t.aprobadoPor.nombre}` : '—'}
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB SOLICITAR TRASLADO EXTERNO */}
      {tab === 'solicitar' && (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e9eaed', padding: '26px', maxWidth: '640px', margin: '0 auto' }}>
          <h3 style={{ margin: '0 0 8px', color: '#1f2430' }}>Solicitar Traslado Externo</h3>
          <p style={{ color: '#7c8592', fontSize: '0.84rem', margin: '0 0 18px' }}>
            Para traslados hacia protectoras aliadas u hogares temporales. Requiere aprobación obligatoria por la Directora.
          </p>

          {errorExterno && (
            <div style={{ background: '#fbeae8', color: '#d1453b', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.82rem' }}>
              {errorExterno}
            </div>
          )}

          <form onSubmit={handleSolicitarExterno}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                Animal a Trasladar *
              </label>
              <select
                value={trasladoExterno.animalId}
                onChange={e => setTrasladoExterno({ ...trasladoExterno, animalId: e.target.value })}
                required
                style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed' }}
              >
                <option value="">— Seleccionar animal —</option>
                {animales.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} ({a.especie} - {a.canil ? a.canil.nombre : 'Sin canil'})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                Tipo de Destino *
              </label>
              <select
                value={trasladoExterno.tipo}
                onChange={e => setTrasladoExterno({ ...trasladoExterno, tipo: e.target.value })}
                style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed' }}
              >
                <option value="PROTECTORA_ALIADA">Protectora Aliada</option>
                <option value="HOGAR_TEMPORAL">Hogar Temporal (Acogida)</option>
              </select>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                Nombre de la Protectora o Encargado del Hogar *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Fundación Patitas Felices / Familia Morales"
                value={trasladoExterno.destinoNombre}
                onChange={e => setTrasladoExterno({ ...trasladoExterno, destinoNombre: e.target.value })}
                style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                  Teléfono / Contacto
                </label>
                <input
                  type="text"
                  placeholder="+56 9 ..."
                  value={trasladoExterno.destinoContacto}
                  onChange={e => setTrasladoExterno({ ...trasladoExterno, destinoContacto: e.target.value })}
                  style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                  Dirección
                </label>
                <input
                  type="text"
                  placeholder="Comuna, calle..."
                  value={trasladoExterno.destinoDireccion}
                  onChange={e => setTrasladoExterno({ ...trasladoExterno, destinoDireccion: e.target.value })}
                  style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                Motivo del Traslado (Obligatorio) *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Ej: Sobrecupo temporal / Necesidad de socialización en hogar / Tratamiento especializado en protectora"
                value={trasladoExterno.motivo}
                onChange={e => setTrasladoExterno({ ...trasladoExterno, motivo: e.target.value })}
                style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setTab('mapa')}
                style={{ padding: '9px 16px', background: 'transparent', border: '1.5px solid #e9eaed', borderRadius: '8px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{ padding: '9px 20px', background: '#3f6c52', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
              >
                Registrar Solicitud
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL ASIGNAR / REUBICAR CANIL */}
      {modalCanilOpen && selectedCanil && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(20,24,32,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px'
        }}>
          <div style={{
            background: '#fff', borderRadius: '18px', padding: '26px', width: '100%', maxWidth: '480px',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 12px 36px rgba(20,24,32,0.2)'
          }}>
            <h3 style={{ margin: '0 0 6px', color: '#1f2430' }}>
              🚪 Gestionar Canil {selectedCanil.nombre}
            </h3>
            <p style={{ color: '#7c8592', fontSize: '0.84rem', margin: '0 0 14px' }}>
              Sector: <strong>{selectedCanil.sector}</strong> · Capacidad máxima: {selectedCanil.capacidad} animal
            </p>

            {/* Selector de acción */}
            <div style={{ display: 'flex', gap: '6px', background: '#f3f4f6', padding: '4px', borderRadius: '10px', marginBottom: '16px' }}>
              {[
                { key: 'asignar', label: 'Asignar / Liberar' },
                { key: 'transferir', label: 'Mover a otro canil' },
                { key: 'cuarentena', label: 'Cuarentena' }
              ].map(op => (
                <button
                  key={op.key}
                  type="button"
                  onClick={() => { setModalModo(op.key); setErrorModal(null); setMotivoMovimiento(''); }}
                  style={{
                    flex: 1, padding: '7px 6px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                    fontSize: '0.74rem', fontWeight: '700',
                    background: modalModo === op.key ? '#3f6c52' : 'transparent',
                    color: modalModo === op.key ? '#fff' : '#7c8592'
                  }}
                >
                  {op.label}
                </button>
              ))}
            </div>

            {errorModal && (
              <div style={{ background: '#fbeae8', color: '#d1453b', padding: '10px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.82rem' }}>
                {errorModal}
              </div>
            )}

            {/* MODO ASIGNAR / LIBERAR */}
            {modalModo === 'asignar' && (
              <form onSubmit={handleGuardarAsignacion}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                    Animal Alojado
                  </label>
                  <select
                    value={selectedAnimalId}
                    onChange={e => setSelectedAnimalId(e.target.value)}
                    style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed' }}
                  >
                    <option value="">— Ninguno (Dejar canil LIBRE) —</option>
                    {animales.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.nombre} ({a.especie} · {a.canil ? `Actual: ${a.canil.nombre}` : 'Sin canil'})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                    Motivo del Movimiento (Opcional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Motivo del movimiento (opcional, ej: ingreso, reubicación, sobrecupo)"
                    value={motivoMovimiento}
                    onChange={e => setMotivoMovimiento(e.target.value)}
                    style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{
                  background: '#f8f9fa', padding: '10px 14px', borderRadius: '8px',
                  fontSize: '0.78rem', color: '#7c8592', marginBottom: '16px'
                }}>
                  Responsable del movimiento: <strong>{user?.nombre}</strong> ({user?.rol})
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setModalCanilOpen(false)}
                    style={{ padding: '9px 16px', background: 'transparent', border: '1.5px solid #e9eaed', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardando}
                    style={{ padding: '9px 20px', background: '#3f6c52', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    {guardando ? 'Guardando...' : 'Confirmar Asignación'}
                  </button>
                </div>
              </form>
            )}

            {/* MODO TRANSFERIR A OTRO CANIL */}
            {modalModo === 'transferir' && (
              <form onSubmit={handleTransferirCanil}>
                {selectedCanil.animalAlojado ? (
                  <div style={{ background: '#f8f9fa', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem', color: '#1f2430', marginBottom: '12px' }}>
                    Animal a transferir: <strong>{selectedCanil.animalAlojado.nombre}</strong>
                  </div>
                ) : (
                  <div style={{ background: '#faf1de', color: '#b37416', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '12px' }}>
                    Este canil no tiene un animal alojado para transferir.
                  </div>
                )}

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                    Canil de destino *
                  </label>
                  <select
                    value={canilDestinoId}
                    onChange={e => setCanilDestinoId(e.target.value)}
                    disabled={!selectedCanil.animalAlojado}
                    required
                    style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed' }}
                  >
                    <option value="">— Seleccionar canil libre —</option>
                    {caniles
                      .filter(c => c.id !== selectedCanil.id && c.estado === 'LIBRE')
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nombre} · {c.sector}
                        </option>
                      ))}
                  </select>
                  {caniles.filter(c => c.id !== selectedCanil.id && c.estado === 'LIBRE').length === 0 && (
                    <div style={{ fontSize: '0.74rem', color: '#d1453b', marginTop: '5px' }}>
                      No hay caniles libres disponibles como destino.
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                    Motivo de la transferencia (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ej: Reorganización interna / Mejor espacio"
                    value={motivoMovimiento}
                    onChange={e => setMotivoMovimiento(e.target.value)}
                    style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #e9eaed', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setModalCanilOpen(false)}
                    style={{ padding: '9px 16px', background: 'transparent', border: '1.5px solid #e9eaed', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardando || !selectedCanil.animalAlojado}
                    style={{
                      padding: '9px 20px', background: '#3f6c52', color: '#fff', border: 'none', borderRadius: '8px',
                      fontWeight: '700', cursor: 'pointer', opacity: !selectedCanil.animalAlojado ? 0.6 : 1
                    }}
                  >
                    {guardando ? 'Transfiriendo...' : 'Transferir Animal'}
                  </button>
                </div>
              </form>
            )}

            {/* MODO CUARENTENA */}
            {modalModo === 'cuarentena' && (
              <form onSubmit={handleCambiarCuarentena}>
                {selectedCanil.animalAlojado ? (
                  <>
                    <div style={{
                      background: selectedCanil.estado === 'CUARENTENA' ? '#fbeae8' : '#f8f9fa',
                      padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem', color: '#1f2430', marginBottom: '12px'
                    }}>
                      Animal: <strong>{selectedCanil.animalAlojado.nombre}</strong> · Estado actual: <strong>{selectedCanil.estado}</strong>
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#7c8592', marginBottom: '4px' }}>
                        Motivo {selectedCanil.estado === 'CUARENTENA' ? '(Opcional)' : '(Obligatorio) *'}
                      </label>
                      <textarea
                        required={selectedCanil.estado !== 'CUARENTENA'}
                        rows={3}
                        placeholder={selectedCanil.estado === 'CUARENTENA' ? 'Motivo del alta de cuarentena (opcional)' : 'Motivo de la cuarentena (obligatorio)'}
                        value={motivoMovimiento}
                        onChange={e => setMotivoMovimiento(e.target.value)}
                        style={{
                          width: '100%', padding: '9px', borderRadius: '8px', boxSizing: 'border-box',
                          border: `1.5px solid ${selectedCanil.estado === 'CUARENTENA' ? '#e9eaed' : '#d1453b'}`
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div style={{ background: '#faf1de', color: '#b37416', padding: '12px 14px', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '14px' }}>
                    Solo se puede poner en cuarentena un canil que tenga un animal alojado. Asigna primero un animal.
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setModalCanilOpen(false)}
                    style={{ padding: '9px 16px', background: 'transparent', border: '1.5px solid #e9eaed', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardando || !selectedCanil.animalAlojado}
                    style={{
                      padding: '9px 20px', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700',
                      cursor: 'pointer', opacity: !selectedCanil.animalAlojado ? 0.6 : 1,
                      background: selectedCanil.estado === 'CUARENTENA' ? '#3f6c52' : '#d1453b'
                    }}
                  >
                    {guardando ? 'Guardando...' : (selectedCanil.estado === 'CUARENTENA' ? 'Quitar de cuarentena' : 'Poner en cuarentena')}
                  </button>
                </div>
              </form>
            )}

            {/* Acción destructiva: eliminar canil */}
            <div style={{
              marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #f0f1f3',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap'
            }}>
              <span style={{ fontSize: '0.74rem', color: '#a3aab5' }}>
                Solo se pueden eliminar caniles que estén LIBRES.
              </span>
              <button
                type="button"
                disabled={selectedCanil.estado !== 'LIBRE'}
                onClick={() => {
                  setModalCanilOpen(false);
                  setEliminarCanil(selectedCanil);
                  setEliminarConfirmOpen(true);
                }}
                style={{
                  padding: '7px 12px',
                  background: selectedCanil.estado !== 'LIBRE' ? '#e9eaed' : '#fbeae8',
                  border: `1px solid ${selectedCanil.estado !== 'LIBRE' ? '#e9eaed' : '#f3c9c4'}`,
                  borderRadius: '7px',
                  color: selectedCanil.estado !== 'LIBRE' ? '#a3aab5' : '#d1453b',
                  fontSize: '0.75rem', fontWeight: '700',
                  cursor: selectedCanil.estado !== 'LIBRE' ? 'not-allowed' : 'pointer',
                  opacity: selectedCanil.estado !== 'LIBRE' ? 0.6 : 1
                }}
              >
                🗑️ Eliminar canil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN ELIMINAR CANIL */}
      {eliminarConfirmOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(20,24,32,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '16px'
        }}>
          <div style={{
            background: '#fff', borderRadius: '18px', padding: '26px', width: '100%', maxWidth: '480px',
            boxShadow: '0 12px 36px rgba(20,24,32,0.2)'
          }}>
            <h3 style={{ margin: '0 0 6px', color: '#d1453b', fontSize: '1.25rem' }}>
              🗑️ Eliminar Canil
            </h3>
            <p style={{ color: '#7c8592', fontSize: '0.88rem', margin: '0 0 18px' }}>
              ¿Estás seguro de que deseas eliminar este canil? Esta acción no se puede deshacer.
            </p>
            <div style={{ background: '#fafbfc', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.86rem', color: '#555e6d' }}>
              <strong>Canil a eliminar:</strong> {eliminarCanil?.nombre || ''}
            </div>
            {eliminandoCanil && (
              <div style={{ textAlign: 'center', color: '#7c8592', fontSize: '0.84rem' }}>Eliminando...</div>
            )}
            {!eliminandoCanil && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={() => setEliminarConfirmOpen(false)}
                  style={{ padding: '9px 16px', background: 'transparent', border: '1.5px solid #e9eaed', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmarEliminarCanil}
                  style={{ padding: '9px 20px', background: '#d1453b', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Eliminar Canil
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
