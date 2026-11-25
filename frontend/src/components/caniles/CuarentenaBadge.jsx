import React from 'react';
import { diasRestantesCuarentena } from '../../utils/dias';
export function textoCuarentena(q) {
  const n = diasRestantesCuarentena(q.fechaFinEstimada);
  if (n < 0) return 'Cuarentena vencida hace ' + Math.abs(n) + (n === -1 ? ' día' : ' días');
  return 'Cuarentena · ' + (n === 0 ? 'vence hoy' : n === 1 ? 'vence mañana' : 'quedan ' + n + ' días');
}
export default function CuarentenaBadge({ cuarentena }) {
  return cuarentena && <strong className="canil-cuarentena">{textoCuarentena(cuarentena)}</strong>;
}
