import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { ComprarDto } from './dto/comprar.dto.js';
import { ActualizarProductoDto, CrearProductoDto } from './dto/producto.dto.js';
import { CobroTarjetaDto, ConsultarTarjetaDto, RegistrarTarjetaDto } from './dto/tarjeta.dto.js';
import { TiendaService } from './tienda.service.js';

@ApiTags('tienda')
@ApiBearerAuth()
@Roles('ALUMNO')
@Controller('tienda')
export class TiendaController {
  constructor(private readonly tienda: TiendaService) {}

  @Get()
  @ApiOperation({ summary: 'Mi saldo y los productos disponibles en mi clase' })
  catalogo(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.tienda.catalogo(usuario);
  }

  @Post('compras')
  @HttpCode(201)
  @ApiOperation({ summary: 'Comprar por transferencia (descuenta de mi saldo; nunca deja deuda)' })
  comprar(@Body() dto: ComprarDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.tienda.comprar(usuario, dto);
  }

  @Get('compras')
  @ApiOperation({ summary: 'Mis compras recientes' })
  misCompras(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.tienda.misCompras(usuario);
  }
}

// El MAESTRO solo opera en sus clases; el ADMIN, en todas.
@ApiTags('nomina')
@ApiBearerAuth()
@Roles('MAESTRO')
@Controller('nomina')
export class TiendaGestionController {
  constructor(private readonly tienda: TiendaService) {}

  @Get('clases/:id/tienda')
  @ApiOperation({ summary: 'Productos y compras de la tienda de la clase' })
  gestion(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.tienda.gestion(id, usuario);
  }

  @Post('clases/:id/productos')
  @HttpCode(201)
  @ApiOperation({ summary: 'Crear un producto' })
  crear(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CrearProductoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.tienda.crearProducto(id, dto, usuario);
  }

  @Patch('productos/:id')
  @ApiOperation({ summary: 'Editar un producto (precio, stock, ocultar)' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarProductoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.tienda.actualizarProducto(id, dto, usuario);
  }

  @Delete('productos/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar un producto sin compras' })
  eliminar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.tienda.eliminarProducto(id, usuario);
  }

  @Get('clases/:id/tarjetas')
  @ApiOperation({ summary: 'Alumnos de la clase y el estado de su tarjeta NFC' })
  tarjetas(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.tienda.tarjetas(id, usuario);
  }

  @Post('clases/:id/tarjetas/consulta')
  @HttpCode(200)
  @ApiOperation({ summary: 'De quién es una tarjeta (antes de pedir el PIN)' })
  consultar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConsultarTarjetaDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.tienda.consultarTarjeta(id, dto.uid, usuario);
  }

  @Post('clases/:id/cobro-tarjeta')
  @HttpCode(201)
  @ApiOperation({ summary: 'Cobrar una compra con tarjeta NFC (UID + PIN)' })
  cobrarConTarjeta(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CobroTarjetaDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.tienda.cobrarConTarjeta(id, dto, usuario);
  }

  @Put('alumnos/:alumnoId/tarjeta')
  @HttpCode(204)
  @ApiOperation({ summary: 'Registrar o reemplazar la tarjeta de un alumno y su PIN' })
  registrarTarjeta(
    @Param('alumnoId', ParseUUIDPipe) alumnoId: string,
    @Body() dto: RegistrarTarjetaDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.tienda.registrarTarjeta(alumnoId, dto.uid, dto.pin, usuario);
  }

  @Post('alumnos/:alumnoId/tarjeta/bloqueo')
  @HttpCode(204)
  @ApiOperation({ summary: 'Bloquear la tarjeta de un alumno' })
  bloquear(@Param('alumnoId', ParseUUIDPipe) alumnoId: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.tienda.cambiarEstadoTarjeta(alumnoId, true, usuario);
  }

  @Delete('alumnos/:alumnoId/tarjeta/bloqueo')
  @HttpCode(204)
  @ApiOperation({ summary: 'Reactivar la tarjeta de un alumno' })
  activar(@Param('alumnoId', ParseUUIDPipe) alumnoId: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.tienda.cambiarEstadoTarjeta(alumnoId, false, usuario);
  }

  @Delete('alumnos/:alumnoId/tarjeta')
  @HttpCode(204)
  @ApiOperation({ summary: 'Quitar la tarjeta de un alumno' })
  quitarTarjeta(@Param('alumnoId', ParseUUIDPipe) alumnoId: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.tienda.quitarTarjeta(alumnoId, usuario);
  }

  @Post('compras/:id/entrega')
  @HttpCode(204)
  @ApiOperation({ summary: 'Marcar una compra como entregada' })
  entregar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.tienda.marcarEntrega(id, true, usuario);
  }

  @Delete('compras/:id/entrega')
  @HttpCode(204)
  @ApiOperation({ summary: 'Deshacer la entrega de una compra' })
  deshacerEntrega(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.tienda.marcarEntrega(id, false, usuario);
  }
}
