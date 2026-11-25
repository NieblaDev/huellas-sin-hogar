const dia = fecha => Date.parse(new Date(fecha).toISOString().slice(0, 10)) / 86400000;
export const diferenciaDias = (desde, hasta) => dia(hasta) - dia(desde);
export const diasEntre = (desde, hasta = new Date()) => desde ? Math.max(0, diferenciaDias(desde, hasta)) : null;
