import Button from './ui/Button.jsx';
import React, { useEffect, useRef, useState } from 'react';

const RESOLUCION = 800;

function dibujarRecorte(canvas, imagen, zoom, horizontal, vertical) {
  const contexto = canvas.getContext('2d');
  if (!contexto) return false;

  const lado = Math.min(imagen.naturalWidth, imagen.naturalHeight) / zoom;
  const x = (imagen.naturalWidth - lado) * horizontal / 100;
  const y = (imagen.naturalHeight - lado) * vertical / 100;

  contexto.fillStyle = '#fff';
  contexto.fillRect(0, 0, canvas.width, canvas.height);
  contexto.imageSmoothingQuality = 'high';
  contexto.drawImage(imagen, x, y, lado, lado, 0, 0, canvas.width, canvas.height);
  return true;
}

export default function AnimalPhotoCrop({ archivo, onCancel, onConfirm }) {
  const vista = useRef(null);
  const [imagen, setImagen] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [horizontal, setHorizontal] = useState(50);
  const [vertical, setVertical] = useState(50);
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(archivo);
    const foto = new Image();
    foto.onload = () => setImagen(foto);
    foto.onerror = () => setError('No pudimos abrir esta imagen. Prueba con otro archivo JPG o PNG.');
    foto.src = url;
    return () => {
      foto.onload = null;
      foto.onerror = null;
      URL.revokeObjectURL(url);
    };
  }, [archivo]);

  useEffect(() => {
    if (imagen && vista.current) dibujarRecorte(vista.current, imagen, zoom, horizontal, vertical);
  }, [imagen, zoom, horizontal, vertical]);

  const aplicar = () => {
    if (!imagen || procesando) return;
    const lienzo = document.createElement('canvas');
    lienzo.width = RESOLUCION;
    lienzo.height = RESOLUCION;
    if (!dibujarRecorte(lienzo, imagen, zoom, horizontal, vertical)) {
      setError('No pudimos preparar la imagen. Prueba con otro navegador.');
      return;
    }

    const vistaActual = vista.current;
    setProcesando(true);
    lienzo.toBlob(blob => {
      if (!vistaActual?.isConnected) return;
      setProcesando(false);
      if (!blob || blob.type !== 'image/jpeg') {
        setError('No pudimos guardar el recorte. Inténtalo nuevamente.');
        return;
      }
      const nombre = archivo.name.replace(/\.[^.]+$/, '');
      onConfirm(new File([blob], `${nombre}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.82);
  };

  return (
    <fieldset className="portal-photo-crop">
      <legend>Recortar foto</legend>
      {error && <p role="alert" className="portal-alert portal-alert-danger">{error}</p>}
      {!imagen && !error && <p role="status">Cargando foto…</p>}
      {imagen && (
        <div className="portal-photo-crop-layout">
          <canvas ref={vista} width={320} height={320} role="img" aria-label="Vista previa del recorte cuadrado" />
          <div className="portal-photo-crop-controls">
            <label>Acercar
              <input type="range" min={1} max={3} step={0.01} value={zoom} disabled={procesando}
                onChange={e => setZoom(Number(e.target.value))} />
            </label>
            <label>Posición horizontal
              <input type="range" min={0} max={100} value={horizontal}
                disabled={procesando || (zoom === 1 && imagen.naturalWidth <= imagen.naturalHeight)}
                onChange={e => setHorizontal(Number(e.target.value))} />
            </label>
            <label>Posición vertical
              <input type="range" min={0} max={100} value={vertical}
                disabled={procesando || (zoom === 1 && imagen.naturalHeight <= imagen.naturalWidth)}
                onChange={e => setVertical(Number(e.target.value))} />
            </label>
          </div>
        </div>
      )}
      <div className="portal-photo-crop-actions">
        <Button type="button" className="portal-btn portal-btn-secondary" onClick={onCancel}>Cancelar recorte</Button>
        <Button type="button" className="portal-btn portal-btn-primary" disabled={!imagen || procesando} onClick={aplicar}>
          {procesando ? 'Preparando foto…' : 'Usar recorte'}
        </Button>
      </div>
    </fieldset>
  );
}
