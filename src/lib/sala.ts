// Salas por URL: ?sala=nombre. Mismo formato que acepta el Worker: a-z, 0-9 y guiones, hasta 40.
export const SALA_POR_DEFECTO = 'general'

export function normalizarSala(texto: string | null): string {
  const limpia = (texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return limpia || SALA_POR_DEFECTO
}

export function salaDeLaUrl(): string {
  return normalizarSala(new URLSearchParams(window.location.search).get('sala'))
}

export function linkDeSala(sala: string): string {
  return `${window.location.origin}${window.location.pathname}?sala=${sala}`
}

// En producción el Worker sirve la web y el WebSocket en el mismo dominio.
// En desarrollo con `next dev`, NEXT_PUBLIC_SYNC_URL apunta a `wrangler dev` (ws://localhost:8787).
// El nombre viaja para el registro de visitas que ve la profe.
export function urlDeSincronizacion(sala: string, nombre: string): string {
  const base = process.env.NEXT_PUBLIC_SYNC_URL ?? window.location.origin.replace(/^http/, 'ws')
  return `${base}/api/connect/${sala}?nombre=${encodeURIComponent(nombre)}`
}

// Últimas salas visitadas (solo en este navegador), la más reciente primero.
const CLAVE_RECIENTES = 'mathboard-salas-recientes'
const MAX_RECIENTES = 12

export function salasRecientes(): string[] {
  try {
    const guardadas: unknown = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) ?? '[]')
    return Array.isArray(guardadas) ? guardadas.filter((s): s is string => typeof s === 'string') : []
  } catch {
    return []
  }
}

export function recordarSala(sala: string): string[] {
  const lista = [sala, ...salasRecientes().filter((s) => s !== sala)].slice(0, MAX_RECIENTES)
  try {
    localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(lista))
  } catch {
    // Sin localStorage (modo privado estricto): la lista vive solo en esta pestaña.
  }
  return lista
}

// "Juan Pérez" → "juan-perez-k7p2": el sufijo al azar hace que el link no se pueda adivinar.
export function nombreDeSalaNueva(nombre: string): string {
  const sufijo = Math.random().toString(36).slice(2, 6).padEnd(4, '0')
  return normalizarSala(`${normalizarSala(nombre).slice(0, 35)}-${sufijo}`)
}

export function irASala(sala: string) {
  window.location.search = `?sala=${sala}`
}
