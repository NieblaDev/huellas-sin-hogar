import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const usuario = await prisma.usuario.upsert({
    where: { email: 'staff@huellas.cl' },
    update: { nombre: 'Admin Ejemplo' },
    create: {
      email: 'staff@huellas.cl',
      password: hashedPassword,
      nombre: 'Admin Ejemplo',
      rol: 'DIRECTORA'
    }
  });

  await prisma.animal.createMany({
    data: [
      {
        nombre: 'Mochi',
        especie: 'Gato',
        sexo: 'Hembra',
        edad: '3 años',
        raza: 'Mestizo',
        peso: 4.1,
        estadoSalud: 'NORMAL',
        nota: 'Vacunas al día. Lista para adopción.',
        esterilizacion: 'SÍ (Operada)',
        comportamiento: 'Tranquila, cariñosa',
        creadoPorId: usuario.id
      },
      {
        nombre: 'Rocky',
        especie: 'Perro',
        sexo: 'Macho',
        edad: '2 años',
        raza: 'Labrador',
        peso: 26.5,
        chip: 'ES-4471120',
        estadoSalud: 'CONDICION_ESPECIAL',
        nota: 'Dieta blanda por 5 días. No puede correr.',
        esterilizacion: 'NO',
        comportamiento: 'Activo, en recuperación',
        creadoPorId: usuario.id
      }
    ],
    skipDuplicates: true
  });

  console.log('Seed ejecutado con éxito para Huellas Sin Hogar.');
}

main().catch(console.error).finally(() => prisma.$disconnect());