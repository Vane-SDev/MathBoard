import { DurableObject } from 'cloudflare:workers'
import type { InfoSala } from '../src/lib/clausura'

// Solo actualizamos "último uso" si pasaron 10 minutos: reconectar en clase no gasta filas escritas.
const REFRESCO_MS = 10 * 60 * 1000

type FilaSala = { nombre: string; creada: number; ultimo_uso: number; clausurada: number }

// Los Durable Objects no se pueden enumerar: este objeto único ('indice') lleva la lista de salas.
// Lo llaman las salas al recibir una conexión y el Worker al clausurar o reabrir.
export class IndiceSalas extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.ctx.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS salas (nombre TEXT PRIMARY KEY, creada INTEGER NOT NULL, ultimo_uso INTEGER NOT NULL, clausurada INTEGER NOT NULL DEFAULT 0)'
    )
  }

  registrar(nombre: string): void {
    const ahora = Date.now()
    this.ctx.storage.sql.exec(
      `INSERT INTO salas (nombre, creada, ultimo_uso) VALUES (?, ?, ?)
       ON CONFLICT(nombre) DO UPDATE SET ultimo_uso = excluded.ultimo_uso
       WHERE salas.ultimo_uso < excluded.ultimo_uso - ?`,
      nombre,
      ahora,
      ahora,
      REFRESCO_MS
    )
  }

  marcar(nombre: string, clausurada: boolean): void {
    const ahora = Date.now()
    this.ctx.storage.sql.exec(
      `INSERT INTO salas (nombre, creada, ultimo_uso, clausurada) VALUES (?, ?, ?, ?)
       ON CONFLICT(nombre) DO UPDATE SET clausurada = excluded.clausurada`,
      nombre,
      ahora,
      ahora,
      clausurada ? 1 : 0
    )
  }

  listar(): InfoSala[] {
    return this.ctx.storage.sql
      .exec<FilaSala>('SELECT nombre, creada, ultimo_uso, clausurada FROM salas ORDER BY ultimo_uso DESC LIMIT 500')
      .toArray()
      .map((f) => ({ nombre: f.nombre, creada: f.creada, ultimoUso: f.ultimo_uso, clausurada: f.clausurada === 1 }))
  }
}
