import { Body, Controller, Delete, Get, HttpCode, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto.js';
import { type ArchivoSubido, PerfilService, TAMANO_MAXIMO } from './perfil.service.js';

// Cada persona solo ve y cambia su propio perfil (siempre se usa el usuario del token).
// Email y contraseña NO se cambian aquí: solo un maestro o un admin.
const subida = () =>
  UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: TAMANO_MAXIMO + 1024 * 1024, files: 1 } }));

@ApiTags('perfil')
@ApiBearerAuth()
@Controller('perfil')
export class PerfilController {
  constructor(private readonly perfil: PerfilService) {}

  @Get()
  @ApiOperation({ summary: 'Mi perfil' })
  obtener(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.perfil.obtener(usuario);
  }

  @Patch()
  @ApiOperation({ summary: 'Cambiar mi nombre y apellidos' })
  actualizar(@Body() dto: ActualizarPerfilDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.perfil.actualizar(usuario, dto);
  }

  @Post('foto')
  @HttpCode(201)
  @subida()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir o cambiar mi foto (JPG, PNG o WEBP, máximo 2 MB)' })
  subirFoto(@UploadedFile() archivo: ArchivoSubido | undefined, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.perfil.subirFoto(usuario, archivo);
  }

  @Delete('foto')
  @ApiOperation({ summary: 'Quitar mi foto' })
  quitarFoto(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.perfil.quitarFoto(usuario);
  }

  // El CV es solo para alumnos (docentes y admins no lo suben); se valida aquí, no solo en la pantalla.
  @Post('cv')
  @Roles('ALUMNO')
  @HttpCode(201)
  @subida()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir o reemplazar mi CV (PDF, máximo 2 MB)' })
  subirCv(@UploadedFile() archivo: ArchivoSubido | undefined, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.perfil.subirCv(usuario, archivo);
  }

  @Delete('cv')
  @Roles('ALUMNO')
  @ApiOperation({ summary: 'Quitar mi CV' })
  quitarCv(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.perfil.quitarCv(usuario);
  }

  @Get('cv/url')
  @Roles('ALUMNO')
  @ApiOperation({ summary: 'URL firmada (de corta duración) para ver mi CV' })
  urlDelCv(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.perfil.urlDelCv(usuario);
  }
}
