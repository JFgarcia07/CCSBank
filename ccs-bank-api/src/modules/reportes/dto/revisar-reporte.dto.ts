import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RevisarReporteDto {
  @ApiProperty({ enum: ['APROBADO', 'RECHAZADO'] })
  @IsIn(['APROBADO', 'RECHAZADO'], { message: 'El estado debe ser APROBADO o RECHAZADO.' })
  estado: 'APROBADO' | 'RECHAZADO';

  @ApiPropertyOptional({ description: 'Obligatorio al rechazar: qué debe corregir el alumno' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsString()
  @MaxLength(500)
  comentario?: string;
}
