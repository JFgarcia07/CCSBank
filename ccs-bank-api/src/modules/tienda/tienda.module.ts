import { Module } from '@nestjs/common';
import { TiendaController, TiendaGestionController } from './tienda.controller.js';
import { TiendaService } from './tienda.service.js';

@Module({
  controllers: [TiendaController, TiendaGestionController],
  providers: [TiendaService],
})
export class TiendaModule {}
