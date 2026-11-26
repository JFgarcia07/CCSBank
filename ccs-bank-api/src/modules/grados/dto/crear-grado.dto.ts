import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CrearGradoDto {
  @ApiProperty({ description: 'Nombre de la clase/grado', example: '6to Primaria A' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Ingresa el nombre de la clase.' })
  @MaxLength(80)
  nombre: string;

  @ApiPropertyOptional({ description: 'ID del docente (MAESTRO) de la clase. Solo puede haber uno.' })
  @IsOptional()
  @IsUUID('all')
  maestroId?: string;
}
