import React, { useEffect, useMemo, useState } from 'react';
import { Bird, Cat, Check, Dog, PawPrint, Rabbit, Search } from 'lucide-react';

const SALUD = {
  NORMAL: { etiqueta: 'Salud normal', bg: '#e8f0e8', color: '#2f5540' },
  CONDICION_ESPECIAL: { etiqueta: 'Condición especial', bg: '#faf1de', color: '#b37416' },
  CRITICO: { etiqueta: 'Estado crítico', bg: '#fbeae8', color: '#d1453b' }
};

const normalizar = (valor) => String(valor ?? '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const iconoPorEspecie = (especie) => {
  const texto = normalizar(especie);
  if (texto.includes('perr') || texto.includes('canin')) return Dog;
  if (texto.includes('gat') || texto.includes('felin')) return Cat;
  if (texto.includes('conej')) return Rabbit;
  if (texto.includes('ave') || texto.includes('pajaro')) return Bird;
  return PawPrint;
};

function FotoAnimal({ animal }) {
  const [fallida, setFallida] = useState(false);
  useEffect(() => setFallida(false), [animal.fotoUrl]);
  const Icono = iconoPorEspecie(animal.especie);

  if (animal.fotoUrl && !fallida) {
    return (
      <img
        src={animal.fotoUrl}
        alt={`Fotografía de ${animal.nombre}`}
        loading="lazy"
        decoding="async"
        onError={() => setFallida(true)}
        className="adop-animal-foto"
      />
    );
  }
  return (
    <div className="adop-animal-foto adop-animal-sin-foto" role="img" aria-label={`${animal.nombre} (${animal.especie || 'animal'}) sin fotografía`}>
      <Icono size={38} aria-hidden="true" />
    </div>
  );
}

/**
 * Selector visual de animales: tarjetas con foto (o avatar por especie), nombre, especie y estado.
 * Emite el identificador como texto, igual que el selector anterior.
 */
export default function AnimalCardPicker({ animales = [], value = '', onChange, cargando = false, disabled = false }) {
  const [busqueda, setBusqueda] = useState('');
  const seleccionado = String(value ?? '');

  const visibles = useMemo(() => {
    const termino = normalizar(busqueda).trim();
    if (!termino) return animales;
    return animales.filter((animal) => [
      animal.nombre, animal.especie, animal.raza, animal.sexo, SALUD[animal.estadoSalud]?.etiqueta, animal.canil?.nombre
    ].some((campo) => normalizar(campo).includes(termino)));
  }, [animales, busqueda]);

  return (
    <div className="adop-picker">
      <div className="adop-picker-busqueda">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          onKeyDown={(evento) => { if (evento.key === 'Enter') evento.preventDefault(); }}
          placeholder="Buscar por nombre, especie o sexo"
          aria-label="Buscar animal"
          className="portal-input"
          disabled={disabled}
        />
      </div>

      {cargando ? (
        <p className="adop-picker-vacio" role="status">Cargando animales disponibles…</p>
      ) : visibles.length === 0 ? (
        <p className="adop-picker-vacio" role="status">
          {busqueda.trim() ? 'Ningún animal coincide con tu búsqueda.' : 'Por ahora no hay animales disponibles para adopción.'}
        </p>
      ) : (
        <div className="adop-picker-grilla" role="radiogroup" aria-label="Animales disponibles para adopción">
          {visibles.map((animal) => {
            const activo = String(animal.id) === seleccionado;
            const salud = SALUD[animal.estadoSalud];
            return (
              <button
                key={animal.id}
                type="button"
                role="radio"
                aria-checked={activo}
                disabled={disabled}
                onClick={() => onChange?.(String(animal.id), animal)}
                className={`adop-animal-tarjeta${activo ? ' activa' : ''}`}
              >
                <FotoAnimal animal={animal} />
                {activo && (
                  <span className="adop-animal-check" aria-hidden="true"><Check size={14} /></span>
                )}
                <span className="adop-animal-nombre">{animal.nombre}</span>
                <span className="adop-animal-detalle">
                  {[animal.especie, animal.sexo].filter(Boolean).join(' · ')}
                </span>
                {salud && (
                  <span className="adop-animal-estado" style={{ background: salud.bg, color: salud.color }}>
                    {salud.etiqueta}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
