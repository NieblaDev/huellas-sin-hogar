import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const normalizarTexto = (valor) => String(valor ?? '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const describirAnimal = (animal) => {
  if (!animal) return '';
  return [animal.especie, animal.sexo, animal.estadoSalud]
    .filter(Boolean)
    .join(' · ');
};

function AnimalAvatar({ animal, size = 38 }) {
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [animal?.fotoUrl]);

  const dimensiones = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '9px',
    background: '#eef3ec',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0
  };

  if (animal?.fotoUrl && !error) {
    return (
      <div style={dimensiones}>
        <img
          src={animal.fotoUrl}
          alt={animal.nombre}
          onError={() => setError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    );
  }

  return (
    <div style={dimensiones}>
      <span style={{ fontSize: size >= 38 ? '1.15rem' : '0.95rem' }}>🐾</span>
    </div>
  );
}

/**
 * Selector de animales con imagen, nombre y ubicación.
 * Emite el id como string para que sea compatible con los <select> actuales.
 */
export default function AnimalSelect({
  animales = [],
  value = '',
  onChange,
  placeholder = '— Seleccionar animal —',
  disabled = false,
  allowClear = false,
  clearLabel = 'Ninguno / Sin animal',
  emptyMessage = 'No hay animales disponibles',
  searchPlaceholder = 'Buscar por nombre, especie o canil...',
  id,
  name,
  style,
  className
}) {
  const generatedId = useId();
  const selectId = id || `animal-select-${generatedId}`;
  const listboxId = `${selectId}-listbox`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(-1);
  const [panelStyle, setPanelStyle] = useState({});

  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);

  const valorNormalizado = value === null || value === undefined ? '' : String(value);

  const seleccionado = useMemo(
    () => animales.find(a => String(a.id) === valorNormalizado) || null,
    [animales, valorNormalizado]
  );

  const filtrados = useMemo(() => {
    const busqueda = normalizarTexto(query).trim();
    if (!busqueda) return animales;

    return animales.filter(animal => {
      const campos = [
        animal.nombre,
        animal.codigo,
        animal.especie,
        animal.raza,
        animal.sexo,
        animal.estadoSalud,
        animal.canil?.nombre,
        animal.canil?.sector
      ];
      return campos.some(campo => normalizarTexto(campo).includes(busqueda));
    });
  }, [animales, query]);

  const opciones = useMemo(() => {
    const lista = filtrados.map(animal => ({
      tipo: 'animal',
      key: `animal-${animal.id}`,
      animal
    }));

    if (allowClear) {
      return [{ tipo: 'clear', key: 'clear' }, ...lista];
    }
    return lista;
  }, [allowClear, filtrados]);

  const actualizarPosicion = () => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const margen = 12;
    const ancho = Math.min(
      Math.max(rect.width, 300),
      Math.max(240, window.innerWidth - margen * 2)
    );
    const left = Math.min(
      Math.max(margen, rect.left),
      window.innerWidth - ancho - margen
    );

    const espacioAbajo = window.innerHeight - rect.bottom - margen;
    const espacioArriba = rect.top - margen;
    const abrirArriba = espacioAbajo < 260 && espacioArriba > espacioAbajo;
    const maxHeight = Math.max(
      140,
      Math.min(340, (abrirArriba ? espacioArriba : espacioAbajo) - 8)
    );

    setPanelStyle({
      position: 'fixed',
      left: `${left}px`,
      width: `${ancho}px`,
      zIndex: 2000,
      maxHeight: `${maxHeight}px`,
      ...(abrirArriba
        ? { bottom: `${window.innerHeight - rect.top + 8}px` }
        : { top: `${rect.bottom + 8}px` })
    });
  };

  const abrir = () => {
    if (disabled) return;
    setQuery('');
    setOpen(true);

    const indiceSeleccionado = animales.findIndex(a => String(a.id) === valorNormalizado);
    if (indiceSeleccionado >= 0) {
      setHighlighted(indiceSeleccionado + (allowClear ? 1 : 0));
    } else if (animales.length > 0) {
      setHighlighted(allowClear ? 1 : 0);
    } else {
      setHighlighted(allowClear ? 0 : -1);
    }
  };

  const alternar = () => {
    if (open) {
      setOpen(false);
    } else {
      abrir();
    }
  };

  const seleccionar = (opcion) => {
    if (!opcion) return;

    if (opcion.tipo === 'clear') {
      onChange?.('', null);
    } else {
      onChange?.(String(opcion.animal.id), opcion.animal);
    }

    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;

    actualizarPosicion();
    const manejarScroll = () => actualizarPosicion();

    window.addEventListener('resize', manejarScroll);
    window.addEventListener('scroll', manejarScroll, true);
    const foco = window.setTimeout(() => searchRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(foco);
      window.removeEventListener('resize', manejarScroll);
      window.removeEventListener('scroll', manejarScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const manejarClickExterior = (event) => {
      if (triggerRef.current?.contains(event.target)) return;
      if (panelRef.current?.contains(event.target)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', manejarClickExterior);
    return () => document.removeEventListener('mousedown', manejarClickExterior);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const manejarEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('keydown', manejarEscape);
    return () => document.removeEventListener('keydown', manejarEscape);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setHighlighted(opciones.length > 0 ? 0 : -1);
  }, [query]);

  useEffect(() => {
    if (!open || highlighted < 0) return;

    const lista = listRef.current;
    const opcion = lista?.querySelector(`[data-option-index="${highlighted}"]`);
    if (!lista || !opcion) return;

    const rectLista = lista.getBoundingClientRect();
    const rectOpcion = opcion.getBoundingClientRect();

    if (rectOpcion.top < rectLista.top) {
      lista.scrollTop -= rectLista.top - rectOpcion.top;
    } else if (rectOpcion.bottom > rectLista.bottom) {
      lista.scrollTop += rectOpcion.bottom - rectLista.bottom;
    }
  }, [highlighted, open]);

  const moverDestacado = (delta) => {
    if (opciones.length === 0) return;

    setHighlighted(actual => {
      let siguiente = actual + delta;
      if (siguiente < 0) siguiente = opciones.length - 1;
      if (siguiente >= opciones.length) siguiente = 0;
      return siguiente;
    });
  };

  const manejarTeclaBusqueda = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moverDestacado(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moverDestacado(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      seleccionar(opciones[highlighted]);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  const manejarTeclaTrigger = (event) => {
    if (open) return;
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      abrir();
    }
  };

  return (
    <div style={{ position: 'relative', ...style }} className={className}>
      <button
        ref={triggerRef}
        type="button"
        id={selectId}
        name={name}
        disabled={disabled}
        onClick={alternar}
        onKeyDown={manejarTeclaTrigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        style={{
          width: '100%',
          minHeight: '48px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '7px 12px',
          borderRadius: '8px',
          border: `1.5px solid ${open ? '#3f6c52' : '#e9eaed'}`,
          background: disabled ? '#f8f9fa' : '#fff',
          color: '#1f2430',
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          boxSizing: 'border-box',
          opacity: disabled ? 0.7 : 1
        }}
      >
        {seleccionado ? (
          <AnimalAvatar animal={seleccionado} size={34} />
        ) : (
          <div style={{
            width: '34px', height: '34px', borderRadius: '9px', background: '#f3f4f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            color: '#a3aab5'
          }}>
            🐾
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '0.86rem',
            fontWeight: seleccionado ? 800 : 600,
            color: seleccionado ? '#1f2430' : '#7c8592',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {seleccionado ? seleccionado.nombre : placeholder}
          </div>
          {seleccionado && (
            <div style={{
              fontSize: '0.72rem',
              color: '#7c8592',
              marginTop: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {describirAnimal(seleccionado)}
              {seleccionado.canil ? ` · ${seleccionado.canil.nombre}` : ' · Sin canil'}
            </div>
          )}
        </div>

        <span style={{
          color: '#7c8592',
          fontSize: '0.75rem',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.18s',
          flexShrink: 0
        }}>
          ▼
        </span>
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          onMouseDown={(event) => event.stopPropagation()}
          style={{
            ...panelStyle,
            background: '#fff',
            border: '1px solid #e1e5ea',
            borderRadius: '12px',
            boxShadow: '0 16px 38px rgba(20,24,32,0.22)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <div style={{ padding: '9px', borderBottom: '1px solid #f0f2f5' }}>
            <input
              ref={searchRef}
              type="text"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={manejarTeclaBusqueda}
              placeholder={searchPlaceholder}
              role="combobox"
              aria-expanded="true"
              aria-controls={listboxId}
              aria-activedescendant={highlighted >= 0 ? `${listboxId}-opcion-${highlighted}` : undefined}
              aria-label={searchPlaceholder}
              style={{
                width: '100%',
                padding: '8px 11px',
                borderRadius: '8px',
                border: '1.5px solid #e9eaed',
                boxSizing: 'border-box',
                fontSize: '0.84rem',
                color: '#1f2430'
              }}
            />
          </div>

          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Animales disponibles"
            style={{ overflowY: 'auto', padding: '6px', minHeight: 0, flex: 1 }}
          >
            {opciones.length === 0 ? (
              <div style={{ padding: '18px 12px', textAlign: 'center', color: '#7c8592', fontSize: '0.82rem' }}>
                {query.trim() ? 'No se encontraron animales con esa búsqueda.' : emptyMessage}
              </div>
            ) : (
              opciones.map((opcion, index) => {
                const estaDestacada = highlighted === index;

                if (opcion.tipo === 'clear') {
                  const estaSeleccionada = !seleccionado;
                  return (
                    <div
                      key={opcion.key}
                      id={`${listboxId}-opcion-${index}`}
                      data-option-index={index}
                      role="option"
                      aria-selected={estaSeleccionada}
                      onMouseEnter={() => setHighlighted(index)}
                      onClick={() => seleccionar(opcion)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '9px 10px',
                        borderRadius: '9px',
                        cursor: 'pointer',
                        background: estaDestacada ? '#eef3ec' : 'transparent',
                        border: `1px solid ${estaSeleccionada ? '#cfe0d3' : 'transparent'}`
                      }}
                    >
                      <div style={{
                        width: '38px', height: '38px', borderRadius: '9px', background: '#f3f4f6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        color: '#a3aab5', fontSize: '1.1rem'
                      }}>
                        ∅
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#555e6d' }}>
                          {clearLabel}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                          Se libera la selección de animal
                        </div>
                      </div>
                      {estaSeleccionada && (
                        <span style={{ color: '#3f6c52', fontWeight: 800 }}>✓</span>
                      )}
                    </div>
                  );
                }

                const animal = opcion.animal;
                const estaSeleccionado = String(animal.id) === valorNormalizado;

                return (
                  <div
                    key={opcion.key}
                    id={`${listboxId}-opcion-${index}`}
                    data-option-index={index}
                    role="option"
                    aria-selected={estaSeleccionado}
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => seleccionar(opcion)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '9px 10px',
                      borderRadius: '9px',
                      cursor: 'pointer',
                      background: estaDestacada ? '#eef3ec' : 'transparent',
                      border: `1px solid ${estaSeleccionado ? '#cfe0d3' : 'transparent'}`
                    }}
                  >
                    <AnimalAvatar animal={animal} size={38} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                        <strong style={{
                          fontSize: '0.86rem',
                          color: '#1f2430',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {animal.nombre}
                        </strong>
                        {estaSeleccionado && (
                          <span style={{
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            color: '#2f5540',
                            background: '#e8f0e8',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            flexShrink: 0
                          }}>
                            SELECCIONADO
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: '0.72rem',
                        color: '#7c8592',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {describirAnimal(animal)}
                        {animal.canil ? ` · 📍 ${animal.canil.nombre}` : ' · Sin canil'}
                      </div>
                    </div>

                    {estaSeleccionado && (
                      <span style={{ color: '#3f6c52', fontWeight: 800, flexShrink: 0 }}>✓</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
