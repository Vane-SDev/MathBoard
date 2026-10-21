import { TLRemoteSyncError } from '@tldraw/sync'
import { MOTIVO_SALA_CERRADA, type Actividad, type InfoSala } from '@/lib/clausura'

// La clave de profe se pide una vez y queda en este navegador. El Worker la valida en cada pedido.
const CLAVE_PROFE = 'mathboard-clave-profe'

export function claveGuardada(): string {
  try {
    return localStorage.getItem(CLAVE_PROFE) ?? ''
  } catch {
    return ''
  }
}

export function guardarClave(clave: string) {
  try {
    if (clave) localStorage.setItem(CLAVE_PROFE, clave)
    else localStorage.removeItem(CLAVE_PROFE)
  } catch {
    // Sin localStorage: la clave vive solo mientras el modal esté abierto.
  }
}

export class ClaveIncorrecta extends Error {}

// Mismo origen en producción; con next dev, el http de NEXT_PUBLIC_SYNC_URL (wrangler dev).
function baseApi(): string {
  return (process.env.NEXT_PUBLIC_SYNC_URL ?? '').replace(/^ws/, 'http')
}

async function pedir(ruta: string, method: 'GET' | 'POST', clave: string): Promise<Response> {
  const respuesta = await fetch(`${baseApi()}/api/salas${ruta}`, { method, headers: { Authorization: `Bearer ${clave}` } })
  if (respuesta.status === 401) throw new ClaveIncorrecta('Clave de profe incorrecta')
  if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}`)
  return respuesta
}

export async function listarSalas(clave: string): Promise<InfoSala[]> {
  return (await (await pedir('', 'GET', clave)).json()) as InfoSala[]
}

// abrir = crear (o reabrir) la sala; clausurar = cerrarla para siempre (se puede reabrir).
export async function cambiarEstado(sala: string, accion: 'abrir' | 'clausurar', clave: string): Promise<void> {
  await pedir(`/${sala}/${accion}`, 'POST', clave)
}

export async function verActividad(sala: string, clave: string): Promise<Actividad> {
  return (await (await pedir(`/${sala}/actividad`, 'GET', clave)).json()) as Actividad
}

// El servidor cerró el WebSocket porque la sala no existe o está clausurada (y no por un corte de red).
export function esSalaCerrada(error: Error): boolean {
  return error instanceof TLRemoteSyncError && error.reason === MOTIVO_SALA_CERRADA
}
