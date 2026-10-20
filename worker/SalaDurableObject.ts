import { InMemorySyncStorage, type RoomSnapshot, type SessionStateSnapshot, TLSocketRoom } from '@tldraw/sync-core'
import { createTLSchema, defaultBindingSchemas, defaultShapeSchemas, type TLRecord } from '@tldraw/tlschema'
import { DurableObject } from 'cloudflare:workers'
import { LAB_SCHEMAS } from '../src/shapes/schemas'

// El servidor valida cada cambio con el mismo contrato que usan los ShapeUtil.
const schema = createTLSchema({
  shapes: { ...defaultShapeSchemas, ...LAB_SCHEMAS },
  bindings: { ...defaultBindingSchemas },
})

// Cada cuánto se pasa a SQLite lo que cambió. El plan gratis permite 100.000 filas escritas por día:
// guardar en cada envío (hasta 30 por segundo) lo agotaría en minutos.
const GUARDAR_CADA_MS = 5000

interface Adjunto {
  sessionId: string
  snapshot: SessionStateSnapshot | null
}

function leerAdjunto(ws: WebSocket): Adjunto | null {
  const adjunto = ws.deserializeAttachment() as Adjunto | null
  return adjunto?.sessionId ? adjunto : null
}

type FilaRegistro = { id: string; estado: string; reloj: number }
type FilaMeta = { clave: string; valor: string }

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

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // El cliente manda un ping cada 5 s: Cloudflare lo contesta sin despertar al objeto.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}'))
    const sql = this.ctx.storage.sql
    sql.exec('CREATE TABLE IF NOT EXISTS registros (id TEXT PRIMARY KEY, estado TEXT NOT NULL, reloj INTEGER NOT NULL)')
    sql.exec('CREATE TABLE IF NOT EXISTS meta (clave TEXT PRIMARY KEY, valor TEXT NOT NULL)')
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
          this.sessionIdToWs.get(sessionId)?.serializeAttachment({ sessionId, snapshot })
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

  override async fetch(request: Request): Promise<Response> {
    const sessionId = new URL(request.url).searchParams.get('sessionId')
    if (!sessionId) return new Response('Falta sessionId', { status: 400 })

    const { 0: cliente, 1: servidor } = new WebSocketPair()
    this.ctx.acceptWebSocket(servidor)
    const adjunto: Adjunto = { sessionId, snapshot: null }
    servidor.serializeAttachment(adjunto)

    const room = this.obtenerSala()
    // Si el mismo cliente se reconecta, su socket viejo no debe ganarle al nuevo tras hibernar.
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== servidor && leerAdjunto(ws)?.sessionId === sessionId) ws.serializeAttachment(adjunto)
    }
    this.sessionIdToWs.set(sessionId, servidor)
    room.handleSocketConnect({ sessionId, socket: servidor })
    return new Response(null, { status: 101, webSocket: cliente })
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
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
    const adjunto = leerAdjunto(ws)
    if (!adjunto) return
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
