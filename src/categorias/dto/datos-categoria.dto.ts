import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const REGEX_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MENSAJE_SLUG =
  'Usa minúsculas, números y guiones, sin espacios ni acentos';

/** "" se trata como "sin valor". */
const vacioANull = () =>
  Transform(({ value }) => (value === '' ? null : value));

/** Campos de una categoría. Al crear, `nombre` es obligatorio; al editar, todo es opcional. */
export class ActualizarCategoriaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @vacioANull()
  @Type(() => Number)
  @IsInt()
  @Min(-100_000)
  @Max(100_000)
  orden?: number | null;
}

export class CrearCategoriaDto extends ActualizarCategoriaDto {
  /** Si no viene, se calcula del nombre. No se puede cambiar después. */
  @IsOptional()
  @vacioANull()
  @Matches(REGEX_SLUG, { message: `slug: ${MENSAJE_SLUG}` })
  @MaxLength(100)
  slug?: string | null;

  @IsString()
  @MinLength(1, { message: 'La categoría necesita nombre' })
  @MaxLength(100)
  declare nombre: string;
}
