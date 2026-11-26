import { ErrorDominio } from '../utils/errorDominio.js';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import prisma from '../config/prisma.js';
import { etiquetaRolUsuario } from '../constants/usuarios.js';
import { registrarAuditoria } from './audit.service.js';
import { notificarPersonalRefugio } from './notification.service.js';
import { uploadsPath } from './foto.service.js';

const REGEX_TIPO_INGRESO = /^\[Ingreso por (Rescate|Abandono|Decomiso)\]\s*/i;

/**
 * predictor Paeth estándar de la especificación PNG (RFC 2083)
 */
const paethPredictor = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
};

/**
 * Obtiene y decodifica la fotografía del animal desde `uploads/` (o data URI)
 * para incrustarla como XObject de imagen en el documento PDF 1.4.
 * Si el animal no tiene foto o el archivo físico no existe, retorna `null` de forma segura.
 */
const extraerImagenPDFXObject = (fotoUrl) => {
  try {
    if (!fotoUrl || typeof fotoUrl !== 'string') return null;

    let imgBuffer = null;

    if (fotoUrl.startsWith('data:image/')) {
      const commaIdx = fotoUrl.indexOf(',');
      if (commaIdx !== -1) {
        imgBuffer = Buffer.from(fotoUrl.slice(commaIdx + 1), 'base64');
      }
    } else {
      let filename = '';
      const fotoLocal = fotoUrl.match(/\/(?:uploads|api\/(?:animales|animals)\/fotos)\/([^/?#]+)(?:[?#]|$)/);
      if (fotoLocal) {
        filename = decodeURIComponent(fotoLocal[1]);
      } else if (!fotoUrl.startsWith('http://') && !fotoUrl.startsWith('https://')) {
        filename = decodeURIComponent(fotoUrl.split('?')[0]);
      }

      const cleanBase = path.basename(filename);
      if (cleanBase) {
        const localFilePath = path.join(uploadsPath, cleanBase);
        if (fs.existsSync(localFilePath)) {
          imgBuffer = fs.readFileSync(localFilePath);
        }
      }
    }

    if (!imgBuffer || imgBuffer.length < 24) return null;

    // 1. Formato JPEG (SOI 0xFFD8) -> soportado nativamente por PDF con /DCTDecode
    if (imgBuffer[0] === 0xff && imgBuffer[1] === 0xd8) {
      let pos = 2;
      while (pos + 9 < imgBuffer.length) {
        if (imgBuffer[pos] !== 0xff) {
          pos++;
          continue;
        }
        const marker = imgBuffer[pos + 1];
        if (marker === 0xff) {
          pos++;
          continue;
        }
        if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
          pos += 2;
          continue;
        }
        const segLen = imgBuffer.readUInt16BE(pos + 2);
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2 || marker === 0xc3) {
          const height = imgBuffer.readUInt16BE(pos + 5);
          const width = imgBuffer.readUInt16BE(pos + 7);
          const channels = imgBuffer[pos + 9];
          if (width > 0 && height > 0) {
            const colorSpace =
              channels === 1 ? '/DeviceGray' : channels === 4 ? '/DeviceCMYK' : '/DeviceRGB';
            return {
              width,
              height,
              colorSpace,
              filter: '/DCTDecode',
              bitsPerComponent: 8,
              streamBuffer: imgBuffer
            };
          }
        }
        if (segLen < 2) break;
        pos += 2 + segLen;
      }
      return null;
    }

    // 2. Formato PNG (89 50 4E 47 0D 0A 1A 0A) -> decodificar scanlines y comprimir con /FlateDecode
    if (
      imgBuffer[0] === 0x89 &&
      imgBuffer[1] === 0x50 &&
      imgBuffer[2] === 0x4e &&
      imgBuffer[3] === 0x47
    ) {
      const width = imgBuffer.readUInt32BE(16);
      const height = imgBuffer.readUInt32BE(20);
      const bitDepth = imgBuffer[24];
      const colorType = imgBuffer[25];
      const interlace = imgBuffer[28];

      if (width <= 0 || height <= 0 || bitDepth !== 8 || interlace !== 0) {
        return null;
      }

      const idatChunks = [];
      let palette = null;
      let trns = null;
      let offset = 8;

      while (offset + 8 <= imgBuffer.length) {
        const length = imgBuffer.readUInt32BE(offset);
        const type = imgBuffer.toString('ascii', offset + 4, offset + 8);
        const dataStart = offset + 8;
        const dataEnd = dataStart + length;
        if (dataEnd > imgBuffer.length) break;

        if (type === 'PLTE') {
          palette = imgBuffer.subarray(dataStart, dataEnd);
        } else if (type === 'tRNS') {
          trns = imgBuffer.subarray(dataStart, dataEnd);
        } else if (type === 'IDAT') {
          idatChunks.push(imgBuffer.subarray(dataStart, dataEnd));
        } else if (type === 'IEND') {
          break;
        }
        offset = dataEnd + 4;
      }

      if (idatChunks.length === 0) return null;

      const samplesPerPixel =
        colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
      const bpp = samplesPerPixel;
      const rowBytes = width * samplesPerPixel;
      const rawData = zlib.inflateSync(Buffer.concat(idatChunks));

      if (rawData.length < height * (1 + rowBytes)) return null;

      const prevRow = Buffer.alloc(rowBytes);
      const currRow = Buffer.alloc(rowBytes);
      const rgbBuffer = Buffer.alloc(width * height * 3);

      for (let y = 0; y < height; y++) {
        const rowStart = y * (1 + rowBytes);
        const filterType = rawData[rowStart];

        for (let x = 0; x < rowBytes; x++) {
          const rawByte = rawData[rowStart + 1 + x];
          const left = x >= bpp ? currRow[x - bpp] : 0;
          const up = prevRow[x];
          const upLeft = x >= bpp ? prevRow[x - bpp] : 0;

          if (filterType === 0) currRow[x] = rawByte;
          else if (filterType === 1) currRow[x] = (rawByte + left) & 0xff;
          else if (filterType === 2) currRow[x] = (rawByte + up) & 0xff;
          else if (filterType === 3) currRow[x] = (rawByte + ((left + up) >> 1)) & 0xff;
          else if (filterType === 4) currRow[x] = (rawByte + paethPredictor(left, up, upLeft)) & 0xff;
          else currRow[x] = rawByte;
        }

        currRow.copy(prevRow);

        for (let px = 0; px < width; px++) {
          const outIdx = (y * width + px) * 3;
          if (colorType === 2) {
            rgbBuffer[outIdx] = currRow[px * 3];
            rgbBuffer[outIdx + 1] = currRow[px * 3 + 1];
            rgbBuffer[outIdx + 2] = currRow[px * 3 + 2];
          } else if (colorType === 6) {
            const r = currRow[px * 4];
            const g = currRow[px * 4 + 1];
            const b = currRow[px * 4 + 2];
            const a = currRow[px * 4 + 3] / 255;
            rgbBuffer[outIdx] = Math.round(r * a + 255 * (1 - a));
            rgbBuffer[outIdx + 1] = Math.round(g * a + 255 * (1 - a));
            rgbBuffer[outIdx + 2] = Math.round(b * a + 255 * (1 - a));
          } else if (colorType === 0) {
            const gray = currRow[px];
            rgbBuffer[outIdx] = gray;
            rgbBuffer[outIdx + 1] = gray;
            rgbBuffer[outIdx + 2] = gray;
          } else if (colorType === 4) {
            const gray = currRow[px * 2];
            const a = currRow[px * 2 + 1] / 255;
            const blended = Math.round(gray * a + 255 * (1 - a));
            rgbBuffer[outIdx] = blended;
            rgbBuffer[outIdx + 1] = blended;
            rgbBuffer[outIdx + 2] = blended;
          } else if (colorType === 3 && palette) {
            const idx = currRow[px];
            const r = palette[idx * 3] ?? 255;
            const g = palette[idx * 3 + 1] ?? 255;
            const b = palette[idx * 3 + 2] ?? 255;
            const a = trns && idx < trns.length ? trns[idx] / 255 : 1;
            rgbBuffer[outIdx] = Math.round(r * a + 255 * (1 - a));
            rgbBuffer[outIdx + 1] = Math.round(g * a + 255 * (1 - a));
            rgbBuffer[outIdx + 2] = Math.round(b * a + 255 * (1 - a));
          }
        }
      }

      const compressed = zlib.deflateSync(rgbBuffer);
      return {
        width,
        height,
        colorSpace: '/DeviceRGB',
        filter: '/FlateDecode',
        bitsPerComponent: 8,
        streamBuffer: compressed
      };
    }

    return null;
  } catch (err) {
    // Nunca fallar la generación del PDF si la imagen está corrupta o inaccesible
    return null;
  }
};

/**
 * Escapa texto para sintaxis PDF literal string (...) y normaliza caracteres fuera de Latin-1
 */
const escapePdfText = (text = '') => {
  return String(text ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\xFF]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
};

/**
 * Envuelve texto largo en múltiples líneas de máximo `maxChars` caracteres
 */
const wrapText = (text = '', maxChars = 82) => {
  const clean = String(text ?? '').replace(/\r/g, '');
  const paragraphs = clean.split('\n');
  const lines = [];

  for (const p of paragraphs) {
    const words = p.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      if ((currentLine + ' ' + words[i]).length <= maxChars) {
        currentLine += ' ' + words[i];
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    lines.push(currentLine);
  }
  return lines;
};

/**
 * Construye un documento binario válido en formato PDF 1.4 incluyendo la fotografía del animal
 * con dimensiones proporcionales (o un recuadro placeholder seguro si no tiene foto registrada).
 */
const construirBufferPDF = ({ animal, tipoIngreso, notaClinica, fechaGeneracion }) => {
  let ops = [];
  const paginas = [ops];
  const imagenPDF = extraerImagenPDFXObject(animal.fotoUrl);
  const verde = '0.20 0.33 0.16';
  const tinta = '0.13 0.17 0.14';
  const gris = '0.30 0.36 0.32';
  const escribir = (x, y, texto, size = 11, fuente = 'F1', color = tinta) =>
    ops.push(`${color} rg BT /${fuente} ${size} Tf ${x} ${y} Td (${escapePdfText(texto)}) Tj ET`);
  const linea = y => ops.push(`0.81 0.86 0.78 RG 0.7 w 40 ${y} m 555 ${y} l S`);
  const pie = () => {
    linea(62);
    escribir(40, 46, 'Por protección de datos personales, se omite la información de contacto de los postulantes.', 9, 'F1', gris);
    escribir(40, 30, 'Huellas Sin Hogar', 9, 'F2', verde);
    escribir(515, 30, String(paginas.length), 9, 'F1', gris);
  };

  ops.push(`${verde} rg 0 751 595 91 re f`);
  const huella = [
    '7 4 m 7 8 12 12 15 12 c 18 12 23 8 23 4 c 23 0 19 0 15 2 c 11 0 7 0 7 4 c h',
    '3 9 m -1 12 0 18 3 18 c 7 19 9 12 6 9 c 5 8 4 8 3 9 c h',
    '9 15 m 6 17 7 24 10 24 c 14 24 15 17 12 15 c 11 14 10 14 9 15 c h',
    '18 15 m 15 17 16 24 20 24 c 23 24 24 17 21 15 c 20 14 19 14 18 15 c h',
    '24 9 m 21 12 23 19 27 18 c 30 18 31 12 27 9 c 26 8 25 8 24 9 c h'
  ].join(' ');
  ops.push(
    `q 0.36 0.49 0.29 rg 0.79 0.25 -0.25 0.79 501 769 cm ${huella} f Q`,
    `q 0.36 0.49 0.29 rg 1.10 0.24 -0.24 1.10 544 789 cm ${huella} f Q`
  );
  escribir(40, 799, 'HUELLAS SIN HOGAR', 17, 'F2', '1 1 1');
  escribir(40, 775, 'Ficha de presentación para adopción y acogida', 12, 'F1', '1 1 1');
  escribir(419, 799, fechaGeneracion, 9, 'F1', '1 1 1');

  // Un solo factor de escala conserva el encuadre completo en fotos verticales y horizontales.
  const foto = { x: 40, y: 495, ancho: 242, alto: 236 };
  ops.push(`0.95 0.97 0.92 rg ${foto.x} ${foto.y} ${foto.ancho} ${foto.alto} re f`);
  if (imagenPDF) {
    const escala = Math.min(foto.ancho / imagenPDF.width, foto.alto / imagenPDF.height);
    const ancho = imagenPDF.width * escala;
    const alto = imagenPDF.height * escala;
    const x = foto.x + (foto.ancho - ancho) / 2;
    const y = foto.y + (foto.alto - alto) / 2;
    ops.push(`q ${ancho} 0 0 ${alto} ${x} ${y} cm /Im1 Do Q`);
  } else {
    escribir(99, 610, 'Sin fotografía registrada', 11, 'F1', gris);
  }

  let y = 706;
  const lineas = (texto, limite) => wrapText(String(texto).replace(new RegExp('(\\S{' + limite + '})(?=\\S)', 'g'), '$1 '), limite);
  for (const nombre of lineas(animal.nombre || 'Sin nombre', 16)) {
    escribir(305, y, nombre, 21, 'F2', verde);
    y -= 24;
  }
  y -= 4;
  const datos = [
    ['Especie', animal.especie], ['Sexo', animal.sexo], ['Edad', animal.edad],
    ['Raza', animal.raza], ['Peso', animal.peso > 0 ? `${animal.peso} kg` : null],
    ['Ingreso', tipoIngreso], ['Adopción', animal.estadoAdopcion === 'ADOPTADO' ? 'Adoptado' : 'En refugio']
  ];
  for (const [etiqueta, valor] of datos) {
    escribir(305, y, etiqueta, 10, 'F2', gris);
    for (const parte of lineas(valor || 'Sin registrar', 24)) {
      escribir(369, y, parte, 10);
      y -= 13;
    }
    y -= 5;
  }
  y = Math.min(y, foto.y) - 32;
  const espacio = alto => {
    if (y - alto >= 78) return;
    pie();
    ops = [];
    paginas.push(ops);
    escribir(40, 790, 'Huellas Sin Hogar · Ficha de presentación', 12, 'F2', verde);
    linea(775);
    y = 750;
  };
  const seccion = titulo => {
    espacio(57);
    linea(y + 13);
    escribir(40, y - 6, titulo, 15, 'F2', verde);
    y -= 30;
  };
  const dato = (etiqueta, contenido) => {
    espacio(33);
    escribir(40, y, etiqueta, 10, 'F2', gris);
    y -= 15;
    for (const parte of lineas(contenido, 75)) {
      espacio(15);
      escribir(40, y, parte);
      y -= 15;
    }
    y -= 9;
  };
  seccion('Salud y convivencia');
  const salud = { NORMAL: 'Normal', ESPECIAL: 'Especial', CRITICO: 'Crítico' };
  dato('Estado de salud y esterilización', `${salud[animal.estadoSalud] || 'Sin registrar'} · Esterilización: ${animal.esterilizacion || 'Sin registrar'}`);
  dato('Comportamiento', animal.comportamiento || 'Por evaluar');
  dato('Notas y observaciones', /^Sin antecedentes (clínicos|médicos) registrados/i.test(notaClinica || '') ? 'Sin Observaciones' : notaClinica || 'Sin Observaciones');
  const fecha = valor => new Date(valor).toLocaleDateString('es-CL', { timeZone: 'UTC' });
  seccion('Historial de vacunas');
  for (const vacuna of animal.vacunas ?? []) {
    dato(vacuna.nombreVacuna, `${vacuna.dosis} · Aplicada el ${fecha(vacuna.fechaAplicacion)} · Vence el ${fecha(vacuna.fechaVencimiento)}`);
  }
  if (!animal.vacunas?.length) dato('Vacunas', 'Sin vacunas registradas.');

  seccion('Historial médico');
  for (const atencion of animal.atencionesClinicas ?? []) {
    dato(`Atención del ${fecha(atencion.fechaAtencion)}`, `${atencion.motivo}\nDiagnóstico: ${atencion.diagnostico}`);
  }
  for (const tratamiento of animal.tratamientos ?? []) {
    dato(tratamiento.medicamento,
      `${tratamiento.dosis} cada ${tratamiento.frecuenciaHoras} horas · Del ${fecha(tratamiento.fechaInicio)} al ${fecha(tratamiento.fechaFin)}` +
      (tratamiento.indicacionesExtra ? `\n${tratamiento.indicacionesExtra}` : ''));
  }
  if (!animal.atencionesClinicas?.length && !animal.tratamientos?.length) {
    dato('Atenciones y tratamientos', 'Sin registros médicos.');
  }
  y -= 8;
  seccion('Adopciones y devoluciones');
  if (!animal.adopciones?.length) escribir(40, y, 'Sin procesos de adopción registrados.');
  for (const ad of (animal.adopciones || []).slice(0, 4)) {
    dato(ad.fecha ? new Date(ad.fecha).toLocaleDateString('es-CL') : 'Fecha sin registrar',
      `${ad.etapa} · Devolución: ${ad.devolucion ? 'Sí' : 'No'}`);
  }
  pie();

  const streamContent = Buffer.from(paginas[0].join('\n'), 'latin1');

  const xObjectResource = imagenPDF ? ' /XObject << /Im1 7 0 R >>' : '';
  const objectBuffers = [
    Buffer.from('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n', 'latin1'),
    Buffer.from('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n', 'latin1'),
    Buffer.from(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >>${xObjectResource} >> /Contents 6 0 R >>\nendobj\n`,
      'latin1'
    ),
    Buffer.from(
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n',
      'latin1'
    ),
    Buffer.from(
      '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n',
      'latin1'
    ),
    Buffer.concat([
      Buffer.from(`6 0 obj\n<< /Length ${streamContent.length} >>\nstream\n`, 'latin1'),
      streamContent,
      Buffer.from('\nendstream\nendobj\n', 'latin1')
    ])
  ];

  if (imagenPDF) {
    const imgHeader = Buffer.from(
      `7 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imagenPDF.width} /Height ${imagenPDF.height} /ColorSpace ${imagenPDF.colorSpace} /BitsPerComponent ${imagenPDF.bitsPerComponent} /Filter ${imagenPDF.filter} /Length ${imagenPDF.streamBuffer.length} >>\nstream\n`,
      'latin1'
    );
    const imgFooter = Buffer.from('\nendstream\nendobj\n', 'latin1');
    objectBuffers.push(Buffer.concat([imgHeader, imagenPDF.streamBuffer, imgFooter]));
  }

  const indicesPaginas = [3];
  for (const instrucciones of paginas.slice(1)) {
    const pagina = objectBuffers.length + 1;
    indicesPaginas.push(pagina);
    const contenido = Buffer.from(instrucciones.join('\n'), 'latin1');
    objectBuffers.push(
      Buffer.from(`${pagina} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents ${pagina + 1} 0 R >>\nendobj\n`),
      Buffer.concat([Buffer.from(`${pagina + 1} 0 obj\n<< /Length ${contenido.length} >>\nstream\n`), contenido, Buffer.from('\nendstream\nendobj\n')])
    );
  }
  objectBuffers[1] = Buffer.from(`2 0 obj\n<< /Type /Pages /Kids [${indicesPaginas.map(id => id + ' 0 R').join(' ')}] /Count ${paginas.length} >>\nendobj\n`);
  const chunks = [Buffer.from('%PDF-1.4\n', 'latin1')];
  let currentOffset = chunks[0].length;
  const offsets = [0];

  for (const objBuf of objectBuffers) {
    offsets.push(currentOffset);
    chunks.push(objBuf);
    currentOffset += objBuf.length;
  }

  const xrefOffset = currentOffset;
  let trailerStr = `xref\n0 ${objectBuffers.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objectBuffers.length; i++) {
    trailerStr += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  trailerStr += `trailer\n<< /Size ${objectBuffers.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(trailerStr, 'latin1'));

  return Buffer.concat(chunks);
};

/**
 * Construye un PDF de Reporte Consolidado de Gestión Operativa
 */
const construirBufferReporteConsolidadoPDF = ({
  resumen,
  filtrosAplicados,
  usuario,
  fechaGeneracion
}) => {
  const ops = [];

  ops.push('0.247 0.424 0.322 rg');
  ops.push('0 765 595 77 re f');

  ops.push('1 1 1 rg');
  ops.push('BT /F2 15.5 Tf 40 812 Td (HUELLAS SIN HOGAR - REPORTE CONSOLIDADO DE GESTION) Tj ET');
  ops.push(
    `BT /F1 9 Tf 40 794 Td (${escapePdfText(
      `Balance Operativo: Ingresos, Adopciones, Devoluciones, Censo e Insumos | Proteccion de Datos Personales`
    )}) Tj ET`
  );
  ops.push(
    `BT /F1 8.5 Tf 40 778 Td (${escapePdfText(
      `Emitido el: ${fechaGeneracion} | Autorizado por: ${usuario?.nombre || 'Dirección'} (Rol: ${etiquetaRolUsuario(usuario?.rol, usuario?.sexo) || 'Dirección'})`
    )}) Tj ET`
  );

  let y = 736;

  const drawHeader = (titulo) => {
    ops.push('0.91 0.94 0.91 rg');
    ops.push(`40 ${y - 5} 515 20 re f`);
    ops.push('0.18 0.33 0.25 rg');
    ops.push(`BT /F2 10 Tf 48 ${y} Td (${escapePdfText(titulo)}) Tj ET`);
    y -= 20;
  };

  const drawLine = (label, value) => {
    ops.push('0.30 0.34 0.39 rg');
    ops.push(`BT /F2 9.2 Tf 48 ${y} Td (${escapePdfText(label)}) Tj ET`);
    ops.push('0.12 0.14 0.19 rg');
    ops.push(`BT /F1 9.2 Tf 230 ${y} Td (${escapePdfText(value)}) Tj ET`);
    y -= 15;
  };

  drawHeader('PARAMETROS Y FILTROS CONFIGURADOS EN EL REPORTE');
  drawLine(
    'Rango de Fechas:',
    `${filtrosAplicados.fechaDesde || 'Inicio historico'} a ${filtrosAplicados.fechaHasta || 'Fecha actual'}`
  );
  drawLine('Tipo de Informacion:', filtrosAplicados.tipoInformacion || 'TODOS');
  drawLine(
    'Filtros Aplicados:',
    `Especie: ${filtrosAplicados.especie || 'Todas'} | Salud: ${filtrosAplicados.estadoSalud || 'Todos'} | Causal: ${
      filtrosAplicados.tipoIngreso || 'Todas'
    }`
  );

  y -= 6;
  drawHeader('1. BALANCE DE INGRESOS DE ANIMALES');
  drawLine('Total Ingresos en Periodo:', `${resumen.totalIngresos} animales registrados`);
  drawLine(
    'Desglose por Causal de Ingreso:',
    `Rescate: ${resumen.ingresosRescate} | Abandono: ${resumen.ingresosAbandono} | Decomiso: ${resumen.ingresosDecomiso}`
  );

  y -= 6;
  drawHeader('2. CENSO POBLACIONAL Y CAPACIDAD DE CANILES');
  drawLine(
    'Censo Activo Albergado:',
    `${resumen.animalesActivos} activos (Perros: ${resumen.totalPerros} | Gatos: ${resumen.totalGatos}) | Bajas: ${resumen.animalesBaja}`
  );
  drawLine(
    'Clasificacion Clinica:',
    `Normal: ${resumen.saludNormal} | Especial: ${resumen.saludEspecial} | Critico: ${resumen.saludCritico}`
  );
  drawLine(
    'Ocupacion de Caniles:',
    `${resumen.ocupacionPct}% (Libres: ${resumen.canilesLibres} | Ocupados: ${resumen.canilesOcupados} | Cuarentena: ${resumen.canilesCuarentena})`
  );

  y -= 6;
  drawHeader('3. BALANCE DE ADOPCIONES Y DEVOLUCIONES (DATOS PERSONALES PROTEGIDOS)');
  drawLine(
    'Procesos de Adopcion:',
    `Total solicitudes: ${resumen.totalAdopciones} | Concretadas (Adoptado): ${resumen.adopcionesConcretadas}`
  );
  drawLine(
    'Devoluciones Registradas:',
    `${resumen.totalDevoluciones} casos con devolucion (${resumen.tasaDevolucion}% sobre solicitudes)`
  );
  drawLine('Proteccion de Datos:', 'Informacion de contacto de postulantes omitida por seguridad y privacidad');

  y -= 6;
  drawHeader('4. ESTADO DE INSUMOS E INVENTARIO CRITICO');
  drawLine(
    'Balance de Insumos:',
    `${resumen.totalInsumos} insumos activos | ${resumen.insumosCriticos} en estado de stock critico`
  );

  ops.push('0.75 0.78 0.82 RG 0.8 w 40 44 m 555 44 l S');
  ops.push('0.45 0.49 0.54 rg');
  ops.push(
    `BT /F1 8 Tf 40 30 Td (${escapePdfText(
      `Huellas Sin Hogar - Reporte Consolidado Auditado | Generado por: ${usuario?.email || 'Dirección'}`
    )}) Tj ET`
  );

  const streamContent = ops.join('\n');
  const streamByteLength = Buffer.byteLength(streamContent, 'latin1');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n',
    `6 0 obj\n<< /Length ${streamByteLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`
  ];

  let pdfStr = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdfStr, 'latin1'));
    pdfStr += obj;
  }
  const xrefOffset = Buffer.byteLength(pdfStr, 'latin1');
  pdfStr += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdfStr += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdfStr += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdfStr, 'latin1');
};

/**
 * Si existen postulantes en la BD pero aún no se han vinculado adopciones de ejemplo,
 * vincula las solicitudes base para contar con trazabilidad de adopciones y devoluciones.
 */
const asegurarAdopcionesIniciales = async () => {
  try {
    const totalAdopciones = await prisma.adopcion.count();
    if (totalAdopciones > 0) return;

    const [postulantes, animales] = await Promise.all([
      prisma.postulante.findMany({ where: { activo: true }, orderBy: { id: 'asc' }, take: 3 }),
      prisma.animal.findMany({ where: { activo: true }, orderBy: { id: 'asc' }, take: 5 })
    ]);

    if (postulantes.length > 0 && animales.length > 0) {
      const pares = [
        { postulante: postulantes[0], animal: animales.find((a) => a.nombre === 'Mochi') || animales[0], etapa: 'Visita agendada', devolucion: false },
        { postulante: postulantes[1], animal: animales.find((a) => a.nombre === 'Bruno') || animales[1], etapa: 'Solicitud recibida', devolucion: true },
        { postulante: postulantes[2], animal: animales.find((a) => a.nombre === 'Simba') || animales[2], etapa: 'En revisión', devolucion: false }
      ];

      for (const par of pares) {
        if (par.postulante && par.animal) {
          await prisma.adopcion.create({
            data: {
              animalId: par.animal.id,
              postulanteId: par.postulante.id,
              etapa: par.etapa,
              devolucion: par.devolucion
            }
          });
        }
      }
    }
  } catch (err) {
    // No bloquear si falla vinculación auxiliar
  }
};

/**
 * Escapa un valor para celda CSV
 */
const escapeCsvCell = (val) => {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""').replace(/[\r\n]+/g, ' ');
  return `"${str}"`;
};

/**
 * RF9: Exportar Expediente / Ficha del Animal Individual (en PDF o CSV)
 * - Permitido para personal veterinario, personal de adopciones y Dirección.
 * - Restricción de privacidad RF9: Los documentos exportados omiten estrictamente los datos personales de postulantes
 * - Postcondiciones: Registra en bitácora de auditoría, notifica al personal y entrega el archivo para descarga local
 */
export const generarFichaAnimalPDF = async (animalId, user, ip, query = {}) => {
  const formato = String(query.formato || 'PDF').toUpperCase() === 'CSV' ? 'CSV' : 'PDF';
  await asegurarAdopcionesIniciales();

  const animal = await prisma.animal.findUnique({
    where: { id: Number(animalId) },
    include: {
      canil: true,
      ...(formato === 'PDF' && {
        vacunas: {
          where: { activo: true },
          orderBy: { fechaAplicacion: 'desc' },
          select: { nombreVacuna: true, dosis: true, fechaAplicacion: true, fechaVencimiento: true }
        },
        atencionesClinicas: {
          orderBy: { fechaAtencion: 'desc' },
          select: { motivo: true, diagnostico: true, fechaAtencion: true }
        },
        tratamientos: {
          orderBy: { fechaInicio: 'desc' },
          select: { medicamento: true, dosis: true, frecuenciaHoras: true, fechaInicio: true, fechaFin: true, indicacionesExtra: true }
        }
      }),
      creadoPor: { select: { id: true, nombre: true, email: true, rol: true } },
      adopciones: {
        orderBy: { fecha: 'desc' },
        select: {
          id: true,
          fecha: true,
          etapa: true,
          devolucion: true
          // Se excluye `postulante` para omitir estrictamente datos personales en el documento exportado (RF9)
        }
      }
    }
  });

  if (!animal) {
    throw new ErrorDominio(404, 'Animal no encontrado');
  }

  const matchCausal = (animal.nota || '').match(REGEX_TIPO_INGRESO);
  const tipoIngreso = matchCausal ? matchCausal[1] : 'Rescate';
  const notaClinica = (animal.nota || '').replace(REGEX_TIPO_INGRESO, '').trim() || 'Sin antecedentes clínicos registrados.';
  const fechaGeneracion = new Date().toLocaleString('es-CL');
  const safeName = animal.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '_');

  let bufferOrContent;
  let filename;
  let contentType;

  if (formato === 'CSV') {
    const filas = [];
    const addRow = (cols) => filas.push(cols.map(escapeCsvCell).join(','));
    addRow(['HUELLAS SIN HOGAR - EXPEDIENTE Y FICHA DEL ANIMAL']);
    addRow(['Nombre', animal.nombre, 'Causal de Ingreso', tipoIngreso]);
    addRow(['Especie', animal.especie, 'Sexo', animal.sexo, 'Edad Aproximada', animal.edad || 'Desconocida']);
    addRow(['Raza', animal.raza || 'Desconocida', 'Peso (kg)', animal.peso ?? 0, 'Microchip', animal.chip || 'Sin chip']);
    addRow(['Estado Salud', animal.estadoSalud, 'Esterilización', animal.esterilizacion || 'Desconocido', 'Comportamiento', animal.comportamiento || 'Por evaluar']);
    addRow(['Ubicación / Canil', animal.canil ? animal.canil.nombre : 'Sin asignar', 'Fecha Ingreso', animal.creadoEn ? new Date(animal.creadoEn).toISOString().split('T')[0] : '']);
    addRow(['Fotografía Registrada', animal.fotoUrl || 'Sin fotografía registrada']);
    addRow(['Historial Médico / Notas Clínicas', notaClinica]);
    filas.push('');
    addRow(['TRAZABILIDAD DE ADOPCIONES Y DEVOLUCIONES']);
    addRow(['Postulante', 'Etapa', 'Devolución Previa', 'Fecha']);
    for (const ad of animal.adopciones || []) {
      addRow([
        '',
        ad.etapa,
        ad.devolucion ? 'SÍ' : 'NO',
        ad.fecha ? new Date(ad.fecha).toISOString().split('T')[0] : ''
      ]);
    }
    bufferOrContent = Buffer.from('\uFEFF' + filas.join('\r\n'), 'utf-8');
    filename = `ficha_animal_${safeName}.csv`;
    contentType = 'text/csv; charset=utf-8';
  } else {
    bufferOrContent = construirBufferPDF({
      animal,
      tipoIngreso,
      notaClinica,
      usuario: user,
      fechaGeneracion
    });
    filename = `ficha_animal_${safeName}.pdf`;
    contentType = 'application/pdf';
  }

  const recursoExportado = `Ficha del animal ${animal.nombre} (${formato})`;

  // Registrar evento de exportación en la bitácora de auditoría
  await registrarAuditoria({
    entidad: `Reporte ${formato} (Ficha del Animal)`,
    entidadId: animal.id,
    accion: 'CREACION',
    valorAnterior: null,
    valorNuevo: {
      evento: 'EXPORTACION_EXPEDIENTE_ANIMAL',
      tipoReporte: formato,
      recursoExportado,
      animalId: animal.id,
      animalNombre: animal.nombre,
      rolUsuario: user?.rol,
      sexoUsuario: user?.sexo,
      privacidadDatosPersonalesOmitidos: true,
      fechaExportacion: new Date().toISOString()
    },
    usuario: user,
    ip
  });

  // Notificar al personal del refugio sobre la exportación realizada
  const notificacion = await notificarPersonalRefugio({
    tipo: `EXPORTACION_${formato}`,
    titulo: `Ficha del animal (${formato}) descargada: ${animal.nombre}`,
    mensaje: `${user?.nombre || 'Usuario'} (${etiquetaRolUsuario(user?.rol, user?.sexo) || 'Personal'}) descargó la ficha del animal ${animal.nombre} en formato ${formato}.`,
    destinatarios: ['DIRECCION', 'PERSONAL_VETERINARIO', 'PERSONAL_ADOPCIONES'],
    usuario: user,
    metadata: {
      tipoReporte: formato,
      recursoExportado,
      animalId: animal.id,
      privacidadAplicada: true
    }
  });

  return {
    buffer: bufferOrContent,
    filename,
    contentType,
    notificacion
  };
};

/**
 * Generar y Exportar Reportes Consolidados de Gestión Operativa
 * (Balance de ingresos, adopciones, devoluciones, censo y estado de insumos)
 */
export const generarReporteConsolidadoCSV = async (user, ip, query = {}) => {
  if (user?.rol !== 'DIRECCION') {
    throw new ErrorDominio(403, 'Acceso exclusivo: Solo la Dirección del refugio cuenta con permisos para exportar reportes consolidados.');
  }

  await asegurarAdopcionesIniciales();

  const {
    fechaDesde = '',
    fechaHasta = '',
    tipoInformacion = 'TODOS', // 'TODOS' | 'INGRESOS' | 'ADOPCIONES' | 'DEVOLUCIONES' | 'CENSO' | 'INSUMOS'
    especie = '',
    estadoSalud = '',
    tipoIngreso = '',
    formato = 'CSV' // 'CSV' | 'PDF'
  } = query;

  // Filtro de rango de fechas para ingresos y adopciones/devoluciones
  const dateFilter = {};
  if (fechaDesde) {
    const d = new Date(fechaDesde);
    if (!Number.isNaN(d.getTime())) dateFilter.gte = d;
  }
  if (fechaHasta) {
    const h = new Date(fechaHasta);
    if (!Number.isNaN(h.getTime())) {
      h.setHours(23, 59, 59, 999);
      dateFilter.lte = h;
    }
  }
  const hasDateFilter = Object.keys(dateFilter).length > 0;

  const whereAnimal = {};
  if (hasDateFilter) whereAnimal.creadoEn = dateFilter;
  if (especie) whereAnimal.especie = { equals: especie, mode: 'insensitive' };
  if (estadoSalud) whereAnimal.estadoSalud = estadoSalud;

  const whereAdopcion = {};
  if (hasDateFilter) whereAdopcion.fecha = dateFilter;

  const [animalesFiltrados, caniles, insumos, turnos, traslados, adopciones] = await Promise.all([
    prisma.animal.findMany({
      where: whereAnimal,
      include: {
        canil: true,
        creadoPor: { select: { nombre: true, rol: true } }
      },
      orderBy: { id: 'asc' }
    }),
    prisma.canil.findMany({ orderBy: { id: 'asc' }, include: { _count: { select: { animales: true } } } }),
    prisma.insumo.findMany({ where: { activo: true }, orderBy: { id: 'asc' } }),
    prisma.turno.findMany({ orderBy: { id: 'asc' } }),
    prisma.traslado.findMany({
      where: hasDateFilter ? { fechaRegistro: dateFilter } : {},
      include: {
        animal: { select: { nombre: true } },
        responsable: { select: { nombre: true } },
        aprobadoPor: { select: { nombre: true } }
      },
      orderBy: { fechaRegistro: 'desc' }
    }),
    prisma.adopcion.findMany({
      where: whereAdopcion,
      include: {
        animal: { select: { nombre: true, especie: true } }
        // Se omite `postulante` para garantizar que ningún dato personal de postulantes sea incluido
      },
      orderBy: { fecha: 'desc' }
    })
  ]);

  // Filtrar por causal de ingreso (Rescate, Abandono, Decomiso) si fue especificado
  const animales = tipoIngreso
    ? animalesFiltrados.filter((a) => {
        const m = (a.nota || '').match(REGEX_TIPO_INGRESO);
        const causal = m ? m[1] : 'Rescate';
        return causal.toLowerCase() === tipoIngreso.toLowerCase();
      })
    : animalesFiltrados;

  // Cálculo de métricas operativas: Ingresos, Adopciones, Devoluciones, Censo e Insumos
  let ingresosRescate = 0;
  let ingresosAbandono = 0;
  let ingresosDecomiso = 0;
  for (const a of animales) {
    const m = (a.nota || '').match(REGEX_TIPO_INGRESO);
    const causal = (m ? m[1] : 'Rescate').toLowerCase();
    if (causal === 'abandono') ingresosAbandono++;
    else if (causal === 'decomiso') ingresosDecomiso++;
    else ingresosRescate++;
  }

  const animalesActivos = animales.filter((a) => a.activo);
  const animalesBaja = animales.filter((a) => !a.activo);
  const totalPerros = animalesActivos.filter((a) => a.especie.toLowerCase() === 'perro').length;
  const totalGatos = animalesActivos.filter((a) => a.especie.toLowerCase() === 'gato').length;

  const saludNormal = animalesActivos.filter((a) => a.estadoSalud === 'NORMAL').length;
  const saludEspecial = animalesActivos.filter((a) => a.estadoSalud === 'ESPECIAL').length;
  const saludCritico = animalesActivos.filter((a) => a.estadoSalud === 'CRITICO').length;

  const canilesLibres = caniles.filter((c) => c.estado === 'LIBRE').length;
  const canilesOcupados = caniles.filter((c) => c.estado === 'OCUPADO').length;
  const canilesCuarentena = caniles.filter((c) => c.estado === 'CUARENTENA').length;
  const capacidad = caniles.reduce((s,c) => s + c.capacidad, 0);
  const alojados = caniles.reduce((s,c) => s + c._count.animales, 0);
  const ocupacionPct = capacidad ? Math.round(alojados * 100 / capacidad) : 0;

  const insumosCriticos = insumos.filter((i) => i.stock <= i.stockMinimo);
  const turnosCubiertos = turnos.filter((t) => t.cubierto).length;
  const turnosDescubiertos = turnos.filter((t) => !t.cubierto).length;

  const devolucionesList = adopciones.filter((ad) => ad.devolucion);
  const adopcionesConcretadas = adopciones.filter((ad) => ad.etapa.toLowerCase() === 'adoptado').length;
  const tasaDevolucion =
    adopciones.length > 0 ? Math.round((devolucionesList.length / adopciones.length) * 100) : 0;

  const resumenConsolidado = {
    totalIngresos: animales.length,
    ingresosRescate,
    ingresosAbandono,
    ingresosDecomiso,
    animalesActivos: animalesActivos.length,
    animalesBaja: animalesBaja.length,
    totalPerros,
    totalGatos,
    saludNormal,
    saludEspecial,
    saludCritico,
    canilesLibres,
    canilesOcupados,
    canilesCuarentena,
    ocupacionPct,
    totalAdopciones: adopciones.length,
    adopcionesConcretadas,
    totalDevoluciones: devolucionesList.length,
    tasaDevolucion,
    totalInsumos: insumos.length,
    insumosCriticos: insumosCriticos.length
  };

  const filtrosAplicados = {
    fechaDesde: fechaDesde || null,
    fechaHasta: fechaHasta || null,
    tipoInformacion: tipoInformacion || 'TODOS',
    especie: especie || null,
    estadoSalud: estadoSalud || null,
    tipoIngreso: tipoIngreso || null,
    formato: String(formato || 'CSV').toUpperCase()
  };

  const sec = String(tipoInformacion || 'TODOS').toUpperCase();
  const incluirIngresos = sec === 'TODOS' || sec === 'INGRESOS';
  const incluirCenso = sec === 'TODOS' || sec === 'CENSO';
  const incluirAdopciones = sec === 'TODOS' || sec === 'ADOPCIONES';
  const incluirDevoluciones = sec === 'TODOS' || sec === 'DEVOLUCIONES';
  const incluirInsumos = sec === 'TODOS' || sec === 'INSUMOS';

  const filas = [];
  const addRow = (cols) => filas.push(cols.map(escapeCsvCell).join(','));

  // ENCABEZADO Y FILTROS CONFIGURADOS
  addRow(['HUELLAS SIN HOGAR - REPORTE CONSOLIDADO DE GESTIÓN OPERATIVA']);
  addRow(['Fecha de Exportación', new Date().toISOString(), 'Generado por', user.nombre, 'Rol', etiquetaRolUsuario(user.rol, user.sexo)]);
  addRow([
    'Rango de Fechas',
    `${fechaDesde || 'Inicio histórico'} a ${fechaHasta || 'Actualidad'}`,
    'Tipo de Información',
    sec,
    'Filtros',
    `Especie: ${especie || 'Todas'} | Salud: ${estadoSalud || 'Todos'} | Causal: ${tipoIngreso || 'Todas'}`
  ]);
  filas.push('');

  // RESUMEN EJECUTIVO DE GESTIÓN OPERATIVA
  addRow(['RESUMEN EJECUTIVO DE GESTIÓN OPERATIVA']);
  addRow(['Dimensión Operativa', 'Resultado Principal', 'Desglose Detallado']);
  addRow([
    '1. Balance de Ingresos',
    `${animales.length} ingresos`,
    `Rescate: ${ingresosRescate} | Abandono: ${ingresosAbandono} | Decomiso: ${ingresosDecomiso}`
  ]);
  addRow([
    '2. Censo y Capacidad',
    `${animalesActivos.length} animales albergados`,
    `Perros: ${totalPerros} | Gatos: ${totalGatos} | Ocupación Caniles: ${ocupacionPct}% (${canilesLibres} libres)`
  ]);
  addRow([
    '3. Balance de Adopciones',
    `${adopciones.length} procesos registrados`,
    `Adoptados: ${adopcionesConcretadas} | En seguimiento/revisión: ${adopciones.length - adopcionesConcretadas}`
  ]);
  addRow([
    '4. Balance de Devoluciones',
    `${devolucionesList.length} devoluciones`,
    `Tasa de devolución: ${tasaDevolucion}% sobre total de solicitudes`
  ]);
  addRow([
    '5. Estado de Insumos',
    `${insumos.length} insumos activos`,
    `${insumosCriticos.length} insumos en stock crítico | Turnos descubiertos: ${turnosDescubiertos}/${turnos.length}`
  ]);
  filas.push('');

  // SECCIÓN DETALLADA: INGRESOS Y CENSO DE ANIMALES
  if (incluirIngresos || incluirCenso) {
    addRow(['DETALLE DE INGRESOS Y CENSO DE POBLACIÓN ANIMAL']);
    addRow([
      'Nombre',
      'Causal Ingreso',
      'Especie',
      'Sexo',
      'Edad Aproximada',
      'Raza',
      'Peso (kg)',
      'Microchip',
      'Estado Salud',
      'Esterilización',
      'Comportamiento',
      'Canil Asignado',
      'Estado Censo',
      'Fecha Ingreso',
      'Registrado Por',
      'Antecedentes Clínicos / Notas'
    ]);

    for (const a of animales) {
      const matchCausal = (a.nota || '').match(REGEX_TIPO_INGRESO);
      const causal = matchCausal ? matchCausal[1] : 'Rescate';
      const notaLimpia = (a.nota || '').replace(REGEX_TIPO_INGRESO, '').trim();
      addRow([
        a.nombre,
        causal,
        a.especie,
        a.sexo,
        a.edad || 'Desconocida',
        a.raza || 'Desconocida',
        a.peso ?? 0,
        a.chip || 'Sin chip',
        a.estadoSalud,
        a.esterilizacion || 'Desconocido',
        a.comportamiento || 'Por evaluar',
        a.canil ? a.canil.nombre : 'Sin asignar',
        a.activo ? 'ALBERGADO_ACTIVO' : 'BAJA_LOGICA',
        a.creadoEn ? new Date(a.creadoEn).toISOString().split('T')[0] : '',
        a.creadoPor?.nombre || 'Sistema',
        notaLimpia
      ]);
    }
    filas.push('');
  }

  // SECCIÓN DETALLADA: ADOPCIONES Y DEVOLUCIONES (SIN DATOS PERSONALES DE POSTULANTES)
  if (incluirAdopciones || incluirDevoluciones) {
    const listaAdop = incluirDevoluciones && !incluirAdopciones ? devolucionesList : adopciones;
    addRow(['CONSOLIDADO DE ADOPCIONES Y DEVOLUCIONES']);
    addRow(['Animal', 'Especie', 'Postulante', 'Etapa del Proceso', 'Devolución Registrada', 'Fecha Solicitud']);
    for (const ad of listaAdop) {
      addRow([
        ad.animal?.nombre || '',
        ad.animal?.especie || '',
        '',
        ad.etapa,
        ad.devolucion ? 'SÍ (DEVUELTO)' : 'NO',
        ad.fecha ? new Date(ad.fecha).toISOString().split('T')[0] : ''
      ]);
    }
    filas.push('');
  }

  // SECCIÓN DETALLADA: ESTADO DE INSUMOS
  if (incluirInsumos) {
    addRow(['ESTADO DE INSUMOS E INVENTARIO DEL REFUGIO']);
    addRow(['Producto', 'Categoría', 'Stock Actual', 'Stock Mínimo', 'Estado Abastecimiento']);
    for (const ins of insumos) {
      addRow([
        ins.nombre,
        ins.categoria,
        ins.stock,
        ins.stockMinimo,
        ins.stock <= ins.stockMinimo ? 'CRÍTICO' : 'NORMAL'
      ]);
    }
    filas.push('');
  }

  const formatoSalida = String(formato || 'CSV').toUpperCase() === 'PDF' ? 'PDF' : 'CSV';
  const fechaStr = new Date().toISOString().split('T')[0];
  const recursoExportado = `Reporte Consolidado de Gestión Operativa (${sec}) [${formatoSalida}]`;

  // Registrar consulta/exportación en la bitácora de auditoría
  await registrarAuditoria({
    entidad: `Reporte Consolidado ${formatoSalida}`,
    entidadId: null,
    accion: 'CREACION',
    valorAnterior: null,
    valorNuevo: {
      evento: 'EXPORTACION_REPORTE_CONSOLIDADO',
      tipoReporte: formatoSalida,
      recursoExportado,
      rolUsuario: user.rol,
      sexoUsuario: user.sexo,
      filtrosConfigurados: filtrosAplicados,
      privacidadDatosPostulantesOmitidos: true,
      resumenExportado: resumenConsolidado,
      fechaExportacion: new Date().toISOString()
    },
    usuario: user,
    ip
  });

  // Notificar al personal del refugio sobre la exportación realizada
  const notificacion = await notificarPersonalRefugio({
    tipo: `EXPORTACION_${formatoSalida}`,
    titulo: `Reporte Consolidado (${formatoSalida}) generado`,
    mensaje: `La Dirección (${user.nombre}) exportó el Reporte Consolidado de Gestión (${sec}) en formato ${formatoSalida}.`,
    destinatarios: ['DIRECCION', 'PERSONAL_VETERINARIO', 'PERSONAL_ADOPCIONES'],
    usuario: user,
    metadata: {
      tipoReporte: formatoSalida,
      recursoExportado,
      filtrosConfigurados: filtrosAplicados
    }
  });

  if (formatoSalida === 'PDF') {
    const pdfBuffer = construirBufferReporteConsolidadoPDF({
      resumen: resumenConsolidado,
      filtrosAplicados,
      usuario: user,
      fechaGeneracion: new Date().toLocaleString('es-CL')
    });
    return {
      buffer: pdfBuffer,
      filename: `reporte_consolidado_gestion_${fechaStr}.pdf`,
      contentType: 'application/pdf',
      notificacion
    };
  }

  const csvContent = '\uFEFF' + filas.join('\r\n');
  return {
    csv: csvContent,
    buffer: Buffer.from(csvContent, 'utf-8'),
    filename: `reporte_consolidado_gestion_${fechaStr}.csv`,
    contentType: 'text/csv; charset=utf-8',
    notificacion
  };
};
