import { Module } from '@nestjs/common';
import { AlmacenamientoModule } from '../almacenamiento/almacenamiento.module.js';
import { PerfilController } from './perfil.controller.js';
import { PerfilService } from './perfil.service.js';

@Module({
  imports: [AlmacenamientoModule],
  controllers: [PerfilController],
  providers: [PerfilService],
})
export class PerfilModule {}
