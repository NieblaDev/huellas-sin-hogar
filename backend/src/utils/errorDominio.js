export class ErrorDominio extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}
