import { Module } from '@nestjs/common';
import { GradosController } from './grados.controller.js';
import { GradosService } from './grados.service.js';

@Module({
  controllers: [GradosController],
  providers: [GradosService],
  exports: [GradosService],
})
export class GradosModule {}
