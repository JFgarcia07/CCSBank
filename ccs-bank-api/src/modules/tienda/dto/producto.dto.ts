import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CrearProductoDto {
  @ApiProperty({ example: 'Lápiz decorado' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Escribe el nombre del producto.' })
  @MaxLength(100)
  nombre: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(300)
  descripcion?: string;

  @ApiProperty({ example: 25 })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio debe ser un número con máximo 2 decimales.' })
  @Min(0.01, { message: 'El precio debe ser mayor que 0.' })
  @Max(1000000)
  precio: number;

  @ApiProperty({ example: 10 })
  @IsInt({ message: 'El stock debe ser un número entero.' })
  @Min(0, { message: 'El stock no puede ser negativo.' })
  @Max(100000)
  stock: number;
}

export class ActualizarProductoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Escribe el nombre del producto.' })
  @MaxLength(100)
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(300)
  descripcion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'El precio debe ser mayor que 0.' })
  @Max(1000000)
  precio?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'El stock no puede ser negativo.' })
  @Max(100000)
  stock?: number;

  @ApiPropertyOptional({ description: 'false = ocultar de la tienda sin borrarlo' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
