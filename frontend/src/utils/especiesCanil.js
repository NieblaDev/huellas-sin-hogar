export function mezclaPerrosYGatos(animales = []) {
  const especies = new Set(animales.map(animal => animal.especie));
  return especies.has('Perro') && especies.has('Gato');
}

export function aceptaEspecieEnCanil(animal, canil) {
  return !mezclaPerrosYGatos([
    ...(canil.animales || []).filter(residente => residente.id !== animal.id),
    animal
  ]);
}
