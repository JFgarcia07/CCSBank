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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { ActualizarGradoDto } from './dto/actualizar-grado.dto.js';
import { CrearGradoDto } from './dto/crear-grado.dto.js';
import { GradosService } from './grados.service.js';

// Solo ADMIN: el RolesGuard deja pasar al ADMIN donde se pide MAESTRO, pero no al revés.
@ApiTags('grados')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('grados')
export class GradosController {
  constructor(private readonly grados: GradosService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una clase (con un docente opcional)' })
  crear(@Body() dto: CrearGradoDto, @UsuarioActual() admin: UsuarioAutenticado) {
    return this.grados.crear(dto, admin);
  }

  @Get()
  @ApiOperation({ summary: 'Listar clases con sus docentes' })
  listar() {
    return this.grados.listar();
  }

  // Debe ir antes de ':id' para que "maestros" no se tome como un id.
  @Get('maestros')
  @ApiOperation({ summary: 'Docentes activos disponibles para asignar' })
  listarMaestros() {
    return this.grados.listarMaestros();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una clase' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.grados.obtener(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar nombre y/o docente de una clase' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarGradoDto,
    @UsuarioActual() admin: UsuarioAutenticado,
  ) {
    return this.grados.actualizar(id, dto, admin);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una clase (solo si no tiene alumnos)' })
  eliminar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() admin: UsuarioAutenticado) {
    return this.grados.eliminar(id, admin);
  }
}
