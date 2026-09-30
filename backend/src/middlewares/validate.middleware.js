export const validate = (schema, target = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[target]);
  if (!result.success) {
    return res.status(400).json({
      error: 'Error de validación',
      detalles: result.error.errors.map(e => ({ campo: e.path.join('.'), mensaje: e.message }))
    });
  }
  req[target] = result.data;
  next();
};