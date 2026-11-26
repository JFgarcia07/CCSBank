import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AlmacenamientoService } from '../almacenamiento/almacenamiento.service.js';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto.js';

export const TAMANO_MAXIMO = 2 * 1024 * 1024; // 2 MB
const SEGUNDOS_FOTO = 3600; // la foto se muestra en toda la app; se renueva al recargar el perfil

export interface ArchivoSubido {
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Detecta el tipo real de una imagen por su contenido (no por lo que diga el navegador). */
function tipoDeImagen(b: Buffer): { mime: string; ext: string } | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}

@Injectable()
export class PerfilService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly almacenamiento: AlmacenamientoService,
  ) {}

  private async cargar(id: string) {
    const u = await this.prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        carne: true,
        email: true,
        nombre: true,
        apellidos: true,
        rol: true,
        gradoId: true,
        fotoUrl: true,
        cvUrl: true,
        grado: { select: { id: true, nombre: true } },
        gradosAsignados: { select: { grado: { select: { id: true, nombre: true } } } },
      },
    });
    if (!u) throw new NotFoundException('El usuario no existe.');
    return u;
  }

  /** Mi perfil: datos, foto (URL temporal) y si tengo un CV subido. */
  async obtener(usuario: UsuarioAutenticado) {
    const u = await this.cargar(usuario.id);
    const foto = u.fotoUrl ? await this.almacenamiento.urlFirmada('avatares', u.fotoUrl, SEGUNDOS_FOTO).catch(() => null) : null;
    return {
      id: u.id,
      carne: u.carne,
      email: u.email,
      nombre: u.nombre,
      apellidos: u.apellidos,
      rol: u.rol,
      gradoId: u.gradoId,
      // Alumno: su clase. Docente: las clases que tiene asignadas.
      clases: u.rol === 'ALUMNO' ? (u.grado ? [u.grado] : []) : u.gradosAsignados.map((g) => g.grado),
      fotoUrl: foto,
      tieneCv: !!u.cvUrl,
    };
  }

  async actualizar(usuario: UsuarioAutenticado, dto: ActualizarPerfilDto) {
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { nombre: dto.nombre, apellidos: dto.apellidos },
    });
    return this.obtener(usuario);
  }

  // ───────────────────────── Foto ─────────────────────────

  async subirFoto(usuario: UsuarioAutenticado, archivo: ArchivoSubido | undefined) {
    if (!archivo) throw new BadRequestException('Elige una foto.');
    if (archivo.size > TAMANO_MAXIMO) {
      throw new BadRequestException('La foto pesa más de 2 MB. Elige una más pequeña.');
    }
    const tipo = tipoDeImagen(archivo.buffer);
    if (!tipo) throw new BadRequestException('La foto debe ser una imagen JPG, PNG o WEBP.');

    const anterior = (await this.cargar(usuario.id)).fotoUrl;
    // Nombre nuevo en cada subida: así nadie ve una foto vieja guardada en caché.
    const ruta = `${usuario.id}/${randomUUID()}.${tipo.ext}`;
    await this.almacenamiento.subir('avatares', ruta, archivo.buffer, tipo.mime);
    await this.prisma.usuario.update({ where: { id: usuario.id }, data: { fotoUrl: ruta } });
    if (anterior) await this.almacenamiento.borrar('avatares', anterior);
    return this.obtener(usuario);
  }

  async quitarFoto(usuario: UsuarioAutenticado) {
    const anterior = (await this.cargar(usuario.id)).fotoUrl;
    if (anterior) {
      await this.prisma.usuario.update({ where: { id: usuario.id }, data: { fotoUrl: null } });
      await this.almacenamiento.borrar('avatares', anterior);
    }
    return this.obtener(usuario);
  }

  // ───────────────────────── CV ─────────────────────────

  async subirCv(usuario: UsuarioAutenticado, archivo: ArchivoSubido | undefined) {
    if (!archivo) throw new BadRequestException('Adjunta tu CV en PDF.');
    if (archivo.size > TAMANO_MAXIMO) {
      throw new BadRequestException('El PDF pesa más de 2 MB. Reduce su tamaño y vuelve a intentarlo.');
    }
    if (archivo.mimetype !== 'application/pdf' || archivo.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new BadRequestException('El CV debe ser un PDF.');
    }

    const anterior = (await this.cargar(usuario.id)).cvUrl;
    const ruta = `${usuario.id}/${randomUUID()}.pdf`;
    await this.almacenamiento.subir('cvs', ruta, archivo.buffer, 'application/pdf');
    await this.prisma.usuario.update({ where: { id: usuario.id }, data: { cvUrl: ruta } });
    if (anterior) await this.almacenamiento.borrar('cvs', anterior);
    return this.obtener(usuario);
  }

  async quitarCv(usuario: UsuarioAutenticado) {
    const anterior = (await this.cargar(usuario.id)).cvUrl;
    if (anterior) {
      await this.prisma.usuario.update({ where: { id: usuario.id }, data: { cvUrl: null } });
      await this.almacenamiento.borrar('cvs', anterior);
    }
    return this.obtener(usuario);
  }

  async urlDelCv(usuario: UsuarioAutenticado) {
    const { cvUrl } = await this.cargar(usuario.id);
    if (!cvUrl) throw new NotFoundException('Aún no has subido tu CV.');
    return { url: await this.almacenamiento.urlFirmada('cvs', cvUrl) };
  }
}
