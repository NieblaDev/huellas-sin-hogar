import React, { useState, useEffect } from 'react';
import { API_URL } from '../api/config';

const INITIAL_FORM = {
  nombre: '',
  tipoIngreso: 'Rescate',
  especie: 'Perro',
  sexo: 'Macho',
  edad: '',
  raza: '',
  peso: '',
  chip: '',
  esterilizacion: 'Desconocido',
  comportamiento: '',
  estadoSalud: 'NORMAL',
  nota: '',
  canilId: ''
};

const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/jpg'];
const MAX_IMAGEN_MB = 10;

export default function AnimalFormModal({ isOpen, onClose, onSuccess, caniles = [] }) {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [fotoArchivo, setFotoArchivo] = useState(null);
  const [fotoPreview, setFotoPreview] = useState('');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Libera la URL temporal de la vista previa al cambiar o quitar la foto
  useEffect(() => {
    return () => {
      if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    };
  }, [fotoPreview]);

  if (!isOpen) return null;

  const quitarFoto = () => {
    setFotoArchivo(null);
    setFotoPreview('');
  };

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!TIPOS_IMAGEN.includes(file.type)) {
      setError('La fotografía debe estar en formato JPG o PNG.');
      return;
    }
    if (file.size > MAX_IMAGEN_MB * 1024 * 1024) {
      setError(`La fotografía es demasiado pesada. El tamaño máximo es ${MAX_IMAGEN_MB} MB.`);
      return;
    }

    setError(null);
    setFotoArchivo(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.nombre.trim()) {
      setError('Ingresa un nombre o identificador para el animal.');
      return;
    }
    if (
      !['perro', 'gato'].includes((formData.especie || '').toLowerCase()) ||
      !['macho', 'hembra'].includes((formData.sexo || '').toLowerCase())
    ) {
      setError('Debes especificar la especie (canina o felina) y el sexo del animal para completar el ingreso.');
      return;
    }

    setGuardando(true);
    try {
      // Los datos desconocidos simplemente no se envían: el sistema completa valores por defecto
      const body = new FormData();
      body.append('nombre', formData.nombre.trim());
      body.append('tipoIngreso', formData.tipoIngreso || 'Rescate');
      body.append('especie', formData.especie);
      body.append('sexo', formData.sexo);
      body.append('estadoSalud', formData.estadoSalud || 'NORMAL');

      const opcionales = {
        edad: formData.edad.trim(),
        raza: formData.raza.trim(),
        peso: formData.peso !== '' ? String(formData.peso) : '',
        chip: formData.chip.trim(),
        esterilizacion: formData.esterilizacion || '',
        comportamiento: formData.comportamiento.trim(),
        nota: formData.nota.trim(),
        canilId: formData.canilId ? String(formData.canilId) : ''
      };
      Object.entries(opcionales).forEach(([campo, valor]) => {
        if (valor !== '') body.append(campo, valor);
      });

      if (fotoArchivo) body.append('foto', fotoArchivo);

      // Nota: no se fija 'Content-Type' manualmente; el navegador agrega
      // 'multipart/form-data' junto con el "boundary" que Multer necesita.
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/animals`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msgDetalle = data.detalles?.map((d) => d.mensaje).join(' · ');
        throw new Error(msgDetalle || data.error || 'No pudimos registrar el ingreso. Inténtalo nuevamente.');
      }

      if (data.notificacion) {
        window.dispatchEvent(new CustomEvent('refugio:notificacion', { detail: data.notificacion }));
      }

      setFormData(INITIAL_FORM);
      quitarFoto();
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,24,32,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px'
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '26px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 16px 40px rgba(20,24,32,0.2)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <h3 style={{ margin: 0, color: '#1f2430', fontSize: '1.2rem', fontWeight: '800' }}>
              🐾 Registro de Ingreso y Creación de Ficha Técnica
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#7c8592' }}>
              Los antecedentes desconocidos son opcionales y no bloquean el registro.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#7c8592' }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            style={{
              color: '#d1453b',
              fontSize: '0.82rem',
              background: '#fbeae8',
              border: '1px solid #f3c9c4',
              padding: '10px 12px',
              borderRadius: '8px',
              marginBottom: '14px',
              fontWeight: '600'
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Fotografía con vista previa */}
          <div
            style={{
              marginBottom: '12px',
              padding: '10px 12px',
              border: '1.5px dashed #d6d9e0',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: '#fafbfc'
            }}
          >
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '10px',
                background: '#e8f0e8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0
              }}
            >
              {fotoPreview ? (
                <img src={fotoPreview} alt="Vista previa de la fotografía" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '1.6rem' }}>📷</span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                Fotografía del animal (opcional)
              </label>
              <input
                type="file"
                name="foto"
                accept="image/jpeg,image/png,image/jpg"
                onChange={handlePhoto}
                style={{ fontSize: '0.78rem', width: '100%' }}
              />
              <span style={{ display: 'block', fontSize: '0.7rem', color: '#a3aab5', marginTop: '3px' }}>
                {fotoArchivo ? fotoArchivo.name : 'Formatos JPG o PNG, hasta 10 MB.'}
              </span>
            </div>
            {fotoPreview && (
              <button
                type="button"
                onClick={quitarFoto}
                style={{
                  background: '#fbeae8',
                  color: '#d1453b',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Quitar
              </button>
            )}
          </div>

          {/* Nombre y Causal de Ingreso */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                Nombre / Identificador *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Toby, Rescate #12..."
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', boxSizing: 'border-box', borderRadius: '7px', border: '1.5px solid #e9eaed' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#1f2430', marginBottom: '4px' }}>
                Causal de Ingreso *
              </label>
              <select
                value={formData.tipoIngreso}
                onChange={(e) => setFormData({ ...formData, tipoIngreso: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1.5px solid #e9eaed', background: '#fff' }}
              >
                <option value="Rescate">Rescate</option>
                <option value="Abandono">Abandono</option>
                <option value="Decomiso">Decomiso</option>
              </select>
            </div>
          </div>

          {/* Especie y Sexo (Validación estricta) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              marginBottom: '12px',
              padding: '10px',
              background: '#eef3ec',
              borderRadius: '9px',
              border: '1px solid #c9dfcd'
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '800', color: '#2f5540', marginBottom: '4px' }}>
                Especie (Canina / Felina) *
              </label>
              <select
                value={formData.especie}
                onChange={(e) => setFormData({ ...formData, especie: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1.5px solid #c9dfcd', background: '#fff', fontWeight: '700' }}
              >
                <option value="Perro">Perro (Canina)</option>
                <option value="Gato">Gato (Felina)</option>
                <option value="">— Selecciona la especie —</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '800', color: '#2f5540', marginBottom: '4px' }}>
                Sexo *
              </label>
              <select
                value={formData.sexo}
                onChange={(e) => setFormData({ ...formData, sexo: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1.5px solid #c9dfcd', background: '#fff', fontWeight: '700' }}
              >
                <option value="Macho">Macho</option>
                <option value="Hembra">Hembra</option>
                <option value="">— Selecciona el sexo —</option>
              </select>
            </div>
          </div>

          {/* Antecedentes Opcionales / Anulables */}
          <div style={{ fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', color: '#7c8592', marginBottom: '6px' }}>
            Antecedentes Físicos y Clínicos (Opcionales si se desconocen)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#7c8592', marginBottom: '3px' }}>
                Edad aprox. (Opcional)
              </label>
              <input
                type="text"
                placeholder="Desconocida"
                value={formData.edad}
                onChange={(e) => setFormData({ ...formData, edad: e.target.value })}
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '6px', border: '1.5px solid #e9eaed' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#7c8592', marginBottom: '3px' }}>
                Raza (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: Mestizo / Desconocida"
                value={formData.raza}
                onChange={(e) => setFormData({ ...formData, raza: e.target.value })}
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '6px', border: '1.5px solid #e9eaed' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#7c8592', marginBottom: '3px' }}>
                Peso kg (Opcional)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                placeholder="No disponible"
                value={formData.peso}
                onChange={(e) => setFormData({ ...formData, peso: e.target.value })}
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '6px', border: '1.5px solid #e9eaed' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#7c8592', marginBottom: '3px' }}>
                Microchip (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: ES-4471120 o vacío"
                value={formData.chip}
                onChange={(e) => setFormData({ ...formData, chip: e.target.value })}
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '6px', border: '1.5px solid #e9eaed' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#7c8592', marginBottom: '3px' }}>
                Esterilización (Opcional)
              </label>
              <select
                value={formData.esterilizacion}
                onChange={(e) => setFormData({ ...formData, esterilizacion: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1.5px solid #e9eaed', background: '#fff' }}
              >
                <option value="Desconocido">Desconocido / Sin antecedentes</option>
                <option value="NO">No esterilizado/a</option>
                <option value="SÍ (Operado/a)">Sí (Esterilizado/a)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#7c8592', marginBottom: '3px' }}>
                Estado de Salud Inicial
              </label>
              <select
                value={formData.estadoSalud}
                onChange={(e) => setFormData({ ...formData, estadoSalud: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1.5px solid #e9eaed', background: '#fff' }}
              >
                <option value="NORMAL">🟢 Normal</option>
                <option value="CONDICION_ESPECIAL">🟡 Condición Especial</option>
                <option value="CRITICO">🔴 Crítico</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#7c8592', marginBottom: '3px' }}>
                Canil Inicial (Opcional)
              </label>
              <select
                value={formData.canilId}
                onChange={(e) => setFormData({ ...formData, canilId: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1.5px solid #e9eaed', background: '#fff' }}
              >
                <option value="">— Sin asignar —</option>
                {caniles
                  .filter((c) => c.estado === 'LIBRE')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.sector})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#7c8592', marginBottom: '3px' }}>
              Comportamiento Observado (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Dócil, asustadizo, por evaluar..."
              value={formData.comportamiento}
              onChange={(e) => setFormData({ ...formData, comportamiento: e.target.value })}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '6px', border: '1.5px solid #e9eaed' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#7c8592', marginBottom: '3px' }}>
              Historial Médico / Antecedentes al Ingreso (Opcional)
            </label>
            <textarea
              rows={3}
              placeholder="Deja en blanco si no se cuenta con historial médico o antecedentes previos..."
              value={formData.nota}
              onChange={(e) => setFormData({ ...formData, nota: e.target.value })}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '6px', border: '1.5px solid #e9eaed' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 14px',
                background: '#f8f9fa',
                border: '1px solid #e9eaed',
                borderRadius: '7px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              style={{
                padding: '9px 18px',
                background: '#3f6c52',
                color: '#fff',
                border: 'none',
                borderRadius: '7px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {guardando ? 'Registrando ficha...' : 'Guardar Ficha Técnica'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}