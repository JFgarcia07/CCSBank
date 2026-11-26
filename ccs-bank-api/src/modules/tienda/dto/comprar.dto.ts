import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';

export class ItemCompraDto {
  @ApiProperty()
  @IsUUID(undefined, { message: 'Producto no válido.' })
  productoId: string;

  @ApiProperty({ example: 1 })
  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(1, { message: 'La cantidad mínima es 1.' })
  @Max(20, { message: 'La cantidad máxima por producto es 20.' })
  cantidad: number;
}

export class ComprarDto {
  @ApiProperty({ type: [ItemCompraDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Elige al menos un producto.' })
  @ArrayMaxSize(20, { message: 'Demasiados productos en una sola compra.' })
  @ValidateNested({ each: true })
  @Type(() => ItemCompraDto)
  items: ItemCompraDto[];
}
