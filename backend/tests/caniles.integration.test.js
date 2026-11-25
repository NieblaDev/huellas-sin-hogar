import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const url = new URL(process.env.TEST_DATABASE_URL);
if (!['localhost','127.0.0.1'].includes(url.hostname) || !url.pathname.includes('test')) throw Error('Se requiere una base local de pruebas.');
const admin = new PrismaClient({ datasources: { db: { url: url.href } } });
const schema = 'caniles_' + randomUUID().replaceAll('-','');
url.searchParams.set('schema',schema);
process.env.DATABASE_URL = url.href;
process.env.JWT_SECRET = 'caniles-pruebas';
const { default: db } = await import('../src/config/prisma.js');
const { default: app } = await import('../src/app.js');
let server, base, direccion, voluntario;
before(async () => {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  execFileSync(process.execPath,[fileURLToPath(new URL('../prisma/migrate.js',import.meta.url))],{stdio:'pipe'});
  for (const rol of ['DIRECCION','VOLUNTARIO_AVANZADO']) {
    const u = await db.usuario.create({ data:{nombre:rol,email:rol+'@example.test',rol,password:'prueba'} });
    const token = jwt.sign({id:u.id,rol},process.env.JWT_SECRET);
    if (rol === 'DIRECCION') direccion=token; else voluntario=token;
  }
  server=app.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  base='http://127.0.0.1:'+server.address().port+'/api/caniles';
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await db.$disconnect();
  await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.$disconnect();
});
async function pedir(ruta, method, body, token=direccion) {
  const res=await fetch(base+ruta,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  return {status:res.status,data:await res.json()};
}
const crearCanil = (codigo,capacidad,tipo='Perro',estado='LIBRE') => db.canil.create({data:{codigo,nombre:codigo,capacidad,tipo,estado}});
const crearAnimal = (nombre,especie='Perro') => db.animal.create({data:{nombre,especie,sexo:'Hembra',edad:'2 años'}});
const asignar = (c,a,extra={}) => pedir('/asignar','POST',{canilId:c.id,animalId:a?.id,...extra});

test('el grupo acepta especies distintas y valida mantenimiento, cupo concurrente y liberación',async () => {
  const c=await crearCanil('Grupo',2), m=await crearCanil('Taller',1,'Mixto','MANTENIMIENTO');
  const [a,b,d,gato]=await Promise.all([crearAnimal('A'),crearAnimal('B'),crearAnimal('D'),crearAnimal('G','Gato')]);
  assert.equal((await asignar(m,a)).status,409);
  assert.equal((await asignar(c,gato)).status,200);
  assert.equal((await asignar(c,a)).status,200);
  assert.equal((await asignar(c,gato,{estado:'LIBRE'})).status,200);
  const carrera=await Promise.all([asignar(c,b),asignar(c,d)]);
  assert.deepEqual(carrera.map(r=>r.status).sort(),[200,409]);
  assert.equal((await pedir('/'+c.id,'PUT',{capacidad:1})).status,409);
  assert.equal((await asignar(c,null,{estado:'LIBRE'})).status,409);
  const libre=await asignar(c,a,{estado:'LIBRE'});
  assert.equal(libre.data.canil.estado,'OCUPADO');
  assert.equal(libre.data.animales.length,1);
  await asignar(c,a);
  assert.equal((await asignar(c,null,{estado:'LIBRE',confirmarLiberacionMultiple:true})).data.canil.estado,'LIBRE');
});
test('la nota se guarda y se muestra durante la mantención', async () => {
  const canil = await crearCanil('Mantención con nota', 1);
  const ruta = '/' + canil.id;
  await db.canil.update({ where: { id: canil.id }, data: { notas: 'Nota general antigua' } });
  assert.equal((await pedir(ruta, 'GET')).data.notaMantencion, null);
  assert.equal((await pedir(ruta, 'PUT', { notas: 'Nota general' })).status, 400);
  assert.equal((await asignar(canil, null, { estado: 'LIBRE', notaMantencion: 'Reparación' })).status, 400);
  const inicio = await asignar(canil, null, { estado: 'MANTENIMIENTO', notaMantencion: '  Cambiar pestillo  ' });
  assert.equal(inicio.status, 200);
  assert.equal(inicio.data.canil.notaMantencion, 'Cambiar pestillo');
  const edicion = await asignar(canil, null, { estado: 'MANTENIMIENTO', notaMantencion: 'Pintar la puerta' });
  assert.equal(edicion.data.canil.notaMantencion, 'Pintar la puerta');
  assert.equal((await asignar(canil, null, { estado: 'LIBRE' })).data.canil.notaMantencion, null);
  assert.equal((await asignar(canil, null, { estado: 'MANTENIMIENTO' })).data.canil.notaMantencion, null);
});

test('cuarentena individual, fecha, duplicados, permiso y cierre',async () => {
  const c=await crearCanil('Individual',1), grupo=await crearCanil('Camada',3);
  const a=await crearAnimal('Mora');
  const q={estado:'CUARENTENA',motivo:'Observación',fechaFinEstimada:new Date(Date.now()+86400000).toISOString()};
  assert.equal((await asignar(grupo,a,q)).status,409);
  assert.equal((await asignar(c,a,{estado:'CUARENTENA'})).status,400);
  const inicio=await asignar(c,a,{...q,observaciones:'Revisar mañana'});
  assert.equal(inicio.status,200);
  assert.equal(inicio.data.cuarentena.canilId,c.id);
  assert.equal(inicio.data.cuarentena.observaciones,'Revisar mañana');
  assert.equal(inicio.data.canil.estado,'CUARENTENA');
  assert.equal((await asignar(c,a,q)).status,409);
  assert.equal((await asignar(grupo,a)).status,409);
  const ruta='/'+c.id+'/finalizar-cuarentena';
  assert.equal((await pedir(ruta,'POST',{},voluntario)).status,403);
  const fin=await pedir(ruta,'POST',{observaciones:'Alta'});
  assert.equal(fin.data.cuarentena.estado,'FINALIZADA');
  assert.ok(fin.data.cuarentena.fechaFinReal);
  assert.equal(fin.data.cuarentena.observaciones,'Revisar mañana\nAlta');
  assert.equal(fin.data.canil.estado,'OCUPADO');
});
test('historial conserva dos estadías y pagina sin duplicar movimientos',async () => {
  const c=await crearCanil('Patio',1), a=await crearAnimal('Luna');
  await asignar(c,a); await asignar(c,a,{estado:'LIBRE'}); await asignar(c,a);
  const ruta='/'+c.id+'/historial?limit=2';
  const {data}=await pedir(ruta,'GET');
  assert.equal(data.estadias.length,2);
  assert.equal(data.resumen.residentes,1);
  assert.equal(data.estadias.filter(e=>e.actual).length,1);
  const siguiente=await pedir(ruta+'&cursor='+data.paginacion.nextCursor,'GET');
  assert.equal(new Set([...data.movimientos,...siguiente.data.movimientos].map(m=>m.id)).size,3);
  assert.equal(siguiente.data.paginacion.nextCursor,null);
  assert.equal((await pedir('/2147483647/historial','GET')).status,404);
});
