const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, '');

export function request(path, { params, json, token = localStorage.getItem('token'), ...options } = {}) {
  if (!baseUrl) throw new Error('Define VITE_API_URL para conectar con el servidor.');

  const query = params ? new URLSearchParams(params).toString() : '';
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
    options.body = JSON.stringify(json);
  }
  return fetch(`${baseUrl}${path}${query ? `?${query}` : ''}`, { ...options, headers });
}
