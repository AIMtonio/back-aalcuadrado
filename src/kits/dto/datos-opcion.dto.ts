import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Junta espacios repetidos y recorta: "  Rojo   navidad " → "Rojo navidad". */
const limpiarTexto = () =>
  Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value,
  );

/** Campos de un aroma. Al crear, `nombre` es obligatorio; al editar, todo es opcional. */
export class ActualizarAromaDto {
  @IsOptional()
  @limpiarTexto()
  @IsString()
  @MinLength(1, { message: 'Ponle nombre' })
  @MaxLength(60)
  nombre?: string;

  @IsOptional()
  @IsBoolean()
  enJabon?: boolean;

  @IsOptional()
  @IsBoolean()
  enVela?: boolean;

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

export class CrearAromaDto extends ActualizarAromaDto {
  @limpiarTexto()
  @IsString()
  @MinLength(1, { message: 'Ponle nombre' })
  @MaxLength(60)
  declare nombre: string;
}

const REGEX_HEX = /^#[0-9a-fA-F]{6}$/;
const MENSAJE_HEX = 'hex: usa el formato #RRGGBB (por ejemplo #B3202A)';

export class ActualizarColorDto extends ActualizarAromaDto {
  @IsOptional()
  @Matches(REGEX_HEX, { message: MENSAJE_HEX })
  hex?: string;
}

export class CrearColorDto extends ActualizarColorDto {
  @limpiarTexto()
  @IsString()
  @MinLength(1, { message: 'Ponle nombre' })
  @MaxLength(60)
  declare nombre: string;

  @Matches(REGEX_HEX, { message: MENSAJE_HEX })
  declare hex: string;
}
