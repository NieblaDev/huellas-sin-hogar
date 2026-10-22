export const clearStoredSession = storage => {
  storage.removeItem('user');
  storage.removeItem('token');
};

export const readStoredSession = (storage, now = Date.now()) => {
  try {
    const saved = storage.getItem('user');
    const token = storage.getItem('token');
    if (!saved || !token) {
      clearStoredSession(storage);
      return null;
    }
    const user = JSON.parse(saved);
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Token inválido');
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
    if (!Number.isInteger(user?.id) || user.id <= 0 || typeof user.nombre !== 'string' || typeof user.rol !== 'string'
      || payload.id !== user.id || !Number.isFinite(payload.exp) || payload.exp * 1000 <= now) {
      throw new Error('Sesión inválida o expirada');
    }
    // Esto solo comprueba el formato; el servidor verifica la firma del token.
    return { user, token };
  } catch {
    try { clearStoredSession(storage); } catch { /* El navegador puede bloquear el almacenamiento. */ }
    return null;
  }
};
