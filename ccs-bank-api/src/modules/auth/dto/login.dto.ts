import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'Carné, usuario o email', example: 'admin' })
  @IsString()
  @IsNotEmpty({ message: 'Ingresa tu carné o usuario.' })
  @MaxLength(100)
  usuario: string;

  @ApiProperty({ description: 'Contraseña', example: '********' })
  @IsString()
  @IsNotEmpty({ message: 'Ingresa tu contraseña.' })
  @MaxLength(72) // bcrypt solo considera los primeros 72 bytes
  password: string;
}
