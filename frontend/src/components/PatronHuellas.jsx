import React from 'react';
import { PawPrint } from 'lucide-react';

export default function PatronHuellas() {
  return (
    <svg className="portal-patron-huellas" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="portal-huellas" width="146" height="132" patternUnits="userSpaceOnUse" patternTransform="rotate(-16)">
          <g transform="translate(24 16) rotate(-12 15 15)">
            <PawPrint size={30} strokeWidth={1.5} />
          </g>
          <g transform="translate(94 79) rotate(12 13 13)">
            <PawPrint size={26} strokeWidth={1.5} />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#portal-huellas)" />
    </svg>
  );
}
