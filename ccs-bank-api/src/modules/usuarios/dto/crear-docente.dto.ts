import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CrearDocenteDto {
  @ApiProperty({ example: 'María' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Ingresa el nombre.' })
  @MaxLength(80)
  nombre: string;

  @ApiProperty({ example: 'López' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Ingresa los apellidos.' })
  @MaxLength(80)
  apellidos: string;

  @ApiProperty({ description: 'Correo con el que iniciará sesión', example: 'maria@calvary.edu.gt' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Ingresa un correo válido.' })
  @MaxLength(120)
  email: string;

  @ApiProperty({ description: 'Contraseña inicial (mínimo 8 caracteres)' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(72) // bcrypt solo considera los primeros 72 bytes
  password: string;
}
