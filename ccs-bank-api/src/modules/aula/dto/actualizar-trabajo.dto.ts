import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Solo se cambia lo que llega. */
export class ActualizarTrabajoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Ingresa el nombre del trabajo.' })
  @MaxLength(100)
  nombre?: string;

  @ApiPropertyOptional({ description: 'Responsabilidades. Vacío = sin descripción.' })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(1500)
  descripcion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El salario debe ser un número con máximo 2 decimales.' })
  @Min(0, { message: 'El salario no puede ser negativo.' })
  @Max(1000000)
  salarioSemanal?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
