import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const minusculas = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Todos los campos son opcionales: solo se cambia lo que llega. */
export class ActualizarUsuarioDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Ingresa el nombre.' })
  @MaxLength(80)
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Ingresa los apellidos.' })
  @MaxLength(80)
  apellidos?: string;

  @ApiPropertyOptional({ description: 'Correo (solo docentes y administradores)' })
  @IsOptional()
  @Transform(minusculas)
  @IsEmail({}, { message: 'Ingresa un correo válido.' })
  @MaxLength(120)
  email?: string;

  @ApiPropertyOptional({ description: 'Nombre de usuario (solo alumnos)' })
  @IsOptional()
  @Transform(minusculas)
  @IsString()
  @Matches(/^[a-z0-9._-]{3,30}$/, {
    message: 'El usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo.',
  })
  username?: string;

  @ApiPropertyOptional({ description: 'Clase del alumno. null = sin clase.', nullable: true })
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsUUID('all', { message: 'La clase indicada no es válida.' })
  gradoId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({ description: 'Nueva contraseña (mínimo 8 caracteres)' })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(72)
  password?: string;
}
