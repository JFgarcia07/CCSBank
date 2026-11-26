import { Module } from '@nestjs/common';
import { AlmacenamientoModule } from '../almacenamiento/almacenamiento.module.js';
import { AulaController } from './aula.controller.js';
import { AulaService } from './aula.service.js';

@Module({
  imports: [AlmacenamientoModule],
  controllers: [AulaController],
  providers: [AulaService],
})
export class AulaModule {}
