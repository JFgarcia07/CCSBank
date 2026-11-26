import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsString, Max, MaxLength, Min } from 'class-validator';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CrearConceptoDto {
  @ApiProperty({ enum: ['BONUS', 'FINE'] })
  @IsIn(['BONUS', 'FINE'], { message: 'El tipo debe ser BONUS o FINE.' })
  tipo: 'BONUS' | 'FINE';

  @ApiProperty({ description: 'Motivo que verá el alumno', example: 'Participación destacada' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Escribe el motivo.' })
  @MaxLength(200)
  nombre: string;

  @ApiProperty({ description: 'Monto en CCS$', example: 10 })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe ser un número con máximo 2 decimales.' })
  @Min(0.01, { message: 'El monto debe ser mayor que 0.' })
  @Max(100000)
  monto: number;
}
