import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CrearTrabajoDto {
  @ApiProperty({ example: 'Presidente (Líder de Proyectos)' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Ingresa el nombre del trabajo.' })
  @MaxLength(100)
  nombre: string;

  @ApiPropertyOptional({ description: 'Responsabilidades del trabajo' })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(1500)
  descripcion?: string;

  @ApiProperty({ description: 'Salario semanal en CCS$', example: 50 })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El salario debe ser un número con máximo 2 decimales.' })
  @Min(0, { message: 'El salario no puede ser negativo.' })
  @Max(1000000)
  salarioSemanal: number;
}
