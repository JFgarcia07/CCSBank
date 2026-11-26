import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';
import { ComprarDto } from './comprar.dto.js';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ConsultarTarjetaDto {
  @ApiProperty({ description: 'UID leído de la tarjeta NFC', example: '04:A2:3B:1C' })
  @Transform(recortar)
  @IsString()
  @Length(4, 64, { message: 'La tarjeta no se leyó bien. Inténtalo de nuevo.' })
  uid: string;
}

export class RegistrarTarjetaDto extends ConsultarTarjetaDto {
  @ApiProperty({ description: 'PIN de 4 dígitos', example: '1234' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'El PIN debe tener exactamente 4 dígitos.' })
  pin: string;
}

export class CobroTarjetaDto extends ComprarDto {
  @ApiProperty({ description: 'UID leído de la tarjeta NFC' })
  @Transform(recortar)
  @IsString()
  @Length(4, 64, { message: 'La tarjeta no se leyó bien. Inténtalo de nuevo.' })
  uid: string;

  @ApiProperty({ description: 'PIN de 4 dígitos del alumno' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'El PIN debe tener exactamente 4 dígitos.' })
  pin: string;
}
