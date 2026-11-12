import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { sinIndefinidos } from '../comun/sin-indefinidos.js';
import { KitAroma, KitColor } from '../kits/opciones-kit.entity.js';
import type { CrearPedidoVelaDto } from './dto/crear-pedido-vela.dto.js';
import type {
  ActualizarPresentacionDto,
  CrearPresentacionDto,
} from './dto/datos-presentacion.dto.js';
import { PedidoVela } from './pedido-vela.entity.js';
import { PresentacionVela } from './presentacion-vela.entity.js';
import {
  admiteMarmoleado,
  NOMBRES_TIPO_VELA,
  TIPOS_VELA,
  type TipoVela,
} from './tipos-vela.js';

/** Igual sin importar mayúsculas ni acentos ("mediana" = "Mediana", "jicara" = "jícara"). */
const mismoNombre = (a: string, b: string) =>
  a.localeCompare(b, 'es', { sensitivity: 'base' }) === 0;

/**
 * Velas individuales personalizadas: sus presentaciones (tamaños y moldes de
 * cada tipo) y los pedidos que llegan del front. Los colores y aromas son los
 * de los kits marcados "para la vela".
 */
@Injectable()
export class VelasService {
  constructor(
    @InjectRepository(PresentacionVela)
    private readonly presentaciones: Repository<PresentacionVela>,
    @InjectRepository(PedidoVela)
    private readonly pedidos: Repository<PedidoVela>,
    @InjectRepository(KitColor) private readonly colores: Repository<KitColor>,
    @InjectRepository(KitAroma) private readonly aromas: Repository<KitAroma>,
  ) {}

  /* ---------- Presentaciones ---------- */

  /** Agrupadas por tipo (recipiente, molde, jícara) y en el orden del panel. */
  async listarPresentaciones(): Promise<PresentacionVela[]> {
    const todas = await this.presentaciones.find({
      order: { orden: 'ASC', id: 'ASC' },
    });
    return todas.sort(
      (a, b) => TIPOS_VELA.indexOf(a.tipo) - TIPOS_VELA.indexOf(b.tipo),
    );
  }

  async crearPresentacion(
    datos: CrearPresentacionDto,
  ): Promise<PresentacionVela> {
    const nueva = {
      tipo: datos.tipo,
      nombre: datos.nombre,
      gramos: datos.gramos ?? null,
      marmoleable: datos.marmoleable ?? false,
      disponible: datos.disponible ?? true,
      orden: datos.orden ?? 0,
    };
    this.revisarMarmoleado(nueva);
    await this.revisarNombreLibre(nueva.tipo, nueva.nombre);
    return this.presentaciones.save(this.presentaciones.create(nueva));
  }

  async actualizarPresentacion(
    id: number,
    cambios: ActualizarPresentacionDto,
  ): Promise<PresentacionVela> {
    const presentacion = await this.buscarPresentacion(id);
    const limpios = sinIndefinidos(cambios);
    const nueva = { ...presentacion, ...limpios };
    this.revisarMarmoleado(nueva);
    if (nueva.nombre !== presentacion.nombre) {
      await this.revisarNombreLibre(nueva.tipo, nueva.nombre, id);
    }
    return this.presentaciones.save(
      this.presentaciones.merge(presentacion, limpios),
    );
  }

  async eliminarPresentacion(id: number): Promise<void> {
    await this.buscarPresentacion(id);
    await this.presentaciones.delete({ id });
  }

  private revisarMarmoleado(p: Pick<PresentacionVela, 'tipo' | 'marmoleable'>) {
    if (p.marmoleable && !admiteMarmoleado(p.tipo)) {
      throw new BadRequestException(
        `Las velas ${NOMBRES_TIPO_VELA[p.tipo].toLowerCase()} no pueden ser marmoleadas: no se apreciaría`,
      );
    }
  }

  private async revisarNombreLibre(
    tipo: TipoVela,
    nombre: string,
    excepto?: number,
  ): Promise<void> {
    // Son pocas: se comparan aquí para ignorar mayúsculas y acentos igual en MySQL y en SQLite.
    const delTipo = await this.presentaciones.find({ where: { tipo } });
    const repetida = delTipo.find(
      (p) => p.id !== excepto && mismoNombre(p.nombre, nombre),
    );
    if (repetida) {
      throw new ConflictException(
        `Las velas ${NOMBRES_TIPO_VELA[tipo].toLowerCase()} ya tienen "${repetida.nombre}"`,
      );
    }
  }

  private async buscarPresentacion(id: number): Promise<PresentacionVela> {
    const presentacion = await this.presentaciones.findOne({ where: { id } });
    if (!presentacion)
      throw new NotFoundException(`No existe la presentación ${id}`);
    return presentacion;
  }

  /* ---------- Pedidos ---------- */

  /**
   * Revisa que lo elegido exista y esté disponible, y guarda los nombres tal
   * como están en el panel. Sin precios: el dueño cotiza a mano.
   */
  async crearPedido(datos: CrearPedidoVelaDto): Promise<PedidoVela> {
    const tipo = NOMBRES_TIPO_VELA[datos.tipo].toLowerCase();
    const presentaciones = await this.presentaciones.find({
      where: { tipo: datos.tipo, disponible: true },
    });
    const presentacion = presentaciones.find((p) =>
      mismoNombre(p.nombre, datos.presentacion),
    );
    if (!presentacion) {
      const opciones = presentaciones.map((p) => p.nombre).join(', ');
      throw new BadRequestException(
        `"${datos.presentacion}" no está disponible para velas ${tipo}` +
          (opciones ? `. Elige: ${opciones}` : ''),
      );
    }

    const [colores, aromas] = await Promise.all([
      this.colores.find({ where: { enVela: true, disponible: true } }),
      this.aromas.find({ where: { enVela: true, disponible: true } }),
    ]);
    const elegir = (
      lista: { nombre: string }[],
      nombre: string,
      que: string,
    ) => {
      const opcion = lista.find((o) => mismoNombre(o.nombre, nombre));
      if (!opcion) {
        throw new BadRequestException(
          `El ${que} "${nombre}" no está disponible para velas`,
        );
      }
      return opcion.nombre;
    };
    const color = elegir(colores, datos.color, 'color');
    const aroma = elegir(aromas, datos.aroma, 'aroma');

    const marmoleado = datos.marmoleado ?? false;
    let colorMarmoleado: string | null = null;
    if (marmoleado) {
      if (!presentacion.marmoleable) {
        throw new BadRequestException(
          `La vela ${tipo} "${presentacion.nombre}" no se hace marmoleada`,
        );
      }
      if (!datos.colorMarmoleado) {
        throw new BadRequestException(
          'Elige el segundo color para el marmoleado',
        );
      }
      colorMarmoleado = elegir(colores, datos.colorMarmoleado, 'color');
      if (colorMarmoleado === color) {
        throw new BadRequestException(
          'Para el marmoleado elige un color distinto al de la vela',
        );
      }
    }

    return this.pedidos.save(
      this.pedidos.create({
        clienteNombre: datos.clienteNombre,
        clienteContacto: datos.clienteContacto.trim(),
        tipo: datos.tipo,
        presentacion: presentacion.nombre,
        gramos: presentacion.gramos,
        color,
        aroma,
        topping: datos.topping,
        marmoleado,
        colorMarmoleado,
        cantidad: datos.cantidad ?? 1,
        notas: datos.notas ?? null,
      }),
    );
  }

  /** Los más recientes primero: son los que el dueño todavía no ha cotizado. */
  listarPedidos(): Promise<PedidoVela[]> {
    return this.pedidos.find({ order: { creadoEn: 'DESC', id: 'DESC' } });
  }

  async eliminarPedido(id: number): Promise<void> {
    const { affected } = await this.pedidos.delete({ id });
    if (!affected) throw new NotFoundException(`No existe el pedido ${id}`);
  }
}
