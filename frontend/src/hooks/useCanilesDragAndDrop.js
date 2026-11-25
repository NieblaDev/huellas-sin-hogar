import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';

export function destinoInvalido(animal, destino, origen) {
  if (!destino) return 'Selecciona un destino.';
  if (origen?.id === destino.id) return 'El animal ya ocupa este canil.';
  if (animal.activo === false || animal.estadoAdopcion === 'ADOPTADO') return 'El animal está adoptado o inactivo.';
  if (destino.estado === 'MANTENIMIENTO') return 'El canil está en mantenimiento.';
  if ([destino.estado, origen?.estado].includes('CUARENTENA')) return 'Finaliza la cuarentena antes del movimiento.';
  if (!destino.ocupacion.libres) return 'El destino está sin cupos.';
  return '';
}

function siguienteCanil(event, { currentCoordinates, context }) {
  const pasos = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };
  if (!pasos[event.code]) return;
  event.preventDefault();
  const items = context.droppableContainers.getEnabled();
  const indice = items.findIndex(i => i.id === (context.over?.id ?? context.active?.data.current.origen.id));
  const rect = context.droppableRects.get(items[indice + pasos[event.code]]?.id);
  if (!rect || !context.collisionRect) return;
  return { x: currentCoordinates.x + rect.left + rect.width/2 - context.collisionRect.left - context.collisionRect.width/2,
    y: currentCoordinates.y + rect.top + rect.height/2 - context.collisionRect.top - context.collisionRect.height/2 };
}
export function useCanilesDragAndDrop() {
  return useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: siguienteCanil }));
}

export const accesibilidadArrastre = {
  screenReaderInstructions: { draggable: 'Pulsa espacio para levantar al animal, elige un canil con las flechas y pulsa espacio para soltar. Escape cancela.' },
  announcements: {
    onDragStart: ({active}) => 'Has levantado a ' + active.data.current.animal.nombre,
    onDragOver: ({over}) => over ? 'Destino: ' + over.data.current.nombre : 'Fuera de un canil',
    onDragEnd: ({over}) => over ? 'Soltaste al animal en ' + over.data.current.nombre : 'Movimiento cancelado',
    onDragCancel: () => 'Movimiento cancelado'
  }
};
