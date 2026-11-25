import React, { forwardRef, useId } from 'react';
import TextField from '@mui/material/TextField';
import ErrorCampo from './ErrorCampo.jsx';

const Input = forwardRef(function Input({
  label, error, id, as, type = 'text', children, style, className, disabled, name,
  onChange, onBlur, value, defaultValue, required, ...props
}, ref) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const mensajeId = `${inputId}-error`;
  const describedBy = [props['aria-describedby'], error && mensajeId].filter(Boolean).join(' ') || undefined;

  if (as || ['checkbox', 'radio', 'file', 'range', 'hidden'].includes(type)) {
    const Element = as ?? 'input';
    return (
      <>
        {label && <label htmlFor={inputId}>{label}</label>}
        <Element {...props} ref={ref} id={inputId} type={as ? undefined : type} className={className}
          style={style} {...{ name, value, defaultValue, required, disabled, onChange, onBlur }}
          aria-invalid={Boolean(error) || undefined} aria-describedby={describedBy}>{children}</Element>
        <ErrorCampo id={mensajeId} error={error} />
      </>
    );
  }

  return (
    <>
      <TextField
        inputRef={ref}
        id={inputId}
        label={label}
        type={type}
        variant={label ? 'outlined' : 'standard'}
        fullWidth
        error={Boolean(error)}
        {...{ name, value, defaultValue, required, disabled, onChange, onBlur }}
        slotProps={{
          input: label ? undefined : { disableUnderline: true },
          htmlInput: { ...props, style, className, 'aria-describedby': describedBy }
        }}
        sx={label ? undefined : { '& .MuiInputBase-input': { padding: 0, boxSizing: 'border-box' } }}
      />
      <ErrorCampo id={mensajeId} error={error} />
    </>
  );
});

export default Input;
