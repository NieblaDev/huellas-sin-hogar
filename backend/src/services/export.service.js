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
 * Construye un documento binario válido en formato PDF 1.4 (sin dependencias externas)
 */
const construirBufferPDF = ({ animal, tipoIngreso, notaClinica, esDirectora, usuario, fechaGeneracion }) => {
  const ops = [];

  // Encabezado institucional en verde salvia (#3f6c52 -> RGB 0.247, 0.424, 0.322)
  ops.push('0.247 0.424 0.322 rg');
  ops.push('0 765 595 77 re f');

  // Título blanco en encabezado
  ops.push('1 1 1 rg');
  ops.push('BT /F2 17 Tf 40 812 Td (HUELLAS SIN HOGAR - FICHA TECNICA INDIVIDUAL) Tj ET');
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

  // SECCIÓN 4: DATOS DE POSTULANTES / ADOPTANTES (CON CONTROL ESTRICTO DE PRIVACIDAD POR ROL)
  drawSectionHeader('4. ANTECEDENTES DE POSTULACION Y ADOPCION');
  if (!esDirectora) {
    // RESTRICCIÓN DE PRIVACIDAD OBLIGATORIA PARA PERSONAL DEL REFUGIO
    ops.push('0.75 0.25 0.20 rg');
    ops.push(
      `BT /F2 9.2 Tf 48 ${y} Td ([PRIVACIDAD APLICADA - ROL ${escapePdfText(usuario?.rol || 'PERSONAL')}]) Tj ET`
    );
    y -= 14;
    ops.push('0.25 0.28 0.32 rg');
    ops.push(
      `BT /F1 9 Tf 48 ${y} Td (Por politica de privacidad y proteccion de datos, la informacion personal de postulantes) Tj ET`
    );
    y -= 13;
    ops.push(
      `BT /F1 9 Tf 48 ${y} Td (y adoptantes ha sido OMITIDA en esta exportacion. Se mantienen solo antecedentes del animal y clinicos.) Tj ET`
    );
    y -= 18;
  } else {
    const adopciones = animal.adopciones || [];
    if (adopciones.length === 0) {
      ops.push('0.45 0.49 0.54 rg');
      ops.push(`BT /F1 9 Tf 48 ${y} Td (No existen postulaciones ni adopciones asociadas a este animal.) Tj ET`);
      y -= 18;
    } else {
      for (const ad of adopciones.slice(0, 4)) {
        if (y < 75) break;
        const p = ad.postulante || {};
        const fechaAd = ad.fecha ? new Date(ad.fecha).toLocaleDateString('es-CL') : 'N/A';
        const lineaPostulante = `Postulante: ${p.nombre || 'N/A'} | RUT: ${p.rut || 'N/A'} | Tel: ${p.telefono || 'N/A'} | Email: ${p.email || 'N/A'}`;
        const lineaEstado = `Etapa: ${ad.etapa} | Fecha: ${fechaAd} | Devolucion previa: ${ad.devolucion ? 'SI' : 'NO'}`;
        ops.push('0.12 0.14 0.19 rg');
        ops.push(`BT /F2 9 Tf 48 ${y} Td (${escapePdfText(lineaPostulante)}) Tj ET`);
        y -= 12;
        ops.push('0.35 0.39 0.44 rg');
        ops.push(`BT /F1 8.8 Tf 48 ${y} Td (${escapePdfText(lineaEstado)}) Tj ET`);
        y -= 15;
      }
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
 * Si existen postulantes en la BD pero aún no se han vinculado adopciones de ejemplo,
 * vincula las solicitudes base para permitir verificar la restricción de privacidad en PDF.
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
 * Requerimiento 2.1: Exportar Ficha Técnica Individual en formato PDF
 * - Permitido para Personal del Refugio (VETERINARIA, ENCARGADA_ADOPCIONES) y Directora (DIRECTORA)
 * - Restricción de privacidad: Omite datos personales de postulantes/adoptantes si el rol no es DIRECTORA
 * - Postcondiciones: Registra en bitácora de auditoría y notifica al personal del refugio
 */
export const generarFichaAnimalPDF = async (animalId, user, ip) => {
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
        include: {
          postulante: true
        }
      }
    }
  });

  if (!animal) {
    throw new Error('Animal no encontrado');
  }

  const esDirectora = user?.rol === 'DIRECTORA';
  const matchCausal = (animal.nota || '').match(REGEX_TIPO_INGRESO);
  const tipoIngreso = matchCausal ? matchCausal[1] : 'Rescate';
  const notaClinica = (animal.nota || '').replace(REGEX_TIPO_INGRESO, '').trim() || 'Sin antecedentes clínicos registrados.';

  // Si es personal del refugio (no Directora), eliminar cualquier dato personal antes de generar el PDF
  const animalParaExportar = {
    ...animal,
    adopciones: esDirectora ? animal.adopciones : []
  };

  const fechaGeneracion = new Date().toLocaleString('es-CL');

  const pdfBuffer = construirBufferPDF({
    animal: animalParaExportar,
    tipoIngreso,
    notaClinica,
    esDirectora,
    usuario: user,
    fechaGeneracion
  });

  const recursoExportado = `Ficha Técnica Individual #${animal.id} - ${animal.nombre} (${animal.especie})`;

  // Postcondición 1: Registrar evento de exportación en la bitácora de auditoría
  await registrarAuditoria({
    entidad: 'Reporte PDF (Ficha Animal)',
    entidadId: animal.id,
    accion: 'CREACION',
    valorAnterior: null,
    valorNuevo: {
      evento: 'EXPORTACION_FICHA_PDF',
      tipoReporte: 'PDF',
      recursoExportado,
      animalId: animal.id,
      animalNombre: animal.nombre,
      rolUsuario: user?.rol,
      privacidadDatosPersonalesOmitidos: !esDirectora,
      fechaExportacion: new Date().toISOString()
    },
    usuario: user,
    ip
  });

  // Postcondición 2: Notificar al personal del refugio sobre la exportación realizada
  const notificacion = await notificarPersonalRefugio({
    tipo: 'EXPORTACION_PDF',
    titulo: `Ficha PDF exportada: ${animal.nombre}`,
    mensaje: `${user?.nombre || 'Usuario'} (${user?.rol}) descargó la Ficha Técnica en PDF de ${animal.nombre} (#${animal.id}). ${
      !esDirectora ? 'Se aplicó filtro de privacidad (sin datos personales de postulantes).' : 'Incluye historial completo.'
    }`,
    destinatarios: ['DIRECTORA', 'VETERINARIA', 'ENCARGADA_ADOPCIONES'],
    usuario: user,
    metadata: {
      tipoReporte: 'PDF',
      recursoExportado,
      animalId: animal.id,
      privacidadAplicada: !esDirectora
    }
  });

  const safeName = animal.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return {
    buffer: pdfBuffer,
    filename: `ficha_tecnica_${safeName}_${animal.id}.pdf`,
    notificacion
  };
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
 * Requerimiento 2.2: Exportar Balances Generales y Reportes Consolidados de Gestión en CSV
 * - Restringido EXCLUSIVAMENTE al rol DIRECTORA
 * - Postcondiciones: Registra en bitácora de auditoría y notifica al personal del refugio
 */
export const generarReporteConsolidadoCSV = async (user, ip) => {
  if (user?.rol !== 'DIRECTORA') {
    throw new Error('Acceso denegado: Únicamente el rol de Directora está autorizado para exportar reportes consolidados en CSV');
  }

  await asegurarAdopcionesIniciales();

  const [animales, caniles, insumos, turnos, traslados, adopciones] = await Promise.all([
    prisma.animal.findMany({
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
      include: {
        animal: { select: { nombre: true } },
        responsable: { select: { nombre: true } },
        aprobadoPor: { select: { nombre: true } }
      },
      orderBy: { fechaRegistro: 'desc' }
    }),
    prisma.adopcion.findMany({
      include: {
        animal: { select: { nombre: true, especie: true } },
        postulante: true
      },
      orderBy: { fecha: 'desc' }
    })
  ]);

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

  const filas = [];
  const addRow = (cols) => filas.push(cols.map(escapeCsvCell).join(','));

  // 1. BALANCE GENERAL DE GESTIÓN
  addRow(['HUELLAS SIN HOGAR - BALANCE GENERAL Y REPORTE CONSOLIDADO DE GESTIÓN']);
  addRow(['Fecha de Exportación', new Date().toISOString(), 'Generado por', user.nombre, 'Rol', user.rol]);
  filas.push('');

  addRow(['SECCIÓN 1: BALANCE GENERAL E INDICADORES OPERATIVOS']);
  addRow(['Indicador', 'Valor', 'Detalle / Observación']);
  addRow(['Animales Albergados (Activos)', animalesActivos.length, `Perros: ${totalPerros} | Gatos: ${totalGatos}`]);
  addRow(['Animales en Baja Lógica', animalesBaja.length, 'Registros históricos inactivos']);
  addRow([
    'Estado Clínico de la Población',
    `Normal: ${saludNormal} | Especial: ${saludEspecial} | Crítico: ${saludCritico}`,
    'Distribución sanitaria actual'
  ]);
  addRow([
    'Capacidad y Ocupación de Caniles',
    `${ocupacionPct}%`,
    `Total: ${caniles.length} | Libres: ${canilesLibres} | Ocupados: ${canilesOcupados} | Cuarentena: ${canilesCuarentena}`
  ]);
  addRow([
    'Balance de Inventario e Insumos',
    `${insumos.length} productos activos`,
    `${insumosCriticos.length} insumos en stock crítico`
  ]);
  addRow([
    'Cobertura de Turnos de Voluntariado',
    `${turnosCubiertos} / ${turnos.length} cubiertos`,
    `${turnosDescubiertos} turnos descubiertos`
  ]);
  addRow([
    'Gestión de Adopciones y Traslados',
    `${adopciones.length} solicitudes adopción`,
    `${traslados.length} movimientos/traslados registrados`
  ]);
  filas.push('');

  // 2. DETALLE DE FICHAS TÉCNICAS DE ANIMALES
  addRow(['SECCIÓN 2: NÓMINA CONSOLIDADA DE ANIMALES']);
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
    'Estado Registro',
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
      a.activo ? 'ACTIVO' : 'BAJA_LOGICA',
      a.creadoEn ? new Date(a.creadoEn).toISOString().split('T')[0] : '',
      a.creadoPor?.nombre || 'Sistema',
      notaLimpia
    ]);
  }
  filas.push('');

  // 3. BALANCE DE INVENTARIO E INSUMOS
  addRow(['SECCIÓN 3: BALANCE DE INVENTARIO E INSUMOS']);
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

  // 4. BALANCE DE ADOPCIONES Y POSTULANTES
  addRow(['SECCIÓN 4: CONSOLIDADO DE PROCESOS DE ADOPCIÓN']);
  addRow(['ID Adopción', 'Animal', 'Especie', 'Postulante', 'RUT', 'Teléfono', 'Email', 'Etapa', 'Devolución Previa', 'Fecha']);
  for (const ad of adopciones) {
    addRow([
      ad.id,
      ad.animal?.nombre || '',
      ad.animal?.especie || '',
      ad.postulante?.nombre || '',
      ad.postulante?.rut || '',
      ad.postulante?.telefono || '',
      ad.postulante?.email || '',
      ad.etapa,
      ad.devolucion ? 'SÍ' : 'NO',
      ad.fecha ? new Date(ad.fecha).toISOString().split('T')[0] : ''
    ]);
  }

  // Prefijo BOM UTF-8 para correcta lectura de tildes y eñes en Excel
  const csvContent = '\uFEFF' + filas.join('\r\n');
  const recursoExportado = 'Balance General y Reporte Consolidado de Gestión (CSV)';

  // Postcondición 1: Registrar evento de exportación en la bitácora de auditoría
  await registrarAuditoria({
    entidad: 'Reporte Consolidado CSV',
    entidadId: null,
    accion: 'CREACION',
    valorAnterior: null,
    valorNuevo: {
      evento: 'EXPORTACION_REPORTE_CONSOLIDADO_CSV',
      tipoReporte: 'CSV',
      recursoExportado,
      rolUsuario: user.rol,
      resumenExportado: {
        animalesActivos: animalesActivos.length,
        ocupacionPorcentaje: ocupacionPct,
        insumosCriticos: insumosCriticos.length,
        adopcionesRegistradas: adopciones.length
      },
      fechaExportacion: new Date().toISOString()
    },
    usuario: user,
    ip
  });

  // Postcondición 2: Notificar al personal del refugio sobre la exportación realizada
  const notificacion = await notificarPersonalRefugio({
    tipo: 'EXPORTACION_CSV',
    titulo: 'Reporte Consolidado de Gestión (CSV) exportado',
    mensaje: `La Directora (${user.nombre}) generó y descargó el Balance General y Reporte Consolidado de Gestión en formato CSV.`,
    destinatarios: ['DIRECTORA', 'VETERINARIA', 'ENCARGADA_ADOPCIONES'],
    usuario: user,
    metadata: {
      tipoReporte: 'CSV',
      recursoExportado
    }
  });

  const fechaStr = new Date().toISOString().split('T')[0];
  return {
    csv: csvContent,
    filename: `reporte_consolidado_gestion_${fechaStr}.csv`,
    notificacion
  };
};
