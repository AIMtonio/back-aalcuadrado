/** Quita las llaves con `undefined` (TypeORM 1 no las acepta en un `where` y no deben pisar valores). */
export function sinIndefinidos<T extends object>(objeto: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(objeto).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
