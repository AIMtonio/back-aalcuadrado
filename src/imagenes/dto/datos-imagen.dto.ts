import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CATEGORIAS, type Categoria } from '../categorias.js';

const REGEX_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MENSAJE_SLUG =
  'Usa minúsculas, números y guiones, sin espacios ni acentos';
/** Los formularios mandan "" cuando un campo se deja vacío: se trata como si no viniera. */
const vacioANull = () =>
  Transform(({ value }) => (value === '' ? null : value));

/** Campos editables de una foto (se usan al subir y al actualizar). */
export class DatosImagenDto {
  @IsOptional()
  @vacioANull()
  @IsString()
  @MaxLength(200)
  alt?: string | null;

  @IsOptional()
  @vacioANull()
  @Matches(REGEX_SLUG, { message: `producto: ${MENSAJE_SLUG}` })
  @MaxLength(100)
  producto?: string | null;

  @IsOptional()
  @vacioANull()
  @Matches(REGEX_SLUG, { message: `color: ${MENSAJE_SLUG}` })
  @MaxLength(50)
  color?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-100_000)
  @Max(100_000)
  orden?: number;
}

export class SubirImagenesDto extends DatosImagenDto {
  @IsIn(CATEGORIAS)
  categoria: Categoria;
}

export class ActualizarImagenDto extends DatosImagenDto {
  @IsOptional()
  @IsIn(CATEGORIAS)
  categoria?: Categoria;
}

export class FiltroImagenesDto {
  @IsOptional()
  @IsIn(CATEGORIAS)
  categoria?: Categoria;

  @IsOptional()
  @Matches(REGEX_SLUG, { message: `producto: ${MENSAJE_SLUG}` })
  producto?: string;
}
