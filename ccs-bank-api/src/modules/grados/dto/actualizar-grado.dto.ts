import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

export class ActualizarGradoDto {
  @ApiPropertyOptional({ example: '6to Primaria B' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Ingresa el nombre de la clase.' })
  @MaxLength(80)
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Docente de la clase (reemplaza al anterior). null = dejar la clase sin docente.',
    nullable: true,
  })
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsUUID('all')
  maestroId?: string | null;
}
