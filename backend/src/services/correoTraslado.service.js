import nodemailer from 'nodemailer';
import prisma from '../config/prisma.js';
import { generarFichaExternaPDF } from './export.service.js';

const MAX_INTENTOS = 3;
const PLAZO_ENVIO_MS = 5 * 60_000;

export function prepararCorreoTraslado(traslado, from) {
  return {
    from,
    to: traslado.destinoEmail,
    subject: `Solicitud de traslado #${traslado.id} · ${traslado.animal.nombre}`,
    text: `Hola,\n\nHuellas Sin Hogar solicita coordinar el posible traslado de ${traslado.animal.nombre} a ${traslado.destinoNombre}. Adjuntamos su ficha en PDF.\n\nLa solicitud se registró pendiente de aprobación de Dirección. Este mensaje no confirma el traslado.\n\nHuellas Sin Hogar`,
    attachments: [{
      filename: `ficha-animal-${traslado.animal.id}.pdf`,
      content: generarFichaExternaPDF(traslado.animal),
      contentType: 'application/pdf'
    }]
  };
}

export async function procesarCorreo(transporte, from) {
  const ahora = new Date();
  const vencidos = { correoEstado: 'ENVIANDO', correoDisponibleEn: { lte: ahora } };
  await prisma.traslado.updateMany({
    where: { ...vencidos, correoIntentos: { gte: MAX_INTENTOS } },
    data: { correoEstado: 'FALLIDO', correoDisponibleEn: null }
  });

  const elegibles = {
    correoEstado: { in: ['PENDIENTE', 'ENVIANDO'] },
    correoDisponibleEn: { lte: ahora },
    correoIntentos: { lt: MAX_INTENTOS }
  };
  const traslado = await prisma.traslado.findFirst({
    where: elegibles, include: { animal: true }, orderBy: [{ correoDisponibleEn: 'asc' }, { id: 'asc' }]
  });
  if (!traslado) return;

  const intento = traslado.correoIntentos + 1;
  const reclamo = await prisma.traslado.updateMany({
    where: { ...elegibles, id: traslado.id, correoIntentos: traslado.correoIntentos },
    data: { correoEstado: 'ENVIANDO', correoIntentos: intento, correoDisponibleEn: new Date(Date.now() + PLAZO_ENVIO_MS) }
  });
  if (reclamo.count !== 1) return;

  const where = { id: traslado.id, correoEstado: 'ENVIANDO', correoIntentos: intento };
  try {
    const resultado = await transporte.sendMail(prepararCorreoTraslado(traslado, from));
    if (!resultado.accepted?.length) throw new Error('SMTP no aceptó el correo');
  } catch {
    await prisma.traslado.updateMany({
      where,
      data: {
        correoEstado: intento < MAX_INTENTOS ? 'PENDIENTE' : 'FALLIDO',
        correoDisponibleEn: intento < MAX_INTENTOS ? new Date(Date.now() + intento * 60_000) : null
      }
    });
    return;
  }

  await prisma.traslado.updateMany({
    where, data: { correoEstado: 'ENVIADO', correoEnviadoEn: new Date(), correoDisponibleEn: null }
  });
}

export function iniciarCorreoTraslados() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_FROM) return async () => {};

  const port = Number(SMTP_PORT || 587);
  const transporte = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000
  });

  let ejecucion;
  const revisar = () => {
    ejecucion ??= procesarCorreo(transporte, SMTP_FROM)
      .catch(error => console.error('Error al procesar correos de traslado:', error.code || error.name))
      .finally(() => { ejecucion = undefined; });
  };
  revisar();
  const intervalo = setInterval(revisar, 10_000);
  intervalo.unref();
  return async () => {
    clearInterval(intervalo);
    await ejecucion;
    transporte.close();
  };
}
