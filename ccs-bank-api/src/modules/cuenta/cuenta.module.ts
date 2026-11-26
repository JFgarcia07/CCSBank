import { Module } from '@nestjs/common';
import { CuentaController } from './cuenta.controller.js';
import { CuentaService } from './cuenta.service.js';

@Module({
  controllers: [CuentaController],
  providers: [CuentaService],
})
export class CuentaModule {}
