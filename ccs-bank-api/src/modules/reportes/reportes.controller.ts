import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { PagarSalariosDto } from './dto/pagar-salarios.dto.js';
import { RevisarReporteDto } from './dto/revisar-reporte.dto.js';
import { type ArchivoSubido, ReportesService, TAMANO_MAXIMO } from './reportes.service.js';

// ───── Alumno: su trabajo y sus reportes ─────
@ApiTags('trabajo')
@ApiBearerAuth()
@Roles('ALUMNO')
@Controller('trabajo')
export class TrabajoController {
  constructor(private readonly reportes: ReportesService) {}

  @Get()
  @ApiOperation({ summary: 'Mi trabajo, la semana en curso y mis reportes' })
  miTrabajo(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.reportes.miTrabajo(usuario);
  }

  @Post('reportes')
  @HttpCode(201)
  @ApiOperation({ summary: 'Subir (o reemplazar) el reporte semanal en PDF, máximo 2 MB' })
  @ApiConsumes('multipart/form-data')
  // Un poco más que el máximo: el servicio devuelve un mensaje claro si se pasa.
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: TAMANO_MAXIMO + 1024 * 1024, files: 1 } }))
  subir(@UploadedFile() archivo: ArchivoSubido | undefined, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.reportes.subir(usuario, archivo);
  }
}

// ───── Ver el PDF de un reporte (alumno dueño, o docente de la clase) ─────
@ApiTags('reportes')
@ApiBearerAuth()
@Controller('reportes')
export class ArchivoReporteController {
  constructor(private readonly reportes: ReportesService) {}

  @Get(':id/url')
  @Roles('ALUMNO', 'MAESTRO')
  @ApiOperation({ summary: 'URL firmada (de corta duración) para ver el PDF' })
  url(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.reportes.urlDelArchivo(id, usuario);
  }
}

// ───── Maestro / Admin: revisión y pago de salarios ─────
@ApiTags('nomina')
@ApiBearerAuth()
@Roles('MAESTRO')
@Controller('nomina')
export class RevisionController {
  constructor(private readonly reportes: ReportesService) {}

  @Get('clases/:id/reportes')
  @ApiOperation({ summary: 'Reportes de la clase en una semana (por defecto la actual)' })
  listar(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('semana') semana: string | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.reportes.listar(id, semana, usuario);
  }

  @Post('reportes/:id/revision')
  @HttpCode(204)
  @ApiOperation({ summary: 'Aprobar o rechazar un reporte' })
  revisar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevisarReporteDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.reportes.revisar(id, dto, usuario);
  }

  @Post('clases/:id/salarios')
  @HttpCode(201)
  @ApiOperation({ summary: 'Pagar los salarios de los reportes aprobados de una semana' })
  pagar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PagarSalariosDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.reportes.pagarSalarios(id, dto.semana, usuario);
  }
}
