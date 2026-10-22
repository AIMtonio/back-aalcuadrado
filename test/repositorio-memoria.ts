/**
 * Repositorio de TypeORM en memoria, solo con los métodos que usa la API.
 * Permite probar los endpoints sin una base MySQL.
 */
type Fila = { id: number };
/** Acceso por nombre de campo a cualquier fila. */
const campo = (fila: object, k: string) => (fila as Record<string, unknown>)[k];

export class RepositorioMemoria<T extends Fila> {
  filas: T[] = [];
  private siguienteId = 1;

  constructor(private readonly ocultos: string[] = []) {}

  private coincide(fila: T, where: Partial<T> = {}) {
    return Object.entries(where).every(([k, v]) => campo(fila, k) === v);
  }

  private sinOcultos(fila: T): T {
    const copia = { ...fila };
    for (const k of this.ocultos) delete (copia as Record<string, unknown>)[k];
    return copia;
  }

  create(datos: Partial<T>): T {
    return { ...datos } as T;
  }

  merge(destino: T, ...fuentes: Partial<T>[]): T {
    return Object.assign(destino, ...fuentes);
  }

  async find({
    where,
    order,
  }: { where?: Partial<T>; order?: Record<string, 'ASC' | 'DESC'> } = {}) {
    const claves = Object.keys(order ?? {});
    return this.filas
      .filter((f) => this.coincide(f, where))
      .sort((a, b) => {
        for (const k of claves) {
          const d = (campo(a, k) as number) - (campo(b, k) as number);
          if (d) return order![k] === 'ASC' ? d : -d;
        }
        return 0;
      })
      .map((f) => this.sinOcultos(f));
  }

  async findOne({ where }: { where: Partial<T> }) {
    const fila = this.filas.find((f) => this.coincide(f, where));
    return fila ? this.sinOcultos(fila) : null;
  }

  async save(entidad: T): Promise<T> {
    const ahora = new Date();
    const existente = this.filas.find((f) => f.id === entidad.id);
    if (existente) {
      Object.assign(existente, entidad, { actualizadoEn: ahora });
      return this.sinOcultos(existente);
    }
    const nueva = {
      ...entidad,
      id: this.siguienteId++,
      creadoEn: ahora,
      actualizadoEn: ahora,
    } as T;
    this.filas.push(nueva);
    return this.sinOcultos(nueva);
  }

  async insert(datos: Partial<T>) {
    await this.save(datos as T);
  }

  async update(where: Partial<T>, cambios: Partial<T>) {
    for (const f of this.filas.filter((f) => this.coincide(f, where)))
      Object.assign(f, cambios);
  }

  async delete(where: Partial<T>) {
    this.filas = this.filas.filter((f) => !this.coincide(f, where));
  }

  createQueryBuilder() {
    let where: Partial<T> = {};
    const qb = {
      addSelect: () => qb,
      where: (w: Partial<T>) => {
        where = w;
        return qb;
      },
      getOne: async () =>
        this.filas.find((f) => this.coincide(f, where)) ?? null,
    };
    return qb;
  }
}
