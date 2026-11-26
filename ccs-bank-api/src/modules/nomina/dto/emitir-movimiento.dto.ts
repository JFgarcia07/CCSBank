import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * Se emite con un concepto guardado (`conceptoId`) o como movimiento único,
 * escribiendo `tipo`, `concepto` (motivo) y `monto` a mano.
 */
export class EmitirMovimientoDto {
  @ApiPropertyOptional({ description: 'Concepto guardado de la clase (define tipo, motivo y monto)' })
  @IsOptional()
  @IsUUID('all', { message: 'Concepto no válido.' })
  conceptoId?: string;

  @ApiPropertyOptional({ enum: ['BONUS', 'FINE'], description: 'Solo sin conceptoId' })
  @ValidateIf((o: EmitirMovimientoDto) => !o.conceptoId)
  @IsIn(['BONUS', 'FINE'], { message: 'El tipo debe ser BONUS o FINE.' })
  tipo?: 'BONUS' | 'FINE';

  @ApiPropertyOptional({ description: 'Motivo escrito a mano. Solo sin conceptoId' })
  @ValidateIf((o: EmitirMovimientoDto) => !o.conceptoId)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Escribe el motivo.' })
  @MaxLength(200)
  concepto?: string;

  @ApiPropertyOptional({ description: 'Monto en CCS$ a cada alumno. Solo sin conceptoId' })
  @ValidateIf((o: EmitirMovimientoDto) => !o.conceptoId)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe ser un número con máximo 2 decimales.' })
  @Min(0.01, { message: 'El monto debe ser mayor que 0.' })
  @Max(100000)
  monto?: number;

  @ApiProperty({ description: 'Alumnos de la clase que recibirán el bonus o el fine', type: [String] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Elige al menos un alumno.' })
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  alumnoIds: string[];
}
