import {
  registerDecorator,
  type ValidationOptions,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Dígitos con algo de formato (espacios, +, (), -), de 7 a 20 caracteres. */
const REGEX_TELEFONO = /^\+?[\d\s()-]{7,20}$/;

@ValidatorConstraint({ name: 'esContacto' })
class EsContactoConstraint implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean {
    if (typeof valor !== 'string') return false;
    const texto = valor.trim();
    return (
      REGEX_CORREO.test(texto) ||
      (REGEX_TELEFONO.test(texto) && texto.replace(/\D/g, '').length >= 7)
    );
  }
}

/** Acepta un correo o un teléfono; nada más. */
export function EsContacto(opciones?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: opciones,
      constraints: [],
      validator: EsContactoConstraint,
    });
  };
}
