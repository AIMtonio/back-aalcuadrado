import { IsString, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MIN } from '../usuarios.service.js';

export class CambiarPasswordDto {
  @IsString()
  @MaxLength(200)
  passwordActual: string;

  @IsString()
  @MinLength(PASSWORD_MIN, {
    message: `La contraseña nueva debe tener al menos ${PASSWORD_MIN} caracteres`,
  })
  @MaxLength(72, {
    message: 'La contraseña nueva no puede pasar de 72 caracteres',
  })
  passwordNueva: string;
}
