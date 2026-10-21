import {
  InMemorySyncStorage,
  type RoomSnapshot,
  type SessionStateSnapshot,
  TLSocketRoom,
  TLSyncErrorCloseEventCode,
} from '@tldraw/sync-core'
import { createTLSchema, defaultBindingSchemas, defaultShapeSchemas, type TLRecord } from '@tldraw/tlschema'
import { DurableObject } from 'cloudflare:workers'
import { LAB_SCHEMAS } from '../src/shapes/schemas'
import { MOTIVO_SALA_CERRADA, type Actividad, type Visita } from '../src/lib/clausura'

// El servidor valida cada cambio con el mismo contrato que usan los ShapeUtil.
const schema = createTLSchema({
  shapes: { ...defaultShapeSchemas, ...LAB_SCHEMAS },
  bindings: { ...defaultBindingSchemas },
})

// Cada cuánto se pasa a SQLite lo que cambió. El plan gratis permite 100.000 filas escritas por día:
// guardar en cada envío (hasta 30 por segundo) lo agotaría en minutos.
const GUARDAR_CADA_MS = 5000

// Si alguien vuelve antes de 2 minutos (recarga, wifi que se corta) seguimos la misma visita.
const UNIR_VISITAS_MS = 2 * 60 * 1000
const MAX_VISITAS = 300

interface Adjunto {
  sessionId: string
  snapshot: SessionStateSnapshot | null
  nombre: string
  visita: number | null
}

function leerAdjunto(ws: WebSocket): Adjunto | null {
  const adjunto = ws.deserializeAttachment() as Partial<Adjunto> | null
  if (!adjunto?.sessionId) return null
  // Sockets de antes del gestor no traen nombre ni visita.
  return { snapshot: null, nombre: 'Sin nombre', visita: null, ...adjunto, sessionId: adjunto.sessionId }
}

type FilaRegistro = { id: string; estado: string; reloj: number }
type FilaMeta = { clave: string; valor: string }

// nueva: nadie la creó (no tiene tablas). abierta: la creó la profe. clausurada: la cerró la profe.
type Estado = 'nueva' | 'abierta' | 'clausurada'

// Una sala = un Durable Object. La sala vive en memoria mientras hay clase y se guarda en su SQLite
// en lotes. Cuando todos se van (o el objeto hiberna) se reconstruye desde SQLite.
export class SalaDurableObject extends DurableObject<Env> {
  private room: TLSocketRoom<TLRecord, void> | null = null
  private storage: InMemorySyncStorage<TLRecord> | null = null
  private readonly sessionIdToWs = new Map<string, WebSocket>()
  private temporizador: ReturnType<typeof setTimeout> | null = null
  private relojGuardado = 0
  private schemaGuardado = ''
  private idsGuardados = new Set<string>()
  // Se calcula una vez al despertar: rechazar una sala nueva o clausurada no escribe nada en SQLite.
  private estado: Estado

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // El cliente manda un ping cada 5 s: Cloudflare lo contesta sin despertar al objeto.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}'))
    const sql = this.ctx.storage.sql
    const tieneTablas = sql.exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'").toArray().length > 0
    if (!tieneTablas) {
      // Un nombre inventado: no creamos tablas, así no ocupa lugar ni gasta escrituras.
      this.estado = 'nueva'
      return
    }
    this.crearTablas()
    const estado = this.leerMeta('estado')
    if (estado === 'abierta' || estado === 'clausurada') {
      this.estado = estado
    } else {
      // Sala de antes del gestor (tiene tablas pero no estado): queda abierta y la profe la ve en el índice.
      this.estado = 'abierta'
      this.escribirMeta('estado', 'abierta')
    }
  }

  private crearTablas() {
    const sql = this.ctx.storage.sql
    sql.exec('CREATE TABLE IF NOT EXISTS registros (id TEXT PRIMARY KEY, estado TEXT NOT NULL, reloj INTEGER NOT NULL)')
    sql.exec('CREATE TABLE IF NOT EXISTS meta (clave TEXT PRIMARY KEY, valor TEXT NOT NULL)')
    sql.exec('CREATE TABLE IF NOT EXISTS visitas (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, entrada INTEGER NOT NULL, salida INTEGER)')
  }

  private leerMeta(clave: string): string | undefined {
    return this.ctx.storage.sql.exec<FilaMeta>('SELECT clave, valor FROM meta WHERE clave = ?', clave).toArray()[0]?.valor
  }

  private escribirMeta(clave: string, valor: string) {
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO meta (clave, valor) VALUES (?, ?)', clave, valor)
  }

  private cargarSnapshot(): RoomSnapshot | undefined {
    const sql = this.ctx.storage.sql
    const meta = new Map(sql.exec<FilaMeta>('SELECT clave, valor FROM meta').toArray().map((f) => [f.clave, f.valor]))
    const schemaTexto = meta.get('schema')
    if (!schemaTexto) return undefined
    const filas = sql.exec<FilaRegistro>('SELECT id, estado, reloj FROM registros').toArray()
    const reloj = Number(meta.get('reloj') ?? 0)
    this.relojGuardado = reloj
    this.schemaGuardado = schemaTexto
    this.idsGuardados = new Set(filas.map((f) => f.id))
    return {
      documentClock: reloj,
      // Sin historial de borrados: un cliente que vuelve con un reloj viejo recibe la sala completa.
      tombstoneHistoryStartsAtClock: reloj,
      schema: JSON.parse(schemaTexto),
      documents: filas.map((f) => ({ state: JSON.parse(f.estado), lastChangedClock: f.reloj })),
    }
  }

  private programarGuardado() {
    if (this.temporizador) return
    this.temporizador = setTimeout(() => this.guardar(), GUARDAR_CADA_MS)
  }

  private guardar() {
    if (this.temporizador) clearTimeout(this.temporizador)
    this.temporizador = null
    if (!this.storage) return
    const snap = this.storage.getSnapshot()
    const reloj = snap.documentClock ?? 0
    const schemaTexto = JSON.stringify(snap.schema)
    if (reloj === this.relojGuardado && schemaTexto === this.schemaGuardado) return
    const sql = this.ctx.storage.sql
    const vivos = new Set<string>()
    this.ctx.storage.transactionSync(() => {
      for (const doc of snap.documents) {
        vivos.add(doc.state.id)
        if (doc.lastChangedClock > this.relojGuardado || !this.idsGuardados.has(doc.state.id)) {
          sql.exec(
            'INSERT OR REPLACE INTO registros (id, estado, reloj) VALUES (?, ?, ?)',
            doc.state.id,
            JSON.stringify(doc.state),
            doc.lastChangedClock
          )
        }
      }
      for (const id of this.idsGuardados) {
        if (!vivos.has(id)) sql.exec('DELETE FROM registros WHERE id = ?', id)
      }
      sql.exec("INSERT OR REPLACE INTO meta (clave, valor) VALUES ('reloj', ?)", String(reloj))
      if (schemaTexto !== this.schemaGuardado) {
        sql.exec("INSERT OR REPLACE INTO meta (clave, valor) VALUES ('schema', ?)", schemaTexto)
      }
    })
    this.idsGuardados = vivos
    this.relojGuardado = reloj
    this.schemaGuardado = schemaTexto
  }

  private obtenerSala(): TLSocketRoom<TLRecord, void> {
    if (!this.room) {
      this.storage = new InMemorySyncStorage<TLRecord>({
        snapshot: this.cargarSnapshot(),
        onChange: () => this.programarGuardado(),
      })
      this.room = new TLSocketRoom<TLRecord, void>({
        schema,
        storage: this.storage,
        // Cloudflare mantiene viva la conexión con el auto-pong; sin esto se cortarían sesiones quietas.
        clientTimeout: Infinity,
        onSessionSnapshot: (sessionId, snapshot) => {
          const ws = this.sessionIdToWs.get(sessionId)
          const previo = ws && leerAdjunto(ws)
          if (ws && previo) ws.serializeAttachment({ ...previo, snapshot })
        },
      })
      // Retoma las sesiones que sobrevivieron a la hibernación.
      for (const ws of this.ctx.getWebSockets()) {
        const adjunto = leerAdjunto(ws)
        if (!adjunto?.snapshot) continue
        this.room.handleSocketResume({ sessionId: adjunto.sessionId, socket: ws, snapshot: adjunto.snapshot })
        this.sessionIdToWs.set(adjunto.sessionId, ws)
      }
    }
    return this.room
  }

  // --- Lo llama el Worker por RPC, solo con la clave de profe ---

  // Crear o reabrir: desde acá la sala acepta conexiones. El contenido (si había) sigue intacto.
  async abrir(): Promise<void> {
    this.crearTablas()
    this.escribirMeta('estado', 'abierta')
    this.estado = 'abierta'
  }

  // Bandera permanente: se guarda lo pendiente, se cierra la visita de todos y se los corta.
  async clausurar(): Promise<void> {
    this.guardar()
    this.crearTablas()
    this.escribirMeta('estado', 'clausurada')
    this.estado = 'clausurada'
    this.ctx.storage.sql.exec('UPDATE visitas SET salida = ? WHERE salida IS NULL', Date.now())
    for (const ws of this.ctx.getWebSockets()) ws.close(TLSyncErrorCloseEventCode, MOTIVO_SALA_CERRADA)
    this.room?.close()
    this.room = null
    this.storage = null
    this.sessionIdToWs.clear()
  }

  async actividad(): Promise<Actividad> {
    if (this.estado === 'nueva') return { enLinea: [], visitas: [] }
    const enLinea = new Set<string>()
    for (const ws of this.ctx.getWebSockets()) {
      const adjunto = leerAdjunto(ws)
      if (adjunto) enLinea.add(adjunto.nombre)
    }
    const visitas = this.ctx.storage.sql
      .exec<Visita>('SELECT nombre, entrada, salida FROM visitas ORDER BY id DESC LIMIT 50')
      .toArray()
    return { enLinea: [...enLinea], visitas }
  }

  // Una fila por entrada; si la misma persona vuelve enseguida, se reabre su visita anterior.
  private abrirVisita(nombre: string): number {
    const sql = this.ctx.storage.sql
    const ahora = Date.now()
    const previa = sql
      .exec<{ id: number }>('SELECT id FROM visitas WHERE nombre = ? AND salida > ? ORDER BY id DESC LIMIT 1', nombre, ahora - UNIR_VISITAS_MS)
      .toArray()[0]
    if (previa) {
      sql.exec('UPDATE visitas SET salida = NULL WHERE id = ?', previa.id)
      return previa.id
    }
    const { id } = sql.exec<{ id: number }>('INSERT INTO visitas (nombre, entrada) VALUES (?, ?) RETURNING id', nombre, ahora).one()
    sql.exec('DELETE FROM visitas WHERE id <= ?', id - MAX_VISITAS)
    return id
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const sessionId = url.searchParams.get('sessionId')
    if (!sessionId) return new Response('Falta sessionId', { status: 400 })

    if (this.estado !== 'abierta') {
      // Se acepta y se cierra con el código de tldraw sync: el cliente deja de reintentar y sabe por qué.
      // Sin obtenerSala: no se carga nada ni se escribe nada (webSocketClose sale enseguida).
      const { 0: cliente, 1: servidor } = new WebSocketPair()
      this.ctx.acceptWebSocket(servidor)
      servidor.close(TLSyncErrorCloseEventCode, MOTIVO_SALA_CERRADA)
      return new Response(null, { status: 101, webSocket: cliente })
    }

    // Anota el uso en el índice (para el gestor de la profe) sin demorar la conexión.
    const sala = url.pathname.split('/').pop() ?? ''
    this.ctx.waitUntil(
      this.env.INDICE.get(this.env.INDICE.idFromName('indice'))
        .registrar(sala)
        .catch(() => {})
    )

    const nombre = (url.searchParams.get('nombre') ?? '').trim().slice(0, 40) || 'Sin nombre'
    const { 0: cliente, 1: servidor } = new WebSocketPair()
    this.ctx.acceptWebSocket(servidor)
    const adjunto: Adjunto = { sessionId, snapshot: null, nombre, visita: this.abrirVisita(nombre) }
    servidor.serializeAttachment(adjunto)

    const room = this.obtenerSala()
    // Si el mismo cliente se reconecta, su socket viejo no debe ganarle al nuevo tras hibernar.
    for (const ws of this.ctx.getWebSockets()) {
      // (sin visita: esa ya la lleva el socket nuevo)
      if (ws !== servidor && leerAdjunto(ws)?.sessionId === sessionId) ws.serializeAttachment({ ...adjunto, visita: null })
    }
    this.sessionIdToWs.set(sessionId, servidor)
    room.handleSocketConnect({ sessionId, socket: servidor })
    return new Response(null, { status: 101, webSocket: cliente })
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (this.estado !== 'abierta') return
    const adjunto = leerAdjunto(ws)
    if (!adjunto) return
    this.obtenerSala().handleSocketMessage(adjunto.sessionId, message)
  }

  override async webSocketClose(ws: WebSocket) {
    this.terminarSocket(ws, 'handleSocketClose')
  }

  override async webSocketError(ws: WebSocket) {
    this.terminarSocket(ws, 'handleSocketError')
  }

  private terminarSocket(ws: WebSocket, metodo: 'handleSocketClose' | 'handleSocketError') {
    // Cerrada: los cierres que llegan después no deben volver a levantar la sala.
    if (this.estado !== 'abierta') return
    const adjunto = leerAdjunto(ws)
    if (!adjunto) return
    if (adjunto.visita !== null) {
      this.ctx.storage.sql.exec('UPDATE visitas SET salida = ? WHERE id = ? AND salida IS NULL', Date.now(), adjunto.visita)
    }
    if (this.sessionIdToWs.get(adjunto.sessionId) === ws) this.sessionIdToWs.delete(adjunto.sessionId)
    const room = this.obtenerSala()
    if (adjunto.snapshot && !room.getSessionSnapshot(adjunto.sessionId)) {
      room.handleSocketResume({ sessionId: adjunto.sessionId, socket: ws, snapshot: adjunto.snapshot })
    }
    room[metodo](adjunto.sessionId)
    // Si se fue el último, guardamos ya.
    if (this.ctx.getWebSockets().every((s) => s === ws)) this.guardar()
  }
}
