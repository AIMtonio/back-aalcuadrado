import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { CrearPedidoDto } from './dto/crear-pedido.dto.js';
import { PedidoKit } from './pedido-kit.entity.js';

@Injectable()
export class PedidosService {
  constructor(
    @InjectRepository(PedidoKit) private readonly repo: Repository<PedidoKit>,
  ) {}

  crear(datos: CrearPedidoDto): Promise<PedidoKit> {
    const pedido = this.repo.create({
      clienteNombre: datos.clienteNombre.trim(),
      clienteContacto: datos.clienteContacto.trim(),
      jabonColor: datos.jabonColor.trim(),
      jabonAroma: datos.jabonAroma.trim(),
      jabonForma: datos.jabonForma.trim(),
      velaColor: datos.velaColor.trim(),
      velaAroma: datos.velaAroma.trim(),
      velaTopping: datos.velaTopping.trim(),
    });
    return this.repo.save(pedido);
  }

  /** Los más recientes primero: son los que el dueño todavía no ha cotizado. */
  listar(): Promise<PedidoKit[]> {
    return this.repo.find({ order: { creadoEn: 'DESC' } });
  }

  async eliminar(id: number): Promise<void> {
    const { affected } = await this.repo.delete({ id });
    if (!affected) throw new NotFoundException(`No existe el pedido ${id}`);
  }
}
