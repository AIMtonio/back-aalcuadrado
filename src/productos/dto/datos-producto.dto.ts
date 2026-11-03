import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  COLECCIONES,
  ETIQUETAS,
  MENSAJE_SLUG,
  REGEX_SLUG,
  type Coleccion,
  type Etiqueta,
} from '../catalogo.js';

/** "" se trata como "sin valor". */
const vacioANull = () =>
  Transform(({ value }) => (value === '' ? null : value));

export class ColorDto {
  /** Si no viene, se calcula del nombre ("Rosa mexicano" → `rosa-mexicano`). */
  @IsOptional()
  @vacioANull()
  @Matches(REGEX_SLUG, { message: `colores.id: ${MENSAJE_SLUG}` })
  @MaxLength(50)
  id?: string | null;

  @IsString()
  @MinLength(1, { message: 'Cada color necesita nombre' })
  @MaxLength(50)
  nombre: string;

  @Matches(/^#(?:[0-9a-fA-F]{3}){1,2}$/, {
    message: 'colores.hex: usa un color hexadecimal, por ejemplo #3B2A9B',
  })
  hex: string;
}

/** Campos de un producto. Al crear, `nombre` y `coleccion` son obligatorios; al editar, todo es opcional. */
export class ActualizarProductoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsIn(COLECCIONES, {
    message: `coleccion debe ser una de: ${COLECCIONES.join(', ')}`,
  })
  coleccion?: Coleccion;

  @IsOptional()
  @IsString()
  @MaxLength(240, {
    message: 'La descripción no puede pasar de 240 caracteres',
  })
  descripcion?: string;

  @IsOptional()
  @vacioANull()
  @IsIn(ETIQUETAS, {
    message: `etiqueta debe ser una de: ${ETIQUETAS.join(', ')}`,
  })
  etiqueta?: Etiqueta | null;

  @IsOptional()
  @vacioANull()
  @Type(() => Number)
  @IsPositive({ message: 'El precio debe ser mayor que 0' })
  @Max(999_999)
  precio?: number | null;

  @IsOptional()
  @IsBoolean()
  disponible?: boolean;

  @IsOptional()
  @IsBoolean()
  destacado?: boolean;

  @IsOptional()
  @vacioANull()
  @Type(() => Number)
  @IsInt()
  @Min(-100_000)
  @Max(100_000)
  orden?: number | null;

  /** Lista completa de colores, en orden. Reemplaza a la anterior. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ColorDto)
  colores?: ColorDto[];
}

export class CrearProductoDto extends ActualizarProductoDto {
  /** Si no viene, se calcula del nombre. No se puede cambiar después. */
  @IsOptional()
  @vacioANull()
  @Matches(REGEX_SLUG, { message: `slug: ${MENSAJE_SLUG}` })
  @MaxLength(100)
  slug?: string | null;

  @IsString()
  @MinLength(1, { message: 'El producto necesita nombre' })
  @MaxLength(100)
  declare nombre: string;

  @IsIn(COLECCIONES, {
    message: `coleccion debe ser una de: ${COLECCIONES.join(', ')}`,
  })
  declare coleccion: Coleccion;
}
