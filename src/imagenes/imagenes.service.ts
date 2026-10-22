import { randomBytes } from 'node:crypto';
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { Entorno } from '../config/entorno.js';
import { CATEGORIAS, type Categoria } from './categorias.js';
import type {
  ActualizarImagenDto,
  FiltroImagenesDto,
  SubirImagenesDto,
} from './dto/datos-imagen.dto.js';
import { Imagen } from './imagen.entity.js';
import { detectarTipoImagen, FORMATOS, nombreSeguro } from './tipo-imagen.js';

/** Quita las llaves con `undefined` (TypeORM 1 no las acepta en un `where` y no deben pisar valores). */
function sinIndefinidos<T extends object>(objeto: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(objeto).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

/** Una foto tal como la devuelve la API: la fila más la URL pública del archivo. */
export type ImagenRespuesta = Imagen & { url: string };

@Injectable()
export class ImagenesService implements OnModuleInit {
  private readonly logger = new Logger(ImagenesService.name);
  private readonly carpeta: string;
  private readonly urlBase: string;

  constructor(
    @InjectRepository(Imagen) private readonly repo: Repository<Imagen>,
    config: ConfigService<Entorno, true>,
  ) {
    this.carpeta = config.get('UPLOADS_DIR', { infer: true });
    this.urlBase = `${config.get('PUBLIC_URL', { infer: true })}/uploads`;
  }

  /** Crea UPLOADS_DIR y una subcarpeta por categoría si no existen. */
  async onModuleInit() {
    await Promise.all(
      CATEGORIAS.map((c) => mkdir(join(this.carpeta, c), { recursive: true })),
    );
  }

  async listar(filtro: FiltroImagenesDto): Promise<ImagenRespuesta[]> {
    const imagenes = await this.repo.find({
      where: sinIndefinidos({
        categoria: filtro.categoria,
        producto: filtro.producto,
      }),
      order: { orden: 'ASC', id: 'ASC' },
    });
    return imagenes.map((i) => this.conUrl(i));
  }

  async obtener(id: number): Promise<ImagenRespuesta> {
    return this.conUrl(await this.buscar(id));
  }

  async subir(
    archivos: Express.Multer.File[],
    datos: SubirImagenesDto,
  ): Promise<ImagenRespuesta[]> {
    if (!archivos?.length)
      throw new BadRequestException(
        'Envía al menos una foto en el campo "archivos"',
      );

    // Primero se revisan todas: si una no es imagen, no se guarda ninguna.
    const revisadas = archivos.map((archivo) => {
      const mime = detectarTipoImagen(archivo.buffer);
      if (!mime) {
        throw new BadRequestException(
          `"${archivo.originalname}" no es una imagen JPG, PNG, WebP o AVIF`,
        );
      }
      return { archivo, mime };
    });

    const guardadas: ImagenRespuesta[] = [];
    for (const [i, { archivo, mime }] of revisadas.entries()) {
      const nombre = `${nombreSeguro(archivo.originalname)}-${randomBytes(4).toString('hex')}.${FORMATOS[mime]}`;
      const ruta = this.ruta(datos.categoria, nombre);
      await writeFile(ruta, archivo.buffer, { flag: 'wx' });
      try {
        const imagen = await this.repo.save(
          this.repo.create({
            categoria: datos.categoria,
            archivo: nombre,
            nombreOriginal: archivo.originalname.slice(0, 255),
            mime,
            tamanoBytes: archivo.size,
            alt: datos.alt ?? null,
            producto: datos.producto ?? null,
            color: datos.color ?? null,
            // Si se suben varias juntas, conservan el orden en que se eligieron.
            orden: (datos.orden ?? 0) + i,
          }),
        );
        guardadas.push(this.conUrl(imagen));
      } catch (error) {
        await this.borrarArchivo(ruta);
        throw error;
      }
    }
    return guardadas;
  }

  async actualizar(
    id: number,
    cambios: ActualizarImagenDto,
  ): Promise<ImagenRespuesta> {
    const imagen = await this.buscar(id);
    const categoriaAnterior = imagen.categoria;
    this.repo.merge(imagen, sinIndefinidos({ ...cambios }));

    if (imagen.categoria !== categoriaAnterior) {
      // Cambió de categoría: el archivo se mueve a la otra subcarpeta.
      await rename(
        this.ruta(categoriaAnterior, imagen.archivo),
        this.ruta(imagen.categoria, imagen.archivo),
      );
      try {
        return this.conUrl(await this.repo.save(imagen));
      } catch (error) {
        await rename(
          this.ruta(imagen.categoria, imagen.archivo),
          this.ruta(categoriaAnterior, imagen.archivo),
        );
        throw error;
      }
    }
    return this.conUrl(await this.repo.save(imagen));
  }

  async eliminar(id: number): Promise<void> {
    const imagen = await this.buscar(id);
    await this.repo.delete({ id });
    await this.borrarArchivo(this.ruta(imagen.categoria, imagen.archivo));
  }

  private async buscar(id: number): Promise<Imagen> {
    const imagen = await this.repo.findOne({ where: { id } });
    if (!imagen) throw new NotFoundException(`No existe la imagen ${id}`);
    return imagen;
  }

  private ruta(categoria: Categoria, archivo: string): string {
    return join(this.carpeta, categoria, archivo);
  }

  private conUrl(imagen: Imagen): ImagenRespuesta {
    return {
      ...imagen,
      url: `${this.urlBase}/${imagen.categoria}/${encodeURIComponent(imagen.archivo)}`,
    };
  }

  private async borrarArchivo(ruta: string): Promise<void> {
    try {
      await unlink(ruta);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`No pude borrar ${ruta}: ${(error as Error).message}`);
      }
    }
  }
}
