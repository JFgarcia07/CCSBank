import { Module } from '@nestjs/common';
import { AlmacenamientoModule } from '../almacenamiento/almacenamiento.module.js';
import { ArchivoReporteController, RevisionController, TrabajoController } from './reportes.controller.js';
import { ReportesService } from './reportes.service.js';

@Module({
  imports: [AlmacenamientoModule],
  controllers: [TrabajoController, ArchivoReporteController, RevisionController],
  providers: [ReportesService],
})
export class ReportesModule {}
