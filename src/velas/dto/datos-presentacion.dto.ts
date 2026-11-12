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
import { TIPOS_VELA, type TipoVela } from '../tipos-vela.js';

/** Junta espacios repetidos y recorta: "  Mediana  " → "Mediana". */
const limpiarTexto = () =>
  Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value,
  );

/** Campos editables de una presentación. El tipo no cambia después de crearla. */
export class ActualizarPresentacionDto {
  @IsOptional()
  @limpiarTexto()
  @IsString()
  @MinLength(1, { message: 'Ponle nombre (por ejemplo "Mediana" o "Cupcake")' })
  @MaxLength(40)
  nombre?: string;

  /** `null` deja los gramos pendientes. */
  @IsOptional()
  @IsInt({ message: 'gramos: pon un número entero' })
  @Min(1)
  @Max(100_000)
  gramos?: number | null;

  @IsOptional()
  @IsBoolean()
  marmoleable?: boolean;

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

export class CrearPresentacionDto extends ActualizarPresentacionDto {
  @IsIn(TIPOS_VELA, { message: `tipo: usa ${TIPOS_VELA.join(', ')}` })
  tipo: TipoVela;

  @limpiarTexto()
  @IsString()
  @MinLength(1, { message: 'Ponle nombre (por ejemplo "Mediana" o "Cupcake")' })
  @MaxLength(40)
  declare nombre: string;
}
