import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto.js';
import { CrearAlumnoDto } from './dto/crear-alumno.dto.js';
import { CrearDocenteDto } from './dto/crear-docente.dto.js';
import { UsuariosService } from './usuarios.service.js';

// No hay registro público: solo el ADMIN crea cuentas.
@ApiTags('usuarios')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get('docentes')
  @ApiOperation({ summary: 'Listar docentes' })
  listarDocentes() {
    return this.usuarios.listar('MAESTRO');
  }

  @Get('admins')
  @ApiOperation({ summary: 'Listar administradores' })
  listarAdmins() {
    return this.usuarios.listar('ADMIN');
  }

  @Get('alumnos')
  @ApiOperation({ summary: 'Listar alumnos' })
  listarAlumnos() {
    return this.usuarios.listar('ALUMNO');
  }

  @Post('docentes')
  @ApiOperation({ summary: 'Crear docente (correo y contraseña)' })
  crearDocente(@Body() dto: CrearDocenteDto, @UsuarioActual() admin: UsuarioAutenticado) {
    return this.usuarios.crearDocente(dto, admin);
  }

  @Post('admins')
  @ApiOperation({ summary: 'Crear administrador (correo y contraseña)' })
  crearAdmin(@Body() dto: CrearDocenteDto, @UsuarioActual() admin: UsuarioAutenticado) {
    return this.usuarios.crearAdmin(dto, admin);
  }

  @Post('alumnos')
  @ApiOperation({ summary: 'Crear alumno (usuario y contraseña)' })
  crearAlumno(@Body() dto: CrearAlumnoDto, @UsuarioActual() admin: UsuarioAutenticado) {
    return this.usuarios.crearAlumno(dto, admin);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar una cuenta (solo se cambia lo que se envía)' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarUsuarioDto,
    @UsuarioActual() admin: UsuarioAutenticado,
  ) {
    return this.usuarios.actualizar(id, dto, admin);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una cuenta (solo si no tiene historial)' })
  eliminar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() admin: UsuarioAutenticado) {
    return this.usuarios.eliminar(id, admin);
  }
}
