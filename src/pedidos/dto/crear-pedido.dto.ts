import { IsString, MaxLength, MinLength } from 'class-validator';
import { EsContacto } from './es-contacto.decorator.js';

/** Pedido de un kit (jabón + vela) que llega desde el front, para cotizar a mano. */
export class CrearPedidoDto {
  @IsString()
  @MinLength(1, { message: 'Dinos tu nombre' })
  @MaxLength(100)
  clienteNombre: string;

  @IsString()
  @MaxLength(150)
  @EsContacto({ message: 'Pon un correo o un teléfono válido para contactarte' })
  clienteContacto: string;

  @IsString()
  @MinLength(1, { message: 'Dinos el color del jabón' })
  @MaxLength(60)
  jabonColor: string;

  @IsString()
  @MinLength(1, { message: 'Dinos el aroma del jabón' })
  @MaxLength(60)
  jabonAroma: string;

  @IsString()
  @MinLength(1, { message: 'Dinos la forma del jabón' })
  @MaxLength(60)
  jabonForma: string;

  @IsString()
  @MinLength(1, { message: 'Dinos el color de la vela' })
  @MaxLength(60)
  velaColor: string;

  @IsString()
  @MinLength(1, { message: 'Dinos el aroma de la vela' })
  @MaxLength(60)
  velaAroma: string;

  @IsString()
  @MinLength(1, { message: 'Dinos el topping de la vela' })
  @MaxLength(60)
  velaTopping: string;
}
