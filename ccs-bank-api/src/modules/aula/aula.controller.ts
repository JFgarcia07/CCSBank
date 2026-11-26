import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { AulaService } from './aula.service.js';
import { ActualizarTrabajoDto } from './dto/actualizar-trabajo.dto.js';
import { AsignarTrabajoDto } from './dto/asignar-trabajo.dto.js';
import { CrearTrabajoDto } from './dto/crear-trabajo.dto.js';

// Pantalla "Grado": el MAESTRO solo accede a sus clases; el ADMIN, a todas.
@ApiTags('aula')
@ApiBearerAuth()
@Roles('MAESTRO')
@Controller('aula')
export class AulaController {
  constructor(private readonly aula: AulaService) {}

  @Get('clases')
  @ApiOperation({ summary: 'Clases a las que tiene acceso el usuario' })
  clases(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.aula.clases(usuario);
  }

  @Get('clases/:id')
  @ApiOperation({ summary: 'Resumen (saldo, bonus, fines) y trabajos de la clase en una sola llamada' })
  detalle(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.aula.detalle(id, usuario);
  }

  @Get('clases/:id/resumen')
  @ApiOperation({ summary: 'Alumnos de la clase con saldo, bonus y fines' })
  resumen(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.aula.resumen(id, usuario);
  }

  @Get('clases/:id/trabajos')
  @ApiOperation({ summary: 'Trabajos de la clase con su alumno asignado' })
  trabajos(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.aula.trabajos(id, usuario);
  }

  @Post('clases/:id/trabajos')
  @ApiOperation({ summary: 'Crear un trabajo en la clase' })
  crearTrabajo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CrearTrabajoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.aula.crearTrabajo(id, dto, usuario);
  }

  @Post('clases/:id/trabajos/liberar-todos')
  @HttpCode(200)
  @ApiOperation({ summary: 'Quitar a todos los alumnos de sus trabajos (los trabajos quedan libres)' })
  liberarTodos(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.aula.liberarTodos(id, usuario);
  }

  @Patch('trabajos/:id')
  @ApiOperation({ summary: 'Editar un trabajo (nombre, responsabilidades, salario, activo)' })
  actualizarTrabajo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarTrabajoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.aula.actualizarTrabajo(id, dto, usuario);
  }

  @Delete('trabajos/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar un trabajo (solo si nunca tuvo alumnos)' })
  eliminarTrabajo(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.aula.eliminarTrabajo(id, usuario);
  }

  @Put('trabajos/:id/asignado')
  @ApiOperation({ summary: 'Asignar el trabajo a un alumno (o dejarlo libre con null)' })
  asignar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarTrabajoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.aula.asignar(id, dto.alumnoId, usuario);
  }
}
