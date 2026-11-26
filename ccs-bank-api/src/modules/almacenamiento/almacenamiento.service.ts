import { Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';

/** Buckets privados de Supabase Storage que usa la app. */
export type Bucket = 'reportes' | 'avatares' | 'cvs';

const SEGUNDOS_URL_POR_DEFECTO = 120; // las URLs firmadas duran poco
const LIMITE_BYTES = 2 * 1024 * 1024;

/**
 * Acceso a Supabase Storage (buckets privados) solo desde el backend, con la service key.
 * Se usa la API REST directamente: no hace falta ninguna librería extra.
 */
@Injectable()
export class AlmacenamientoService {
  private readonly log = new Logger(AlmacenamientoService.name);
  private readonly bucketsListos = new Map<Bucket, Promise<void>>();

  private config() {
    const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
    const llave = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !llave) {
      throw new ServiceUnavailableException(
        'El almacenamiento de archivos no está configurado (faltan SUPABASE_URL y SUPABASE_SERVICE_KEY).',
      );
    }
    return { base: `${url}/storage/v1`, llave };
  }

  private cabeceras(llave: string, extra: Record<string, string> = {}) {
    return { Authorization: `Bearer ${llave}`, apikey: llave, ...extra };
  }

  /** Crea el bucket privado la primera vez si no existe. */
  private asegurarBucket(bucket: Bucket): Promise<void> {
    let listo = this.bucketsListos.get(bucket);
    if (!listo) {
      listo = (async () => {
        const { base, llave } = this.config();
        const res = await fetch(`${base}/bucket`, {
          method: 'POST',
          headers: this.cabeceras(llave, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({ id: bucket, name: bucket, public: false, file_size_limit: LIMITE_BYTES }),
        });
        // 200 = creado; 400/409 = ya existía.
        if (!res.ok && res.status !== 400 && res.status !== 409) {
          throw new Error(`No se pudo preparar el bucket ${bucket} (${res.status}).`);
        }
      })().catch((e) => {
        this.bucketsListos.delete(bucket);
        throw e;
      });
      this.bucketsListos.set(bucket, listo);
    }
    return listo;
  }

  async subir(bucket: Bucket, ruta: string, contenido: Buffer, tipo: string): Promise<void> {
    try {
      await this.asegurarBucket(bucket);
      const { base, llave } = this.config();
      const res = await fetch(`${base}/object/${bucket}/${ruta}`, {
        method: 'POST',
        headers: this.cabeceras(llave, { 'Content-Type': tipo, 'x-upsert': 'true' }),
        body: new Uint8Array(contenido),
      });
      if (!res.ok) throw new Error(`Storage respondió ${res.status}: ${await res.text()}`);
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e;
      this.log.error(e);
      throw new InternalServerErrorException('No se pudo guardar el archivo. Inténtalo de nuevo.');
    }
  }

  /** Borra un archivo; si falla solo se registra (no debe romper el flujo). */
  async borrar(bucket: Bucket, ruta: string): Promise<void> {
    try {
      const { base, llave } = this.config();
      const res = await fetch(`${base}/object/${bucket}/${ruta}`, {
        method: 'DELETE',
        headers: this.cabeceras(llave),
      });
      if (!res.ok && res.status !== 404) this.log.warn(`No se pudo borrar ${bucket}/${ruta} (${res.status}).`);
    } catch (e) {
      this.log.warn(`No se pudo borrar ${bucket}/${ruta}: ${String(e)}`);
    }
  }

  /** URL firmada de corta duración para ver el archivo. */
  async urlFirmada(bucket: Bucket, ruta: string, segundos = SEGUNDOS_URL_POR_DEFECTO): Promise<string> {
    const { base, llave } = this.config();
    const res = await fetch(`${base}/object/sign/${bucket}/${ruta}`, {
      method: 'POST',
      headers: this.cabeceras(llave, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn: segundos }),
    });
    if (!res.ok) {
      this.log.error(`No se pudo firmar ${bucket}/${ruta} (${res.status}).`);
      throw new InternalServerErrorException('No se pudo abrir el archivo.');
    }
    const { signedURL } = (await res.json()) as { signedURL: string };
    return `${base}${signedURL.startsWith('/') ? '' : '/'}${signedURL}`;
  }

  /**
   * Firma varias rutas del mismo bucket en una sola llamada (más rápido que una por archivo).
   * Devuelve un mapa ruta → URL; si algo falla devuelve lo que pudo (las fotos no son críticas).
   */
  async urlsFirmadas(bucket: Bucket, rutas: string[], segundos = SEGUNDOS_URL_POR_DEFECTO): Promise<Map<string, string>> {
    const mapa = new Map<string, string>();
    if (!rutas.length) return mapa;
    try {
      const { base, llave } = this.config();
      const res = await fetch(`${base}/object/sign/${bucket}`, {
        method: 'POST',
        headers: this.cabeceras(llave, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ expiresIn: segundos, paths: rutas }),
      });
      if (!res.ok) throw new Error(`Storage respondió ${res.status}`);
      const filas = (await res.json()) as { path: string; signedURL: string | null }[];
      for (const f of filas) {
        if (f.signedURL) mapa.set(f.path, `${base}${f.signedURL.startsWith('/') ? '' : '/'}${f.signedURL}`);
      }
    } catch (e) {
      this.log.warn(`No se pudieron firmar las URLs de ${bucket}: ${String(e)}`);
    }
    return mapa;
  }
}
