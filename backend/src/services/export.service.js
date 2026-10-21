import prisma from '../config/prisma.js';
import { registrarAuditoria } from './audit.service.js';
import { notificarPersonalRefugio } from './notification.service.js';

const REGEX_TIPO_INGRESO = /^\[Ingreso por (Rescate|Abandono|Decomiso)\]\s*/i;

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
 * Construye un documento binario válido en formato PDF 1.4 (sin dependencias externas).
 * Cumple RF9: Omite estrictamente datos personales de postulantes/adoptantes en todo documento exportado.
 */
const construirBufferPDF = ({ animal, tipoIngreso, notaClinica, usuario, fechaGeneracion }) => {
  const ops = [];

  // Encabezado institucional en verde salvia (#3f6c52 -> RGB 0.247, 0.424, 0.322)
  ops.push('0.247 0.424 0.322 rg');
  ops.push('0 765 595 77 re f');

  // Título blanco en encabezado
  ops.push('1 1 1 rg');
  ops.push('BT /F2 17 Tf 40 812 Td (HUELLAS SIN HOGAR - EXPEDIENTE Y FICHA TECNICA) Tj ET');
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

  // SECCIÓN 1: ANTECEDENTES GENERALES DEL ANIMAL
  drawSectionHeader('1. IDENTIFICACION Y ANTECEDENTES DEL ANIMAL');
  drawKeyValueRow('Nombre:', animal.nombre || 'Sin nombre', 'Causal de Ingreso:', tipoIngreso || 'Rescate');
  drawKeyValueRow('Especie:', animal.especie || 'No especificada', 'Sexo:', animal.sexo || 'No especificado');
  drawKeyValueRow('Edad Aproximada:', animal.edad || 'Desconocida', 'Raza:', animal.raza || 'Desconocida');
  drawKeyValueRow(
    'Peso Registrado:',
    animal.peso && animal.peso > 0 ? `${animal.peso} kg` : 'No registrado (0 kg)',
    'Microchip:',
    animal.chip || 'Sin microchip registrado'
  );
  drawKeyValueRow(
    'Estado en Refugio:',
    animal.activo ? 'Activo (Albergado)' : 'Baja logica',
    'Fecha de Ingreso:',
    animal.creadoEn ? new Date(animal.creadoEn).toLocaleDateString('es-CL') : 'N/A'
  );
  drawKeyValueRow(
    'Ubicacion / Canil:',
    animal.canil ? `${animal.canil.nombre} (${animal.canil.codigo} - ${animal.canil.sector})` : 'Sin canil asignado',
    'Fotografia en Ficha:',
    animal.fotoUrl ? 'Si (Registrada en sistema)' : 'No disponible'
  );

  y -= 6;

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

  // SECCIÓN 4: TRAZABILIDAD DE ADOPCIONES Y DEVOLUCIONES (SIN DATOS PERSONALES POR PRIVACIDAD RF9)
  drawSectionHeader('4. TRAZABILIDAD DE ADOPCIONES Y DEVOLUCIONES (PRIVACIDAD RF9)');
  ops.push('0.75 0.25 0.20 rg');
  ops.push(
    `BT /F2 9 Tf 48 ${y} Td ([POLITICA DE PRIVACIDAD RF9: DATOS PERSONALES DE POSTULANTES OMITIDOS ESTRICTAMENTE]) Tj ET`
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
      const lineaAnonima = `Solicitud #${ad.id} | Postulante: [DATOS PERSONALES OMITIDOS] | Etapa: ${ad.etapa} | Fecha: ${fechaAd} | Devolucion: ${
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
  pdfStr += `xref\n0 ${objects.length + 1}\n`;
  pdfStr += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdfStr += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdfStr += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdfStr, 'latin1');
};

/**
 * Construye un PDF de Reporte Consolidado de Gestión Operativa (RF9)
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
      `Balance Operativo: Ingresos, Adopciones, Devoluciones, Censo e Insumos | Privacidad RF9 Activa`
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
    'Desglose por Causal (RF8):',
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
  drawHeader('3. BALANCE DE ADOPCIONES Y DEVOLUCIONES (DATOS PERSONALES OMITIDOS)');
  drawLine(
    'Procesos de Adopcion:',
    `Total solicitudes: ${resumen.totalAdopciones} | Concretadas (Adoptado): ${resumen.adopcionesConcretadas}`
  );
  drawLine(
    'Devoluciones Registradas:',
    `${resumen.totalDevoluciones} casos con devolucion (${resumen.tasaDevolucion}% sobre solicitudes)`
  );
  drawLine('Privacidad de Postulantes:', 'OMITIDOS ESTRICTAMENTE (Nombre, RUT, Telefono y Correo excluidos por RF9)');

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
 * RF9: Exportar Expediente / Ficha Técnica Individual (en PDF o CSV)
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
    addRow(['HUELLAS SIN HOGAR - EXPEDIENTE Y FICHA TÉCNICA INDIVIDUAL (RF9)']);
    addRow(['ID Ficha', animal.id, 'Nombre', animal.nombre, 'Causal de Ingreso', tipoIngreso]);
    addRow(['Especie', animal.especie, 'Sexo', animal.sexo, 'Edad Aproximada', animal.edad || 'Desconocida']);
    addRow(['Raza', animal.raza || 'Desconocida', 'Peso (kg)', animal.peso ?? 0, 'Microchip', animal.chip || 'Sin chip']);
    addRow(['Estado Salud', animal.estadoSalud, 'Esterilización', animal.esterilizacion || 'Desconocido', 'Comportamiento', animal.comportamiento || 'Por evaluar']);
    addRow(['Ubicación / Canil', animal.canil ? `${animal.canil.codigo} (${animal.canil.nombre})` : 'Sin asignar', 'Fecha Ingreso', animal.creadoEn ? new Date(animal.creadoEn).toISOString().split('T')[0] : '']);
    addRow(['Historial Médico / Notas Clínicas', notaClinica]);
    filas.push('');
    addRow(['TRAZABILIDAD DE ADOPCIONES Y DEVOLUCIONES (DATOS PERSONALES DE POSTULANTES OMITIDOS POR PRIVACIDAD RF9)']);
    addRow(['ID Solicitud', 'Postulante', 'Etapa', 'Devolución Previa', 'Fecha']);
    for (const ad of animal.adopciones || []) {
      addRow([
        ad.id,
        '[DATOS PERSONALES OMITIDOS POR PRIVACIDAD]',
        ad.etapa,
        ad.devolucion ? 'SÍ' : 'NO',
        ad.fecha ? new Date(ad.fecha).toISOString().split('T')[0] : ''
      ]);
    }
    bufferOrContent = Buffer.from('\uFEFF' + filas.join('\r\n'), 'utf-8');
    filename = `expediente_${safeName}_${animal.id}.csv`;
    contentType = 'text/csv; charset=utf-8';
  } else {
    bufferOrContent = construirBufferPDF({
      animal,
      tipoIngreso,
      notaClinica,
      usuario: user,
      fechaGeneracion
    });
    filename = `ficha_tecnica_${safeName}_${animal.id}.pdf`;
    contentType = 'application/pdf';
  }

  const recursoExportado = `Expediente / Ficha Técnica Individual #${animal.id} - ${animal.nombre} (${formato})`;

  // Postcondición RF9: Registrar evento de exportación en la bitácora de auditoría
  await registrarAuditoria({
    entidad: `Reporte ${formato} (Ficha Animal)`,
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
    titulo: `Expediente ${formato} exportado: ${animal.nombre}`,
    mensaje: `${user?.nombre || 'Usuario'} (${user?.rol}) exportó el expediente clínico de ${animal.nombre} (#${animal.id}) en formato ${formato}. Datos personales de postulantes omitidos por privacidad.`,
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
 * RF9: Generar y Exportar Reportes Consolidados de Gestión Operativa
 * (Balance de ingresos, adopciones, devoluciones, censo y estado de insumos)
 * - Configurando rangos de fecha (fechaDesde, fechaHasta), tipos de información y filtros requeridos
 * - Restricción: Solo si el usuario posee rol de DIRECTORA
 * - Restricción de privacidad: Omite estrictamente los datos personales de postulantes
 * - Postcondición: Registra la consulta en la bitácora de auditoría y entrega el archivo (CSV o PDF)
 */
export const generarReporteConsolidadoCSV = async (user, ip, query = {}) => {
  if (user?.rol !== 'DIRECTORA') {
    throw new Error('Acceso denegado: El sistema genera reportes consolidados solo si el usuario posee rol de Directora');
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
        // Se omite `postulante` para garantizar que ningún dato personal de postulantes sea incluido (RF9)
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

  // Cálculo de métricas de las 5 dimensiones de RF9: Ingresos, Adopciones, Devoluciones, Censo e Insumos
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
  addRow(['HUELLAS SIN HOGAR - REPORTE CONSOLIDADO DE GESTIÓN OPERATIVA (RF9)']);
  addRow(['Fecha de Exportación', new Date().toISOString(), 'Generado por', user.nombre, 'Rol', user.rol]);
  addRow([
    'Rango de Fechas',
    `${fechaDesde || 'Inicio histórico'} a ${fechaHasta || 'Actualidad'}`,
    'Tipo de Información',
    sec,
    'Filtros',
    `Especie: ${especie || 'Todas'} | Salud: ${estadoSalud || 'Todos'} | Causal: ${tipoIngreso || 'Todas'}`
  ]);
  addRow(['Política de Privacidad RF9', 'Datos personales de postulantes omitidos estrictamente en este documento']);
  filas.push('');

  // RESUMEN EJECUTIVO DE LAS 5 DIMENSIONES DE RF9
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

  // SECCIÓN DETALLADA: ADOPCIONES Y DEVOLUCIONES (SIN DATOS PERSONALES DE POSTULANTES - RF9)
  if (incluirAdopciones || incluirDevoluciones) {
    const listaAdop = incluirDevoluciones && !incluirAdopciones ? devolucionesList : adopciones;
    addRow(['CONSOLIDADO DE ADOPCIONES Y DEVOLUCIONES (DATOS PERSONALES DE POSTULANTES OMITIDOS POR PRIVACIDAD RF9)']);
    addRow(['ID Solicitud', 'Animal', 'Especie', 'Postulante (Privacidad RF9)', 'Etapa del Proceso', 'Devolución Registrada', 'Fecha Solicitud']);
    for (const ad of listaAdop) {
      addRow([
        ad.id,
        ad.animal?.nombre || '',
        ad.animal?.especie || '',
        '[DATOS PERSONALES OMITIDOS POR PRIVACIDAD]',
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

  // Postcondición RF9: Registrar consulta/exportación en la bitácora de auditoría
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
    mensaje: `La Directora (${user.nombre}) exportó el Reporte Consolidado de Gestión (${sec}) en formato ${formatoSalida}. Datos de postulantes omitidos por privacidad.`,
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
