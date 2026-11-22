import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
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
