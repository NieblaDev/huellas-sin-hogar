import { formatearErrorApi } from '../utils/errores';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CalendarDays,
  CircleCheck,
  Crown,
  Handshake,
  House,
  KeyRound,
  Lock,
  Mail,
  Search,
  ShieldCheck,
  Star,
  Stethoscope,
  Trash2,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import { API_URL, getAuthHeaders } from '../api/config';

const ICONOS_ROL = {
  DIRECTORA: Crown,
  VETERINARIA: Stethoscope,
  ENCARGADA_ADOPCIONES: House,
  COORDINADOR: CalendarDays,
  VOLUNTARIO_AVANZADO: Star,
  VOLUNTARIO_NOVATO: Handshake
};

const COLORES_ROL = {
  DIRECTORA: { bg: '#e8f0e8', color: '#2f5540' },
  VETERINARIA: { bg: '#e8f1f7', color: '#25637d' },
  ENCARGADA_ADOPCIONES: { bg: '#f3ecf8', color: '#6b3e84' },
  COORDINADOR: { bg: '#fdf1de', color: '#9a6300' },
  VOLUNTARIO_AVANZADO: { bg: '#fff4d9', color: '#a66a00' },
  VOLUNTARIO_NOVATO: { bg: '#eef0fb', color: '#4550c0' }
};

const FORM_INICIAL = {
  nombre: '',
  email: '',
  rol: 'VOLUNTARIO_NOVATO',
  password: '',
  confirmar: ''
};

const IconoPerfil = ({ rol, size = 18 }) => {
  const Icono = ICONOS_ROL[rol] || Users;
  return <Icono size={size} aria-hidden="true" />;
};

const AvatarPerfil = ({ rol, size = 38 }) => {
  const colores = COLORES_ROL[rol] || { bg: '#f1f5f9', color: '#475569' };
  return (
    <span
      className="perfil-avatar"
      style={{ width: size, height: size, background: colores.bg, color: colores.color }}
    >
      <IconoPerfil rol={rol} size={Math.round(size * 0.48)} />
    </span>
  );
};

const EtiquetaRol = ({ usuario }) => {
  const colores = COLORES_ROL[usuario.rol] || { bg: '#f1f5f9', color: '#475569' };
  return (
    <span className="portal-badge" style={{ background: colores.bg, color: colores.color }}>
      <IconoPerfil rol={usuario.rol} size={13} />
      {usuario.perfil?.etiqueta || usuario.rol}
    </span>
  );
};

const ListaPermisos = ({ items = [], tipo }) => {
  const permitido = tipo === 'permitido';
  return (
    <div className={`perfil-permission-block ${permitido ? 'is-allowed' : 'is-denied'}`}>
      <div className="perfil-permission-title">
        {permitido ? <CircleCheck size={15} aria-hidden="true" /> : <Ban size={15} aria-hidden="true" />}
        <span>{permitido ? 'Permitido' : 'Restringido'}</span>
      </div>
      <ul>
        {items.map(item => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
};

const formatearFecha = valor => valor ? new Date(valor).toLocaleDateString('es-CL') : 'Sin registro';

export default function PerfilesUsuariosModulo({ user }) {
  const [datos, setDatos] = useState({
    usuarios: [],
    perfiles: [],
    resumen: { total: 0, activos: 0, inactivos: 0 }
  });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [vista, setVista] = useState('usuarios');
  const [estadoPerfil, setEstadoPerfil] = useState('activos');
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('TODOS');

  const [modalCrear, setModalCrear] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);
  const [formError, setFormError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [perfilAEliminar, setPerfilAEliminar] = useState(null);
  const [errorAccion, setErrorAccion] = useState('');
  const [eliminando, setEliminando] = useState(false);

  const cargarDatos = async (signal) => {
    setCargando(true);
    setError('');
    try {
      const respuesta = await fetch(`${API_URL}/usuarios`, {
        headers: getAuthHeaders(),
        signal,
        cache: 'no-store'
      });
      const data = await respuesta.json();
      if (!respuesta.ok) throw new Error(formatearErrorApi(data, 'No se pudieron cargar los perfiles.'));
      setDatos({
        usuarios: data.usuarios || [],
        perfiles: data.perfiles || [],
        resumen: data.resumen || { total: 0, activos: 0, inactivos: 0 }
      });
    } catch (err) {
      if (err.name !== 'AbortError') setError(formatearErrorApi(err));
    } finally {
      if (!signal?.aborted) setCargando(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    cargarDatos(controller.signal);
    return () => controller.abort();
  }, []);

  const usuariosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return datos.usuarios.filter(usuario => {
      const coincideEstado = estadoPerfil === 'activos' ? usuario.activo : !usuario.activo;
      const coincideRol = filtroRol === 'TODOS' || usuario.rol === filtroRol;
      const coincideTexto = !texto
        || usuario.nombre.toLowerCase().includes(texto)
        || usuario.email.toLowerCase().includes(texto);
      return coincideEstado && coincideRol && coincideTexto;
    });
  }, [datos.usuarios, estadoPerfil, filtroRol, busqueda]);

  const usuariosPorRol = useMemo(() => datos.usuarios.reduce((acumulado, usuario) => {
    acumulado[usuario.rol] = (acumulado[usuario.rol] || 0) + 1;
    return acumulado;
  }, {}), [datos.usuarios]);

  const perfilSeleccionado = datos.perfiles.find(perfil => perfil.rol === form.rol) || datos.perfiles[0];

  const abrirModalCrear = () => {
    setForm(FORM_INICIAL);
    setFormError('');
    setModalCrear(true);
  };

  const cerrarModalCrear = () => {
    if (guardando) return;
    setModalCrear(false);
    setFormError('');
  };

  const crearPerfil = async event => {
    event.preventDefault();
    setFormError('');

    if (!form.nombre.trim()) return setFormError('Ingresa el nombre completo.');
    if (!form.email.trim()) return setFormError('Ingresa el correo electrónico.');
    if (form.password.length < 8) return setFormError('La contraseña debe tener al menos 8 caracteres.');
    if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      return setFormError('La contraseña debe incluir al menos una letra y un número.');
    }
    if (form.password !== form.confirmar) return setFormError('Las contraseñas no coinciden.');

    setGuardando(true);
    try {
      const respuesta = await fetch(`${API_URL}/usuarios`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          email: form.email.trim(),
          rol: form.rol,
          password: form.password
        })
      });
      const data = await respuesta.json();
      if (!respuesta.ok) throw new Error(formatearErrorApi(data, 'No se pudo crear el perfil.'));

      setModalCrear(false);
      setForm(FORM_INICIAL);
      setExito(data.mensaje || 'Perfil creado correctamente.');
      setError('');
      await cargarDatos();
    } catch (err) {
      setFormError(formatearErrorApi(err));
    } finally {
      setGuardando(false);
    }
  };

  const eliminarPerfil = async () => {
    if (!perfilAEliminar) return;
    setEliminando(true);
    setErrorAccion('');
    try {
      const respuesta = await fetch(`${API_URL}/usuarios/${encodeURIComponent(perfilAEliminar.email)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await respuesta.json();
      if (!respuesta.ok) throw new Error(formatearErrorApi(data, 'No se pudo eliminar el perfil.'));

      setPerfilAEliminar(null);
      setExito(data.mensaje || 'Perfil eliminado correctamente.');
      setError('');
      setEstadoPerfil('activos');
      await cargarDatos();
    } catch (err) {
      setErrorAccion(formatearErrorApi(err));
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="portal-page-container">
      <div className="portal-header">
        <div>
          <h2 className="portal-header-title">
            <Users size={26} aria-hidden="true" />
            <span>Usuarios y Perfiles</span>
          </h2>
          <p className="portal-header-subtitle">
            Crea accesos para el equipo, revisa los permisos de cada perfil y revoca el acceso sin perder la trazabilidad.
          </p>
        </div>
        <div className="portal-header-actions">
          <button className="portal-btn portal-btn-primary" onClick={abrirModalCrear}>
            <UserPlus size={17} aria-hidden="true" /> Crear perfil
          </button>
        </div>
      </div>

      {exito && (
        <div className="portal-alert portal-alert-success" role="status">
          <CircleCheck size={18} aria-hidden="true" /> {exito}
        </div>
      )}

      {error && (
        <div className="portal-alert portal-alert-danger" role="alert">
          <Ban size={18} aria-hidden="true" /> {error}
        </div>
      )}

      <div className="portal-subtabs">
        <button
          className={`portal-subtab-btn ${vista === 'usuarios' ? 'active' : ''}`}
          onClick={() => setVista('usuarios')}
        >
          <Users size={15} aria-hidden="true" /> Usuarios de la base de datos
        </button>
        <button
          className={`portal-subtab-btn ${vista === 'permisos' ? 'active' : ''}`}
          onClick={() => setVista('permisos')}
        >
          <ShieldCheck size={15} aria-hidden="true" /> Permisos y prohibiciones
        </button>
      </div>

      {vista === 'usuarios' ? (
        <>
          <div className="perfil-resumen-grid">
            <div className="perfil-resumen-card">
              <span className="perfil-resumen-icon is-success"><Users size={18} aria-hidden="true" /></span>
              <div><strong>{datos.resumen.activos}</strong><span>Perfiles activos</span></div>
            </div>
            <div className="perfil-resumen-card">
              <span className="perfil-resumen-icon is-muted"><Lock size={18} aria-hidden="true" /></span>
              <div><strong>{datos.resumen.inactivos}</strong><span>Perfiles desactivados</span></div>
            </div>
            <div className="perfil-resumen-card">
              <span className="perfil-resumen-icon is-info"><ShieldCheck size={18} aria-hidden="true" /></span>
              <div><strong>{datos.perfiles.length}</strong><span>Perfiles de rol disponibles</span></div>
            </div>
          </div>

          <section className="portal-card perfil-panel">
            <div className="perfil-toolbar">
              <label className="perfil-search">
                <Search size={16} aria-hidden="true" />
                <span className="sr-only">Buscar perfil</span>
                <input
                  type="search"
                  placeholder="Buscar por nombre o correo..."
                  value={busqueda}
                  onChange={event => setBusqueda(event.target.value)}
                />
              </label>

              <select
                className="perfil-select"
                value={filtroRol}
                onChange={event => setFiltroRol(event.target.value)}
                aria-label="Filtrar por perfil de rol"
              >
                <option value="TODOS">Todos los perfiles</option>
                {datos.perfiles.map(perfil => (
                  <option key={perfil.rol} value={perfil.rol}>{perfil.etiqueta}</option>
                ))}
              </select>

              <div className="perfil-estado-switch" role="group" aria-label="Filtrar por estado">
                <button
                  className={estadoPerfil === 'activos' ? 'active' : ''}
                  onClick={() => setEstadoPerfil('activos')}
                  aria-pressed={estadoPerfil === 'activos'}
                >
                  Activos ({datos.resumen.activos})
                </button>
                <button
                  className={estadoPerfil === 'inactivos' ? 'active' : ''}
                  onClick={() => setEstadoPerfil('inactivos')}
                  aria-pressed={estadoPerfil === 'inactivos'}
                >
                  Desactivados ({datos.resumen.inactivos})
                </button>
              </div>
            </div>

            <div className="perfil-table-wrap">
              <table className="perfil-table">
                <thead>
                  <tr>
                    <th scope="col">Perfil</th>
                    <th scope="col">Rol asignado</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Alta</th>
                    <th scope="col" className="is-actions">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {cargando ? (
                    <tr><td colSpan={5} className="perfil-empty">Cargando perfiles de usuario...</td></tr>
                  ) : usuariosFiltrados.length === 0 ? (
                    <tr><td colSpan={5} className="perfil-empty">
                      No hay perfiles que coincidan con los filtros seleccionados.
                    </td></tr>
                  ) : usuariosFiltrados.map(usuario => {
                    const esMiPerfil = usuario.email.toLowerCase() === user?.email?.toLowerCase();
                    return (
                      <tr key={usuario.email} className={!usuario.activo ? 'is-inactive' : undefined}>
                        <td>
                          <div className="perfil-user-cell">
                            <AvatarPerfil rol={usuario.rol} />
                            <div>
                              <strong>
                                {usuario.nombre}
                                {esMiPerfil && <span className="perfil-self-badge">Tu perfil</span>}
                              </strong>
                              <span><Mail size={12} aria-hidden="true" /> {usuario.email}</span>
                            </div>
                          </div>
                        </td>
                        <td><EtiquetaRol usuario={usuario} /></td>
                        <td>
                          <span className={`portal-badge ${usuario.activo ? 'portal-badge-success' : 'portal-badge-neutral'}`}>
                            {usuario.activo ? 'Activo' : 'Desactivado'}
                          </span>
                        </td>
                        <td className="perfil-date">{formatearFecha(usuario.creadoEn)}</td>
                        <td className="is-actions">
                          {usuario.activo ? (
                            <button
                              className="portal-btn portal-btn-danger perfil-delete-btn"
                              onClick={() => { setErrorAccion(''); setPerfilAEliminar(usuario); }}
                              disabled={esMiPerfil}
                              title={esMiPerfil ? 'No puedes eliminar tu propio perfil' : `Eliminar el perfil de ${usuario.nombre}`}
                            >
                              <Trash2 size={14} aria-hidden="true" /> Eliminar
                            </button>
                          ) : (
                            <span className="perfil-no-access"><Ban size={14} aria-hidden="true" /> Sin acceso</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section aria-label="Permisos y prohibiciones por perfil">
          <div className="portal-alert portal-alert-info perfil-info-note">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>Los permisos se aplican por rol y son validados por el servidor en cada operación. No es posible otorgar permisos individuales fuera del perfil asignado.</span>
          </div>

          <div className="perfil-role-grid">
            {datos.perfiles.map(perfil => (
              <article className="perfil-role-card" key={perfil.rol}>
                <div className="perfil-role-head">
                  <AvatarPerfil rol={perfil.rol} size={44} />
                  <div>
                    <h3>{perfil.etiqueta}</h3>
                    <p>{perfil.descripcion}</p>
                  </div>
                  <span className="portal-badge portal-badge-neutral">
                    {usuariosPorRol[perfil.rol] || 0} {usuariosPorRol[perfil.rol] === 1 ? 'usuario' : 'usuarios'}
                  </span>
                </div>
                <div className="perfil-role-columns">
                  <ListaPermisos items={perfil.permisos} tipo="permitido" />
                  <ListaPermisos items={perfil.prohibiciones} tipo="restringido" />
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {modalCrear && (
        <div
          className="perfil-modal-backdrop"
          onMouseDown={event => { if (event.target === event.currentTarget) cerrarModalCrear(); }}
        >
          <div className="perfil-modal" role="dialog" aria-modal="true" aria-labelledby="perfil-modal-title">
            <div className="perfil-modal-header">
              <div>
                <h3 id="perfil-modal-title"><UserPlus size={20} aria-hidden="true" /> Crear perfil de usuario</h3>
                <p>El perfil tendrá acceso inmediato con el rol y los permisos seleccionados.</p>
              </div>
              <button className="perfil-icon-btn" onClick={cerrarModalCrear} aria-label="Cerrar" disabled={guardando}>
                <X size={19} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={crearPerfil}>
              <div className="perfil-modal-body">
                {formError && (
                  <div className="portal-alert portal-alert-danger" role="alert">
                    <Ban size={17} aria-hidden="true" /> {formError}
                  </div>
                )}

                <div className="perfil-form-grid">
                  <label className="perfil-field">
                    <span>Nombre completo</span>
                    <input
                      type="text"
                      value={form.nombre}
                      onChange={event => setForm(actual => ({ ...actual, nombre: event.target.value }))}
                      maxLength={100}
                      autoComplete="name"
                      placeholder="Ej: Camila Rojas"
                      required
                    />
                  </label>

                  <label className="perfil-field">
                    <span>Correo electrónico</span>
                    <div className="perfil-input-icon">
                      <Mail size={15} aria-hidden="true" />
                      <input
                        type="email"
                        value={form.email}
                        onChange={event => setForm(actual => ({ ...actual, email: event.target.value }))}
                        maxLength={120}
                        autoComplete="email"
                        placeholder="nombre@huellas.cl"
                        required
                      />
                    </div>
                  </label>

                  <label className="perfil-field perfil-field-wide">
                    <span>Perfil de rol</span>
                    <select
                      value={form.rol}
                      onChange={event => setForm(actual => ({ ...actual, rol: event.target.value }))}
                    >
                      {datos.perfiles.map(perfil => (
                        <option key={perfil.rol} value={perfil.rol}>{perfil.etiqueta}</option>
                      ))}
                    </select>
                  </label>

                  <label className="perfil-field">
                    <span>Contraseña temporal</span>
                    <div className="perfil-input-icon">
                      <KeyRound size={15} aria-hidden="true" />
                      <input
                        type="password"
                        value={form.password}
                        onChange={event => setForm(actual => ({ ...actual, password: event.target.value }))}
                        minLength={8}
                        maxLength={72}
                        autoComplete="new-password"
                        placeholder="Mínimo 8 caracteres"
                        required
                      />
                    </div>
                  </label>

                  <label className="perfil-field">
                    <span>Confirmar contraseña</span>
                    <div className="perfil-input-icon">
                      <Lock size={15} aria-hidden="true" />
                      <input
                        type="password"
                        value={form.confirmar}
                        onChange={event => setForm(actual => ({ ...actual, confirmar: event.target.value }))}
                        minLength={8}
                        maxLength={72}
                        autoComplete="new-password"
                        placeholder="Repite la contraseña"
                        required
                      />
                    </div>
                  </label>
                </div>

                {perfilSeleccionado && (
                  <div className="perfil-preview">
                    <div className="perfil-preview-head">
                      <AvatarPerfil rol={perfilSeleccionado.rol} size={38} />
                      <div>
                        <strong>{perfilSeleccionado.etiqueta}</strong>
                        <span>{perfilSeleccionado.descripcion}</span>
                      </div>
                    </div>
                    <div className="perfil-role-columns">
                      <ListaPermisos items={perfilSeleccionado.permisos} tipo="permitido" />
                      <ListaPermisos items={perfilSeleccionado.prohibiciones} tipo="restringido" />
                    </div>
                  </div>
                )}
              </div>

              <div className="perfil-modal-footer">
                <button type="button" className="portal-btn portal-btn-secondary" onClick={cerrarModalCrear} disabled={guardando}>
                  Cancelar
                </button>
                <button type="submit" className="portal-btn portal-btn-primary" disabled={guardando}>
                  <UserPlus size={16} aria-hidden="true" /> {guardando ? 'Creando perfil...' : 'Crear perfil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {perfilAEliminar && (
        <div className="perfil-modal-backdrop">
          <div className="perfil-modal perfil-modal-small" role="alertdialog" aria-modal="true" aria-labelledby="perfil-eliminar-title">
            <div className="perfil-modal-header">
              <div>
                <h3 id="perfil-eliminar-title"><Trash2 size={20} aria-hidden="true" /> Eliminar perfil</h3>
                <p>Esta acción revoca el acceso de inmediato.</p>
              </div>
              <button className="perfil-icon-btn" onClick={() => setPerfilAEliminar(null)} aria-label="Cerrar" disabled={eliminando}>
                <X size={19} aria-hidden="true" />
              </button>
            </div>

            <div className="perfil-modal-body">
              {errorAccion && (
                <div className="portal-alert portal-alert-danger" role="alert">
                  <Ban size={17} aria-hidden="true" /> {errorAccion}
                </div>
              )}
              <div className="perfil-delete-summary">
                <AvatarPerfil rol={perfilAEliminar.rol} size={44} />
                <div>
                  <strong>{perfilAEliminar.nombre}</strong>
                  <span>{perfilAEliminar.email}</span>
                  <EtiquetaRol usuario={perfilAEliminar} />
                </div>
              </div>
              <p className="perfil-delete-note">
                El perfil dejará de aparecer entre los usuarios activos y no podrá iniciar sesión.
                Sus registros, turnos, movimientos y entradas de auditoría se conservarán.
              </p>
            </div>

            <div className="perfil-modal-footer">
              <button className="portal-btn portal-btn-secondary" onClick={() => setPerfilAEliminar(null)} disabled={eliminando}>
                Cancelar
              </button>
              <button className="portal-btn portal-btn-danger" onClick={eliminarPerfil} disabled={eliminando}>
                <Trash2 size={16} aria-hidden="true" /> {eliminando ? 'Eliminando...' : 'Eliminar perfil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
