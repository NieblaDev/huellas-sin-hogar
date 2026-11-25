import React from 'react';

export default function ErrorCampo({ error, id }) {
  const mensaje = typeof error === 'string' ? error : error?.message;
  return mensaje ? <span className="portal-error-campo" id={id} role="alert">{mensaje}</span> : null;
}
