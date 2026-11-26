import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { ActualizarConceptoDto } from './dto/actualizar-concepto.dto.js';
import { CrearConceptoDto } from './dto/crear-concepto.dto.js';
import { EmitirMovimientoDto } from './dto/emitir-movimiento.dto.js';
import { NominaService } from './nomina.service.js';

// El MAESTRO solo opera en sus clases; el ADMIN, en todas.
@ApiTags('nomina')
@ApiBearerAuth()
@Roles('MAESTRO')
@Controller('nomina')
export class NominaController {
  constructor(private readonly nomina: NominaService) {}

  @Get('clases/:id')
  @ApiOperation({ summary: 'Alumnos de la clase y últimos bonus y fines emitidos' })
  detalle(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.nomina.detalle(id, usuario);
  }

  @Get('clases/:id/transacciones')
  @ApiOperation({ summary: 'Bonus, fines y salarios de la clase o de un alumno (?alumnoId=); filtro opcional ?tipo=BONUS|FINE|SALARIO' })
  transacciones(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('tipo') tipo: string | undefined,
    @Query('alumnoId', new ParseUUIDPipe({ optional: true })) alumnoId: string | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.nomina.transacciones(id, tipo, alumnoId, usuario);
  }

  @Post('clases/:id/movimientos')
  @HttpCode(201)
  @ApiOperation({ summary: 'Emitir un bonus (pendiente de cobro) o aplicar un fine (descuento inmediato)' })
  emitir(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EmitirMovimientoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.nomina.emitir(id, dto, usuario);
  }

  @Delete('movimientos/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Quitar un bonus o salario por cobrar, o revertir un fine ya aplicado' })
  quitarMovimiento(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.nomina.quitarMovimiento(id, usuario);
  }

  @Post('clases/:id/conceptos')
  @HttpCode(201)
  @ApiOperation({ summary: 'Crear un concepto de bonus o fine para la clase' })
  crearConcepto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CrearConceptoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.nomina.crearConcepto(id, dto, usuario);
  }

  @Patch('conceptos/:id')
  @ApiOperation({ summary: 'Editar un concepto' })
  actualizarConcepto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarConceptoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.nomina.actualizarConcepto(id, dto, usuario);
  }

  @Delete('conceptos/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar un concepto (el historial se conserva)' })
  eliminarConcepto(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.nomina.eliminarConcepto(id, usuario);
  }
}
