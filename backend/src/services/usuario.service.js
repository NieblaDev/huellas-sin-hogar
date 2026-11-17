import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';
import { registrarAuditoria } from './audit.service.js';
import { obtenerPerfilUsuario, PERFILES_USUARIO } from '../constants/usuarios.js';

const SELECT_USUARIO = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  activo: true,
  createdAt: true
};

const errorConEstado = (mensaje, statusCode = 400) => {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  return error;
};

const serializarUsuario = usuario => {
  const { id, createdAt, ...resto } = usuario;
  return {
    ...resto,
    creadoEn: createdAt,
    perfil: obtenerPerfilUsuario(usuario.rol)
  };
};

const buscarPorEmail = email => prisma.usuario.findFirst({
  where: { email: { equals: email, mode: 'insensitive' } },
  select: SELECT_USUARIO
});

export const listarUsuarios = async () => {
  const usuarios = await prisma.usuario.findMany({
    select: SELECT_USUARIO,
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }]
  });

  const activos = usuarios.filter(usuario => usuario.activo).length;

  return {
    usuarios: usuarios.map(serializarUsuario),
    perfiles: PERFILES_USUARIO,
    resumen: {
      total: usuarios.length,
      activos,
      inactivos: usuarios.length - activos
    }
  };
};

export const crearUsuario = async (data, usuarioActual, ip) => {
  const existente = await buscarPorEmail(data.email);
  if (existente) {
    throw errorConEstado(
      existente.activo
        ? 'Ya existe un perfil activo con este correo electrónico.'
        : 'Ya existe un perfil desactivado con este correo electrónico.',
      409
    );
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const nuevo = await prisma.usuario.create({
    data: {
      nombre: data.nombre,
      email: data.email,
      password: passwordHash,
      rol: data.rol,
      activo: true
    },
    select: SELECT_USUARIO
  });

  await registrarAuditoria({
    entidad: 'Usuario',
    entidadId: nuevo.id,
    accion: 'CREACION',
    valorAnterior: null,
    valorNuevo: {
      nombre: nuevo.nombre,
      email: nuevo.email,
      rol: nuevo.rol,
      activo: nuevo.activo
    },
    usuario: usuarioActual,
    ip
  });

  return {
    mensaje: 'Perfil creado correctamente. La persona ya puede iniciar sesión con la contraseña asignada.',
    usuario: serializarUsuario(nuevo)
  };
};

export const eliminarUsuario = async (email, usuarioActual, ip) => {
  const usuario = await buscarPorEmail(email);
  if (!usuario) throw errorConEstado('El perfil indicado no existe.', 404);
  if (!usuario.activo) throw errorConEstado('El perfil ya se encuentra desactivado.', 409);

  if (usuario.id === usuarioActual.id) {
    throw errorConEstado('No puedes eliminar tu propio perfil mientras tienes la sesión activa.', 400);
  }

  if (usuario.rol === 'DIRECTORA') {
    const directorasActivas = await prisma.usuario.count({
      where: { rol: 'DIRECTORA', activo: true }
    });
    if (directorasActivas <= 1) {
      throw errorConEstado('Debe quedar al menos una Directora activa en el sistema.', 409);
    }
  }

  const actualizado = await prisma.usuario.update({
    where: { id: usuario.id },
    data: { activo: false },
    select: SELECT_USUARIO
  });

  await registrarAuditoria({
    entidad: 'Usuario',
    entidadId: usuario.id,
    accion: 'BAJA_LOGICA',
    valorAnterior: {
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      activo: usuario.activo
    },
    valorNuevo: { activo: false },
    usuario: usuarioActual,
    ip
  });

  return {
    mensaje: 'Perfil eliminado correctamente. El acceso quedó revocado y su historial se conserva.',
    usuario: serializarUsuario(actualizado)
  };
};
