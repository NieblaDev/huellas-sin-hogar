import QRCode from 'qrcode';
export const urlCanil = id => (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '') + '/caniles/' + id;
export async function imagenQr(id) {
  const svg = await QRCode.toString(urlCanil(id), { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
