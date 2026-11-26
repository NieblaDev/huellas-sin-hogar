const condiciones = {
  NORMAL: 'Normal',
  ESPECIAL: 'Especial',
  CRITICO: 'Crítico'
};

export const formatearCondicionAnimal = estado => condiciones[estado];

export function resumirAnimalEnCanil({ especie, edad, estadoSalud }) {
  return [especie || 'Especie sin registrar', edad || 'Edad sin registrar',
    formatearCondicionAnimal(estadoSalud) || 'Condición sin registrar'].join(' · ');
}
