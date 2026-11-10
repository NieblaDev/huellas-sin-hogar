import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crearInsumoSchema,
  actualizarInsumoSchema,
  registrarMovimientoSchema
} from '../src/schemas/insumo.schema.js';

test('crearInsumoSchema: valida campos correctos y stock inicial no negativo', () => {
  const dataValida = {
    nombre: 'Amoxicilina 250mg',
    categoria: 'Medicamento',
    stock: 20,
    stockMinimo: 10,
    unidad: 'Cajas',
    esFarmaco: true,
    fechaVencimiento: '2026-12-31T00:00:00.000Z',
    lote: 'LOT-1234',
    ubicacion: 'Farmacia Clínica'
  };

  const parsed = crearInsumoSchema.parse(dataValida);
  assert.equal(parsed.nombre, 'Amoxicilina 250mg');
  assert.equal(parsed.stock, 20);
  assert.equal(parsed.esFarmaco, true);

  // Prohibición de saldo inicial negativo
  const dataInvalidaStock = { ...dataValida, stock: -5 };
  const resNegativo = crearInsumoSchema.safeParse(dataInvalidaStock);
  assert.equal(resNegativo.success, false);
  assert.ok(resNegativo.error.errors.some(e => e.path.includes('stock')));
});

test('registrarMovimientoSchema: valida entradas clasificadas por donación o compra', () => {
  const entradaDonacion = {
    tipo: 'ENTRADA',
    subtipo: 'DONACION',
    cantidad: 15,
    motivo: 'Donación recibida de agrupación animalista aliada',
    donanteOProveedor: 'Huellitas de Amor',
    lote: 'DON-2026-1'
  };

  const parsedDonacion = registrarMovimientoSchema.parse(entradaDonacion);
  assert.equal(parsedDonacion.tipo, 'ENTRADA');
  assert.equal(parsedDonacion.subtipo, 'DONACION');
  assert.equal(parsedDonacion.cantidad, 15);

  const entradaCompra = {
    tipo: 'ENTRADA',
    subtipo: 'COMPRA',
    cantidad: 50,
    motivo: 'Compra trimestral de antiparasitarios',
    donanteOProveedor: 'Distribuidora Veterinaria Central'
  };

  const parsedCompra = registrarMovimientoSchema.parse(entradaCompra);
  assert.equal(parsedCompra.tipo, 'ENTRADA');
  assert.equal(parsedCompra.subtipo, 'COMPRA');
});

test('registrarMovimientoSchema: valida salidas por consumo o vinculación a tratamiento médico', () => {
  const salidaConsumo = {
    tipo: 'SALIDA',
    subtipo: 'CONSUMO',
    cantidad: 2,
    motivo: 'Alimentación matutina caniles sector A'
  };

  const parsedConsumo = registrarMovimientoSchema.parse(salidaConsumo);
  assert.equal(parsedConsumo.tipo, 'SALIDA');
  assert.equal(parsedConsumo.subtipo, 'CONSUMO');

  const salidaTratamiento = {
    tipo: 'SALIDA',
    subtipo: 'TRATAMIENTO_MEDICO',
    cantidad: 1,
    motivo: 'Dosis antibiótica para tratamiento de infección post-rescate',
    animalId: 4
  };

  const parsedTratamiento = registrarMovimientoSchema.parse(salidaTratamiento);
  assert.equal(parsedTratamiento.tipo, 'SALIDA');
  assert.equal(parsedTratamiento.subtipo, 'TRATAMIENTO_MEDICO');
  assert.equal(parsedTratamiento.animalId, 4);
});

test('registrarMovimientoSchema: rechaza inconsistencias de tipo y subtipo y cantidades <= 0', () => {
  // Entrada no puede ser CONSUMO
  const cruceInvalido = {
    tipo: 'ENTRADA',
    subtipo: 'CONSUMO',
    cantidad: 10,
    motivo: 'Error de prueba'
  };
  assert.equal(registrarMovimientoSchema.safeParse(cruceInvalido).success, false);

  // Salida no puede ser DONACION
  const cruceInvalido2 = {
    tipo: 'SALIDA',
    subtipo: 'DONACION',
    cantidad: 5,
    motivo: 'Error de prueba 2'
  };
  assert.equal(registrarMovimientoSchema.safeParse(cruceInvalido2).success, false);

  // Cantidad <= 0 debe ser rechazada
  const cantidadCero = {
    tipo: 'SALIDA',
    subtipo: 'CONSUMO',
    cantidad: 0,
    motivo: 'Prueba cantidad 0'
  };
  assert.equal(registrarMovimientoSchema.safeParse(cantidadCero).success, false);

  const cantidadNegativa = {
    tipo: 'ENTRADA',
    subtipo: 'COMPRA',
    cantidad: -10,
    motivo: 'Prueba cantidad negativa'
  };
  assert.equal(registrarMovimientoSchema.safeParse(cantidadNegativa).success, false);
});
