import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class PagarSalariosDto {
  @ApiProperty({ description: 'Lunes de la semana a pagar (AAAA-MM-DD)', example: '2026-11-16' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La semana debe tener formato AAAA-MM-DD.' })
  semana: string;
}
