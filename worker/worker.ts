export { SalaDurableObject } from './SalaDurableObject'

const RUTA_SALA = /^\/api\/connect\/([a-z0-9-]{1,40})$/

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    const coincide = RUTA_SALA.exec(pathname)
    if (!coincide) return new Response('No encontrado', { status: 404 })
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Se espera WebSocket', { status: 426 })
    // idFromName: todos los que abren la misma sala caen en el mismo Durable Object.
    const sala = env.SALA.get(env.SALA.idFromName(coincide[1]))
    return sala.fetch(request)
  },
} satisfies ExportedHandler<Env>
