import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { createObserveModule } from '@nestjs/observe';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { HealthController } from './health.controller.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { GradosModule } from './modules/grados/grados.module.js';
import { AulaModule } from './modules/aula/aula.module.js';
import { NominaModule } from './modules/nomina/nomina.module.js';
import { CuentaModule } from './modules/cuenta/cuenta.module.js';
import { PerfilModule } from './modules/perfil/perfil.module.js';
import { ReportesModule } from './modules/reportes/reportes.module.js';
import { TiendaModule } from './modules/tienda/tienda.module.js';
import { UsuariosModule } from './modules/usuarios/usuarios.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

const VARIABLES_REQUERIDAS = ['DATABASE_URL', 'JWT_SECRET'];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env: Record<string, unknown>) => {
        const faltan = VARIABLES_REQUERIDAS.filter((v) => !env[v]);
        if (faltan.length) {
          throw new Error(`Faltan variables de entorno en .env: ${faltan.join(', ')}`);
        }
        return env;
      },
    }),
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com,
    // then run `npx @nestjs/observe link` to write your key pair into .env.
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'ccs-bank-api',
    }),
    PrismaModule,
    AuthModule,
    GradosModule,
    UsuariosModule,
    AulaModule,
    NominaModule,
    CuentaModule,
    ReportesModule,
    PerfilModule,
    TiendaModule,
  ],
  controllers: [HealthController],
  providers: [
    // Orden importante: primero autenticación, luego roles.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
