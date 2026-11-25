export function observacionesAnimal(nota) {
  const texto = (nota || '').replace(/^\[Ingreso por (Rescate|Abandono|Decomiso)\]\s*/i, '').trim();
  return /^Sin antecedentes (clínicos|médicos) registrados al ingreso\.?$/i.test(texto) ? '' : texto;
}
