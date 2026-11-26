import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { CuentaService } from './cuenta.service.js';

// Cada alumno solo accede a su propia cuenta (siempre se usa el usuario del token).
@ApiTags('cuenta')
@ApiBearerAuth()
@Roles('ALUMNO')
@Controller('cuenta')
export class CuentaController {
  constructor(private readonly cuenta: CuentaService) {}

  @Get()
  @ApiOperation({ summary: 'Mi saldo y mis pagos pendientes por cobrar' })
  resumen(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.cuenta.resumen(usuario);
  }

  @Get('movimientos')
  @ApiOperation({ summary: 'Mi estado de cuenta: historial con el saldo tras cada movimiento (filtros y páginas)' })
  estadoDeCuenta(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query('tipo') tipo?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('pagina') pagina?: string,
  ) {
    return this.cuenta.estadoDeCuenta(usuario, { tipo, desde, hasta, pagina: pagina ? Number(pagina) : 1 });
  }

  // Debe ir antes de ':id/cobrar' para que "cobrar-todo" no se tome como un id.
  @Post('cobros/cobrar-todo')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cobrar todos mis pagos pendientes' })
  cobrarTodo(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.cuenta.cobrar(usuario);
  }

  @Post('cobros/:id/cobrar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cobrar un pago pendiente' })
  cobrar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.cuenta.cobrar(usuario, id);
  }
}
