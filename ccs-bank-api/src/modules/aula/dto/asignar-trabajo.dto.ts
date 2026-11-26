import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

export class AsignarTrabajoDto {
  @ApiProperty({ description: 'Alumno que ocupará el trabajo. null = dejarlo sin asignar.', nullable: true })
  @ValidateIf((_, v) => v !== null)
  @IsUUID('all', { message: 'El alumno indicado no es válido.' })
  alumnoId: string | null;
}
