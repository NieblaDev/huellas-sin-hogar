import React, { useState } from 'react';
import { PawPrint } from 'lucide-react';

export default function AnimalPhoto({ src, className = '' }) {
  const [fotoFallida, setFotoFallida] = useState(null);

  return (
    <div className={'portal-animal-photo ' + className}>
      {src && src !== fotoFallida ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFotoFallida(src)} />
      ) : (
        <PawPrint aria-hidden="true" />
      )}
    </div>
  );
}
