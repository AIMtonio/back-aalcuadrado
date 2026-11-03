import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { TEXTO_MAX, TEXTO_MIN } from '../prompt.js';

export class GenerarDisenoDto {
  /** La idea del cliente: "unos aretes de calaverita con flores rosas". */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'texto: describe tu idea con palabras' })
  @MinLength(TEXTO_MIN, {
    message: `texto: describe tu idea con al menos ${TEXTO_MIN} caracteres`,
  })
  @MaxLength(TEXTO_MAX, {
    message: `texto: usa como máximo ${TEXTO_MAX} caracteres`,
  })
  texto: string;
}
