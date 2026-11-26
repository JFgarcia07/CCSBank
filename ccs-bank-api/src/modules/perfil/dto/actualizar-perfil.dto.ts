import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ActualizarPerfilDto {
  @ApiProperty({ example: 'María José' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Escribe tu nombre.' })
  @MaxLength(80)
  nombre: string;

  @ApiProperty({ example: 'García López' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Escribe tus apellidos.' })
  @MaxLength(80)
  apellidos: string;
}
