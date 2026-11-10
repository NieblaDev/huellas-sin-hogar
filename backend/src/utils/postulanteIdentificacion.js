export const normalizarIdentificacion = (valor, tipo = 'RUT') => {
  const texto = valor.trim().toUpperCase();
  return tipo === 'RUT' ? texto.replace(/[.\s-]/g, '') : texto.replace(/\s+/g, '');
};

export const esRutValido = (rut) => {
  if (!/^[1-9]\d{6,7}[0-9K]$/.test(rut)) return false;
  const cuerpo = rut.slice(0, -1);
  let suma = 0;
  let factor = 2;
  for (const digito of [...cuerpo].reverse()) {
    suma += Number(digito) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  const verificador = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  return rut.endsWith(verificador);
};
