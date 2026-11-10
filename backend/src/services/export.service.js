import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import prisma from '../config/prisma.js';
import { registrarAuditoria } from './audit.service.js';
import { notificarPersonalRefugio } from './notification.service.js';
import { uploadsPath } from '../middlewares/upload.middleware.js';

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
      if (fotoUrl.includes('/uploads/')) {
        filename = decodeURIComponent(fotoUrl.split('/uploads/').pop().split('?')[0]);
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
const construirBufferPDF = ({ animal, tipoIngreso, notaClinica, usuario, fechaGeneracion }) => {
  const ops = [];
  const imagenPDF = extraerImagenPDFXObject(animal.fotoUrl);

  // Encabezado institucional en verde salvia (#3f6c52 -> RGB 0.247, 0.424, 0.322)
  ops.push('0.247 0.424 0.322 rg');
  ops.push('0 765 595 77 re f');

  // Título blanco en encabezado
  ops.push('1 1 1 rg');
  ops.push('BT /F2 17 Tf 40 812 Td (HUELLAS SIN HOGAR - EXPEDIENTE Y FICHA DEL ANIMAL) Tj ET');
  ops.push(
    `BT /F1 9.5 Tf 40 794 Td (${escapePdfText(
      `Documento Oficial de Registro Clinico y Trazabilidad | ID Ficha: #${animal.id}`
    )}) Tj ET`
  );
  ops.push(
    `BT /F1 8.5 Tf 40 778 Td (${escapePdfText(
      `Emitido el: ${fechaGeneracion} | Solicitado por: ${usuario?.nombre || 'Staff'} (Rol: ${usuario?.rol || 'N/A'})`
    )}) Tj ET`
  );

  let y = 738;

  const drawSectionHeader = (titulo) => {
    ops.push('0.91 0.94 0.91 rg');
    ops.push(`40 ${y - 5} 515 20 re f`);
    ops.push('0.18 0.33 0.25 rg');
    ops.push(`BT /F2 10.5 Tf 48 ${y} Td (${escapePdfText(titulo)}) Tj ET`);
    y -= 22;
  };

  // Fila compacta a la izquierda para convivir con el recuadro de fotografía a la derecha
  const drawLeftCompactRow = (label1, val1, label2, val2) => {
    ops.push('0.35 0.39 0.44 rg');
    ops.push(`BT /F2 9.2 Tf 45 ${y} Td (${escapePdfText(label1)}) Tj ET`);
    ops.push('0.12 0.14 0.19 rg');
    ops.push(`BT /F1 9.2 Tf 132 ${y} Td (${escapePdfText(String(val1).slice(0, 22))}) Tj ET`);

    if (label2) {
      ops.push('0.35 0.39 0.44 rg');
      ops.push(`BT /F2 9.2 Tf 245 ${y} Td (${escapePdfText(label2)}) Tj ET`);
      ops.push('0.12 0.14 0.19 rg');
      ops.push(`BT /F1 9.2 Tf 325 ${y} Td (${escapePdfText(String(val2).slice(0, 18))}) Tj ET`);
    }
    y -= 16;
  };

  const drawKeyValueRow = (label1, val1, label2, val2) => {
    ops.push('0.35 0.39 0.44 rg');
    ops.push(`BT /F2 9.5 Tf 45 ${y} Td (${escapePdfText(label1)}) Tj ET`);
    ops.push('0.12 0.14 0.19 rg');
    ops.push(`BT /F1 9.5 Tf 150 ${y} Td (${escapePdfText(val1)}) Tj ET`);

    if (label2) {
      ops.push('0.35 0.39 0.44 rg');
      ops.push(`BT /F2 9.5 Tf 315 ${y} Td (${escapePdfText(label2)}) Tj ET`);
      ops.push('0.12 0.14 0.19 rg');
      ops.push(`BT /F1 9.5 Tf 425 ${y} Td (${escapePdfText(val2)}) Tj ET`);
    }
    y -= 16;
  };

  const drawParagraph = (label, content) => {
    ops.push('0.35 0.39 0.44 rg');
    ops.push(`BT /F2 9.5 Tf 45 ${y} Td (${escapePdfText(label)}) Tj ET`);
    y -= 14;
    const lines = wrapText(content || 'No especificado', 84);
    ops.push('0.12 0.14 0.19 rg');
    for (const line of lines) {
      if (y < 60) break;
      ops.push(`BT /F1 9.2 Tf 52 ${y} Td (${escapePdfText(line)}) Tj ET`);
      y -= 13;
    }
    y -= 4;
  };

  // SECCIÓN 1: ANTECEDENTES GENERALES DEL ANIMAL + FOTOGRAFÍA DESTACADA
  drawSectionHeader('1. IDENTIFICACION Y ANTECEDENTES DEL ANIMAL');

  // Recuadro destacado para la Fotografía del Animal (x=428, y=614, ancho=127, alto=102)
  const photoBoxX = 428;
  const photoBoxY = 614;
  const photoBoxW = 127;
  const photoBoxH = 102;

  ops.push('0.96 0.98 0.96 rg');
  ops.push(`${photoBoxX} ${photoBoxY} ${photoBoxW} ${photoBoxH} re f`);
  ops.push('0.76 0.84 0.78 RG 1 w');
  ops.push(`${photoBoxX} ${photoBoxY} ${photoBoxW} ${photoBoxH} re S`);

  if (imagenPDF) {
    const innerPad = 6;
    const maxW = photoBoxW - innerPad * 2;
    const maxH = photoBoxH - 20;
    const ratio = Math.min(maxW / imagenPDF.width, maxH / imagenPDF.height);
    const drawW = Number((imagenPDF.width * ratio).toFixed(2));
    const drawH = Number((imagenPDF.height * ratio).toFixed(2));
    const drawX = Number((photoBoxX + (photoBoxW - drawW) / 2).toFixed(2));
    const drawY = Number((photoBoxY + 14 + (maxH - drawH) / 2).toFixed(2));

    ops.push('q');
    ops.push(`${drawW} 0 0 ${drawH} ${drawX} ${drawY} cm`);
    ops.push('/Im1 Do');
    ops.push('Q');

    ops.push('0.24 0.42 0.32 rg');
    ops.push(`BT /F2 7.5 Tf ${photoBoxX + 20} ${photoBoxY + 4} Td (Fotografia del Animal) Tj ET`);
  } else {
    ops.push('0.50 0.55 0.60 rg');
    ops.push(`BT /F2 8.2 Tf ${photoBoxX + 14} ${photoBoxY + 56} Td (Sin fotografia registrada) Tj ET`);
    ops.push(`BT /F1 7.2 Tf ${photoBoxX + 22} ${photoBoxY + 42} Td (Espacio reservado para) Tj ET`);
    ops.push(`BT /F1 7.2 Tf ${photoBoxX + 25} ${photoBoxY + 31} Td (imagen del ejemplar) Tj ET`);
  }

  drawLeftCompactRow('Nombre:', animal.nombre || 'Sin nombre', 'Causal:', tipoIngreso || 'Rescate');
  drawLeftCompactRow('Especie:', animal.especie || 'No especificada', 'Sexo:', animal.sexo || 'No especificado');
  drawLeftCompactRow('Edad Aprox.:', animal.edad || 'Desconocida', 'Raza:', animal.raza || 'Desconocida');
  drawLeftCompactRow(
    'Peso:',
    animal.peso && animal.peso > 0 ? `${animal.peso} kg` : 'No registrado',
    'Microchip:',
    animal.chip || 'Sin chip'
  );
  drawLeftCompactRow(
    'Estado Censo:',
    animal.activo ? 'Activo (Albergado)' : 'Baja',
    'Ingreso:',
    animal.creadoEn ? new Date(animal.creadoEn).toLocaleDateString('es-CL') : 'N/A'
  );
  drawLeftCompactRow(
    'Ubicacion:',
    animal.canil ? `${animal.canil.nombre} (${animal.canil.codigo})` : 'Sin canil asignado',
    'Adopcion:',
    animal.estadoAdopcion === 'ADOPTADO' ? 'Adoptado' : 'En refugio'
  );

  y = Math.min(y, photoBoxY - 12);

  // SECCIÓN 2: ANTECEDENTES CLÍNICOS Y CONDUCTUALES
  drawSectionHeader('2. ESTADO CLINICO, ESTERILIZACION Y CONDUCTA');
  drawKeyValueRow(
    'Estado de Salud:',
    animal.estadoSalud || 'NORMAL',
    'Esterilizacion:',
    animal.esterilizacion || 'Desconocido'
  );
  drawParagraph('Comportamiento y Temperamento:', animal.comportamiento || 'Por evaluar');
  drawParagraph('Historial Medico / Notas Clinicas:', notaClinica || 'Sin antecedentes clinicos registrados.');

  y -= 4;

  // SECCIÓN 3: HISTORIAL DE MOVIMIENTOS Y TRASLADOS
  drawSectionHeader('3. TRAZABILIDAD DE UBICACION Y TRASLADOS');
  const traslados = animal.traslados || [];
  if (traslados.length === 0) {
    ops.push('0.45 0.49 0.54 rg');
    ops.push(`BT /F1 9 Tf 48 ${y} Td (Sin movimientos de canil ni traslados externos registrados.) Tj ET`);
    y -= 18;
  } else {
    for (const tr of traslados.slice(0, 4)) {
      if (y < 110) break;
      const fechaTr = tr.fechaRegistro ? new Date(tr.fechaRegistro).toLocaleDateString('es-CL') : '';
      const resumenTr = `[${fechaTr}] ${tr.tipo} (${tr.estado}) - Motivo: ${tr.motivo}`;
      for (const l of wrapText(resumenTr, 84)) {
        ops.push('0.12 0.14 0.19 rg');
        ops.push(`BT /F1 8.8 Tf 48 ${y} Td (${escapePdfText(l)}) Tj ET`);
        y -= 12;
      }
    }
    y -= 6;
  }

  // SECCIÓN 4: TRAZABILIDAD DE ADOPCIONES Y DEVOLUCIONES (PROTECCIÓN DE DATOS PERSONALES)
  drawSectionHeader('4. TRAZABILIDAD DE ADOPCIONES Y DEVOLUCIONES');
  ops.push('0.75 0.25 0.20 rg');
  ops.push(
    `BT /F2 8.5 Tf 48 ${y} Td (Por seguridad y proteccion de datos personales, la informacion de contacto de los postulantes no se incluye.) Tj ET`
  );
  y -= 14;

  const adopciones = animal.adopciones || [];
  if (adopciones.length === 0) {
    ops.push('0.45 0.49 0.54 rg');
    ops.push(`BT /F1 9 Tf 48 ${y} Td (Sin procesos de adopcion o devolucion registrados para este animal.) Tj ET`);
    y -= 16;
  } else {
    for (const ad of adopciones.slice(0, 4)) {
      if (y < 65) break;
      const fechaAd = ad.fecha ? new Date(ad.fecha).toLocaleDateString('es-CL') : 'N/A';
      const lineaAnonima = `Solicitud #${ad.id} | Postulante: [Informacion de contacto protegida] | Etapa: ${ad.etapa} | Fecha: ${fechaAd} | Devolucion: ${
        ad.devolucion ? 'SI' : 'NO'
      }`;
      ops.push('0.12 0.14 0.19 rg');
      ops.push(`BT /F1 8.8 Tf 48 ${y} Td (${escapePdfText(lineaAnonima)}) Tj ET`);
      y -= 13;
    }
  }

  // Pie de página de auditoría
  ops.push('0.75 0.78 0.82 RG 0.8 w 40 44 m 555 44 l S');
  ops.push('0.45 0.49 0.54 rg');
  ops.push(
    `BT /F1 8 Tf 40 30 Td (${escapePdfText(
      `Huellas Sin Hogar - Exportacion registrada en Bitacora de Auditoria | Usuario: ${usuario?.email || 'sistema'}`
    )}) Tj ET`
  );

  const streamContent = Buffer.from(ops.join('\n'), 'latin1');

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
      `Emitido el: ${fechaGeneracion} | Autorizado por: ${usuario?.nombre || 'Directora'} (Rol: ${usuario?.rol})`
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
    `Normal: ${resumen.saludNormal} | Condicion Especial: ${resumen.saludEspecial} | Critico: ${resumen.saludCritico}`
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
      `Huellas Sin Hogar - Reporte Consolidado Auditado | Generado por: ${usuario?.email || 'directora'}`
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
 * - Permitido para Personal del Refugio (VETERINARIA, ENCARGADA_ADOPCIONES) y Directora (DIRECTORA)
 * - Restricción de privacidad RF9: Los documentos exportados omiten estrictamente los datos personales de postulantes
 * - Postcondiciones: Registra en bitácora de auditoría, notifica al personal y entrega el archivo para descarga local
 */
export const generarFichaAnimalPDF = async (animalId, user, ip, query = {}) => {
  await asegurarAdopcionesIniciales();

  const animal = await prisma.animal.findUnique({
    where: { id: Number(animalId) },
    include: {
      canil: true,
      creadoPor: { select: { id: true, nombre: true, email: true, rol: true } },
      traslados: {
        orderBy: { fechaRegistro: 'desc' }
      },
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
    throw new Error('Animal no encontrado');
  }

  const formato = String(query.formato || 'PDF').toUpperCase() === 'CSV' ? 'CSV' : 'PDF';
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
    addRow(['ID Ficha', animal.id, 'Nombre', animal.nombre, 'Causal de Ingreso', tipoIngreso]);
    addRow(['Especie', animal.especie, 'Sexo', animal.sexo, 'Edad Aproximada', animal.edad || 'Desconocida']);
    addRow(['Raza', animal.raza || 'Desconocida', 'Peso (kg)', animal.peso ?? 0, 'Microchip', animal.chip || 'Sin chip']);
    addRow(['Estado Salud', animal.estadoSalud, 'Esterilización', animal.esterilizacion || 'Desconocido', 'Comportamiento', animal.comportamiento || 'Por evaluar']);
    addRow(['Ubicación / Canil', animal.canil ? `${animal.canil.codigo} (${animal.canil.nombre})` : 'Sin asignar', 'Fecha Ingreso', animal.creadoEn ? new Date(animal.creadoEn).toISOString().split('T')[0] : '']);
    addRow(['Fotografía Registrada', animal.fotoUrl || 'Sin fotografía registrada']);
    addRow(['Historial Médico / Notas Clínicas', notaClinica]);
    filas.push('');
    addRow(['TRAZABILIDAD DE ADOPCIONES Y DEVOLUCIONES (INFORMACIÓN DE CONTACTO DE POSTULANTES PROTEGIDA)']);
    addRow(['ID Solicitud', 'Postulante', 'Etapa', 'Devolución Previa', 'Fecha']);
    for (const ad of animal.adopciones || []) {
      addRow([
        ad.id,
        'Información de contacto no incluida por protección de datos',
        ad.etapa,
        ad.devolucion ? 'SÍ' : 'NO',
        ad.fecha ? new Date(ad.fecha).toISOString().split('T')[0] : ''
      ]);
    }
    bufferOrContent = Buffer.from('\uFEFF' + filas.join('\r\n'), 'utf-8');
    filename = `ficha_animal_${safeName}_${animal.id}.csv`;
    contentType = 'text/csv; charset=utf-8';
  } else {
    bufferOrContent = construirBufferPDF({
      animal,
      tipoIngreso,
      notaClinica,
      usuario: user,
      fechaGeneracion
    });
    filename = `ficha_animal_${safeName}_${animal.id}.pdf`;
    contentType = 'application/pdf';
  }

  const recursoExportado = `Ficha del Animal #${animal.id} - ${animal.nombre} (${formato})`;

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
    mensaje: `${user?.nombre || 'Usuario'} (${user?.rol}) descargó la ficha del animal ${animal.nombre} (#${animal.id}) en formato ${formato}. Por protección de datos, la información de contacto de los postulantes no se incluye.`,
    destinatarios: ['DIRECTORA', 'VETERINARIA', 'ENCARGADA_ADOPCIONES'],
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
  if (user?.rol !== 'DIRECTORA') {
    throw new Error('Acceso exclusivo: Solo la Dirección del refugio cuenta con permisos para exportar reportes consolidados.');
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
    prisma.canil.findMany({ orderBy: { id: 'asc' } }),
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
  const saludEspecial = animalesActivos.filter((a) => a.estadoSalud === 'CONDICION_ESPECIAL').length;
  const saludCritico = animalesActivos.filter((a) => a.estadoSalud === 'CRITICO').length;

  const canilesLibres = caniles.filter((c) => c.estado === 'LIBRE').length;
  const canilesOcupados = caniles.filter((c) => c.estado === 'OCUPADO').length;
  const canilesCuarentena = caniles.filter((c) => c.estado === 'CUARENTENA').length;
  const ocupacionPct =
    caniles.length > 0 ? Math.round(((canilesOcupados + canilesCuarentena) / caniles.length) * 100) : 0;

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
  addRow(['Fecha de Exportación', new Date().toISOString(), 'Generado por', user.nombre, 'Rol', user.rol]);
  addRow([
    'Rango de Fechas',
    `${fechaDesde || 'Inicio histórico'} a ${fechaHasta || 'Actualidad'}`,
    'Tipo de Información',
    sec,
    'Filtros',
    `Especie: ${especie || 'Todas'} | Salud: ${estadoSalud || 'Todos'} | Causal: ${tipoIngreso || 'Todas'}`
  ]);
  addRow([
    'Protección de Datos Personales',
    'Por seguridad y protección de datos personales, la información de contacto de los postulantes no se incluye en los documentos exportados.'
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
      'ID',
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
        a.id,
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
        a.canil ? `${a.canil.codigo} (${a.canil.nombre})` : 'Sin asignar',
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
    addRow(['CONSOLIDADO DE ADOPCIONES Y DEVOLUCIONES (SIN DATOS PERSONALES DE POSTULANTES)']);
    addRow(['ID Solicitud', 'Animal', 'Especie', 'Postulante', 'Etapa del Proceso', 'Devolución Registrada', 'Fecha Solicitud']);
    for (const ad of listaAdop) {
      addRow([
        ad.id,
        ad.animal?.nombre || '',
        ad.animal?.especie || '',
        'Información de contacto no incluida por protección de datos',
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
    addRow(['ID', 'Producto', 'Categoría', 'Stock Actual', 'Stock Mínimo', 'Estado Abastecimiento']);
    for (const ins of insumos) {
      addRow([
        ins.id,
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
    mensaje: `La Dirección (${user.nombre}) exportó el Reporte Consolidado de Gestión (${sec}) en formato ${formatoSalida}. Por protección de datos, la información de contacto de los postulantes no se incluye.`,
    destinatarios: ['DIRECTORA', 'VETERINARIA', 'ENCARGADA_ADOPCIONES'],
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
