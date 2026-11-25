import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

export default function useFormulario(schema, defaultValues) {
  const id = useId();
  const { watch, setValue, reset, getValues, getFieldState, register, handleSubmit, formState } = useForm({
    resolver: zodResolver(schema), defaultValues
  });
  const { isSubmitting, isSubmitted } = formState;

  const cambiar = (nombre, valor) => setValue(nombre, valor, { shouldDirty: true, shouldValidate: isSubmitted });
  const cambiarCampos = (actualizar, prefijo = '') => {
    const actuales = prefijo ? getValues(prefijo) : getValues();
    const siguientes = typeof actualizar === 'function' ? actualizar(actuales) : actualizar;
    for (const [campo, valor] of Object.entries(siguientes)) {
      if (actuales[campo] !== valor) cambiar(prefijo ? `${prefijo}.${campo}` : campo, valor);
    }
  };
  const idCampo = nombre => `${id}-${nombre}`;
  const errorCampo = nombre => getFieldState(nombre, formState).error;
  const campo = (nombre, inputId) => {
    const { onBlur, ref, name } = register(nombre);
    return { id: inputId ?? idCampo(nombre), name, onBlur, ref, error: errorCampo(nombre) };
  };

  return { valores: watch(), cambiar, cambiarCampos, reset, handleSubmit, campo, idCampo, errorCampo, isSubmitting };
}
