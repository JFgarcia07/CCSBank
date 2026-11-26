import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CrearAlumnoDto {
  @ApiProperty({ example: 'Pedro' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Ingresa el nombre.' })
  @MaxLength(80)
  nombre: string;

  @ApiProperty({ example: 'Pérez' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Ingresa los apellidos.' })
  @MaxLength(80)
  apellidos: string;

  @ApiProperty({ description: 'Nombre de usuario para iniciar sesión', example: 'pedro.perez' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @Matches(/^[a-z0-9._-]{3,30}$/, {
    message: 'El usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo.',
  })
  username: string;

  @ApiProperty({ description: 'Contraseña inicial (mínimo 8 caracteres)' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(72)
  password: string;

  @ApiPropertyOptional({ description: 'Clase (grado) a la que pertenece' })
  @IsOptional()
  @IsUUID('all', { message: 'La clase indicada no es válida.' })
  gradoId?: string;
}
