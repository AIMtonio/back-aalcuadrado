import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PIEZAS, type Pieza } from '../piezas.js';

/** Junta espacios repetidos y recorta: "  Rojo   navidad " → "Rojo navidad". */
const limpiarTexto = () =>
  Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value,
  );

const REGEX_HEX = /^#[0-9a-fA-F]{6}$/;
const MENSAJE_HEX = 'hex: usa el formato #RRGGBB (por ejemplo #B3202A)';
const MENSAJE_PIEZA = `pieza: usa ${PIEZAS.join(' o ')}`;

/** `GET /api/colores?pieza=vela`. Sin `pieza`, salen las dos listas. */
export class FiltroColoresDto {
  @IsOptional()
  @IsIn(PIEZAS, { message: MENSAJE_PIEZA })
  pieza?: Pieza;
}

/** Campos editables de un color. La pieza no cambia después de crearlo. */
export class ActualizarColorDto {
  @IsOptional()
  @limpiarTexto()
  @IsString()
  @MinLength(1, { message: 'Ponle nombre' })
  @MaxLength(60)
  nombre?: string;

  @IsOptional()
  @Matches(REGEX_HEX, { message: MENSAJE_HEX })
  hex?: string;

  @IsOptional()
  @IsBoolean()
  disponible?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-100_000)
  @Max(100_000)
  orden?: number;
}

export class CrearColorDto extends ActualizarColorDto {
  @IsIn(PIEZAS, { message: MENSAJE_PIEZA })
  pieza: Pieza;

  @limpiarTexto()
  @IsString()
  @MinLength(1, { message: 'Ponle nombre' })
  @MaxLength(60)
  declare nombre: string;

  @Matches(REGEX_HEX, { message: MENSAJE_HEX })
  declare hex: string;
}
