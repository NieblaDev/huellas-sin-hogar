export const DIAS_MATRIZ = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const FRANJAS_MATRIZ = [
  { nombre: 'Mañana', horario: '08:00 - 13:00' },
  { nombre: 'Tarde', horario: '14:00 - 19:00' }
];

export const fechaCortaTurno = fecha => fecha?.slice(0, 10).split('-').reverse().join('/');

function dividirTexto(contexto, texto, ancho) {
  const lineas = [];
  let linea = '';
  for (const palabra of texto.split(/\s+/)) {
    const candidato = linea ? `${linea} ${palabra}` : palabra;
    if (linea && contexto.measureText(candidato).width > ancho) {
      lineas.push(linea);
      linea = palabra;
    } else {
      linea = candidato;
    }
  }
  if (linea) lineas.push(linea);
  return lineas;
}

export async function exportarMatrizPNG(matriz) {
  const lienzo = document.createElement('canvas');
  const contexto = lienzo.getContext('2d');
  if (!contexto) throw new Error('Este navegador no pudo preparar la imagen.');

  const margen = 28;
  const anchoFranja = 138;
  const anchoDia = 200;
  const ancho = margen * 2 + anchoFranja + anchoDia * DIAS_MATRIZ.length;
  const altoLinea = 20;
  const filas = FRANJAS_MATRIZ.map(({ nombre, horario }) => {
    const celdas = DIAS_MATRIZ.map(dia => (matriz.turnosPorFranja?.[nombre]?.[dia] || []).map(turno => {
      const inscritos = turno.inscripciones || [];
      const lineas = [
        { texto: turno.area, destacado: true },
        { texto: `Aforo: ${inscritos.length} / ${turno.cupoMaximo}` },
        ...(inscritos.length
          ? inscritos.map(inscrito => ({ texto: inscrito.usuario?.nombre || 'Voluntario inscrito' }))
          : [{ texto: 'Turno sin cubrir' }])
      ];
      if (turno.esCritica || /veterinaria|clínica/i.test(turno.area)) lineas.push({ texto: 'Tarea crítica' });
      const texto = lineas.flatMap(({ texto, destacado }) => {
        contexto.font = destacado ? 'bold 15px sans-serif' : '14px sans-serif';
        return dividirTexto(contexto, texto, anchoDia - 36).map(linea => ({ linea, destacado }));
      });
      return { texto, cubierto: inscritos.length > 0, alto: texto.length * altoLinea + 20 };
    }));
    const alto = Math.max(66, ...celdas.map(turnos => turnos.reduce((total, turno) => total + turno.alto + 8, 8)));
    return { nombre, horario, celdas, alto };
  });

  const inicioFilas = 155;
  const alto = filas.reduce((total, fila) => total + fila.alto, inicioFilas + margen);
  const escala = Math.min(2, 8192 / alto);
  lienzo.width = Math.ceil(ancho * escala);
  lienzo.height = Math.ceil(alto * escala);
  contexto.scale(escala, escala);
  contexto.fillStyle = '#ffffff';
  contexto.fillRect(0, 0, ancho, alto);
  contexto.textBaseline = 'top';

  const escribir = (texto, x, y, maximo, fuente = '14px sans-serif', color = '#1f2430') => {
    contexto.font = fuente;
    contexto.fillStyle = color;
    contexto.fillText(texto, x, y, maximo);
  };

  escribir('Matriz semanal de turnos', margen, 24, ancho, 'bold 28px sans-serif');
  const estado = matriz.estadisticas?.planificacionConfirmada ? 'Confirmada' : 'En planificación';
  const fechas = matriz.fechas || [];
  const periodo = fechas.length ? `Semana del ${fechaCortaTurno(fechas[0])} al ${fechaCortaTurno(fechas[6])}` : 'Turnos sin fecha';
  escribir(`${periodo} · Planificación: ${estado}`, margen, 64, ancho, '15px sans-serif', '#47752f');
  contexto.fillStyle = '#e7f1db';
  contexto.fillRect(margen, 92, ancho - margen * 2, 62);
  escribir('Franja horaria', margen + 12, 105, anchoFranja - 24, 'bold 15px sans-serif');
  DIAS_MATRIZ.forEach((dia, indice) => {
    const x = margen + anchoFranja + indice * anchoDia + 12;
    escribir(dia, x, 105, anchoDia - 24, 'bold 15px sans-serif');
    if (fechas[indice]) escribir(fechaCortaTurno(fechas[indice]), x, 126, anchoDia - 24);
  });

  let y = inicioFilas;
  for (const fila of filas) {
    contexto.fillStyle = '#f5f8ef';
    contexto.fillRect(margen, y, anchoFranja, fila.alto);
    escribir(fila.nombre, margen + 12, y + 14, anchoFranja - 24, 'bold 15px sans-serif');
    escribir(fila.horario, margen + 12, y + 36, anchoFranja - 24, '13px sans-serif');
    fila.celdas.forEach((turnos, indice) => {
      const x = margen + anchoFranja + indice * anchoDia;
      contexto.strokeStyle = '#dce3d5';
      contexto.strokeRect(x, y, anchoDia, fila.alto);
      if (!turnos.length) escribir('Sin turnos', x + 14, y + 14, anchoDia - 28, '14px sans-serif', '#64748b');
      let yTurno = y + 8;
      for (const turno of turnos) {
        contexto.fillStyle = turno.cubierto ? '#e7f1db' : '#fff5e3';
        contexto.fillRect(x + 8, yTurno, anchoDia - 16, turno.alto);
        turno.texto.forEach(({ linea, destacado }, indiceLinea) => {
          escribir(linea, x + 18, yTurno + 10 + indiceLinea * altoLinea, anchoDia - 36, destacado ? 'bold 15px sans-serif' : '14px sans-serif');
        });
        yTurno += turno.alto + 8;
      }
    });
    y += fila.alto;
  }

  const imagen = await new Promise(resolve => lienzo.toBlob(resolve, 'image/png'));
  if (!imagen) throw new Error('No se pudo generar la imagen de la matriz.');
  const url = URL.createObjectURL(imagen);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = fechas.length ? `matriz-semanal-${fechas[0]}.png` : 'matriz-turnos-sin-fecha.png';
  enlace.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
