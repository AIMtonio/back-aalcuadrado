import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EsContacto } from '../../pedidos/dto/es-contacto.decorator.js';
import { TIPOS_VELA, type TipoVela } from '../tipos-vela.js';

/** Recorta y junta espacios; "" se trata como si no viniera. */
const limpiarTexto = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const limpio = value.replace(/\s+/g, ' ').trim();
    return limpio === '' ? undefined : limpio;
  });

/** Máximo de velas iguales en un pedido; para más, que escriban. */
export const MAX_CANTIDAD_VELAS = 20;

/**
 * Pedido de una vela personalizada desde el front. Los nombres (presentación,
 * color, aroma) deben ser de las opciones disponibles; el topping es libre
 * porque las opciones viven en el front, como en los kits.
 */
export class CrearPedidoVelaDto {
  @limpiarTexto()
  @IsString({ message: 'Dinos tu nombre' })
  @MaxLength(100)
  clienteNombre: string;

  @IsString()
  @MaxLength(150)
  @EsContacto({
    message: 'Pon un correo o un teléfono válido para contactarte',
  })
  clienteContacto: string;

  @IsIn(TIPOS_VELA, {
    message: `tipo: elige ${TIPOS_VELA.join(', ')}`,
  })
  tipo: TipoVela;

  /** Tamaño ("Pequeña", "Mediana", "Grande") o molde ("Cupcake"). */
  @limpiarTexto()
  @IsString({ message: 'Elige el tamaño o el molde' })
  @MaxLength(40)
  presentacion: string;

  @limpiarTexto()
  @IsString({ message: 'Elige el color de la vela' })
  @MaxLength(60)
  color: string;

  @limpiarTexto()
  @IsString({ message: 'Elige el aroma de la vela' })
  @MaxLength(60)
  aroma: string;

  @limpiarTexto()
  @IsString({ message: 'Elige el topping (o "Sin topping")' })
  @MinLength(1)
  @MaxLength(60)
  topping: string;

  @IsOptional()
  @IsBoolean()
  marmoleado?: boolean;

  /** Obligatorio si `marmoleado` es `true`: el color de la veta. */
  @IsOptional()
  @limpiarTexto()
  @IsString()
  @MaxLength(60)
  colorMarmoleado?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'cantidad: pon un número entero' })
  @Min(1, { message: 'cantidad: pide al menos 1' })
  @Max(MAX_CANTIDAD_VELAS, {
    message: `cantidad: hasta ${MAX_CANTIDAD_VELAS}; para más, escríbenos`,
  })
  cantidad?: number;

  @IsOptional()
  @limpiarTexto()
  @IsString()
  @MaxLength(500)
  notas?: string;
}
