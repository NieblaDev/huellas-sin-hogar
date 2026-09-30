import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const loginUser = async ({ email, password }) => {
  const user = await prisma.usuario.findUnique({ where: { email } });
  if (!user || !user.activo) throw new Error("Credenciales inválidas");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error("Credenciales inválidas");

  const token = jwt.sign(
    { id: user.id, email: user.email, rol: user.rol, nombre: user.nombre },
    process.env.JWT_SECRET || "huellas_secret_key_2026",
    { expiresIn: "8h" },
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
    },
  };
};
