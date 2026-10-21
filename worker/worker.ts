export { SalaDurableObject } from './SalaDurableObject'
export { IndiceSalas } from './IndiceSalas'

const RUTA_SALA = /^\/api\/connect\/([a-z0-9-]{1,40})$/
const RUTA_ACCION = /^\/api\/salas\/([a-z0-9-]{1,40})\/(abrir|clausurar|actividad)$/

// Bearer token: con next dev la web (puerto 3000) llama a wrangler dev (8787), por eso CORS abierto.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization',
}

function responder(cuerpo: unknown, status = 200): Response {
  return Response.json(cuerpo, { status, headers: CORS })
}

// Compara contra el secreto CLAVE_PROFE en tiempo constante (hash + timingSafeEqual).
async function esProfe(request: Request, env: Env): Promise<boolean> {
  const esperada = env.CLAVE_PROFE
  const dada = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? ''
  if (!esperada || !dada) return false
  const codificar = (t: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))
  const [a, b] = await Promise.all([codificar(dada), codificar(esperada)])
  return crypto.subtle.timingSafeEqual(a, b)
}

const indice = (env: Env) => env.INDICE.get(env.INDICE.idFromName('indice'))

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)

    const coincide = RUTA_SALA.exec(pathname)
    if (coincide) {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Se espera WebSocket', { status: 426 })
      // idFromName: todos los que abren la misma sala caen en el mismo Durable Object.
      // Ahí se decide si la sala existe (la creó la profe) o está clausurada.
      const sala = env.SALA.get(env.SALA.idFromName(coincide[1]))
      return sala.fetch(request)
    }

    if (!pathname.startsWith('/api/salas')) return new Response('No encontrado', { status: 404 })
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
    if (!(await esProfe(request, env))) return responder({ error: 'Clave de profe incorrecta' }, 401)

    if (pathname === '/api/salas' && request.method === 'GET') return responder(await indice(env).listar())

    const accion = RUTA_ACCION.exec(pathname)
    if (!accion) return responder({ error: 'Ruta no encontrada' }, 404)
    const [, nombre, verbo] = accion
    const sala = env.SALA.get(env.SALA.idFromName(nombre))

    if (verbo === 'actividad' && request.method === 'GET') return responder(await sala.actividad())

    if (verbo !== 'actividad' && request.method === 'POST') {
      const clausurada = verbo === 'clausurar'
      // Primero la sala (guarda su estado y, si clausura, corta a los conectados); después el índice.
      await (clausurada ? sala.clausurar() : sala.abrir())
      await indice(env).marcar(nombre, clausurada)
      return responder({ nombre, clausurada })
    }
    return responder({ error: 'Método no permitido' }, 405)
  },
} satisfies ExportedHandler<Env>
