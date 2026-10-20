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
export function urlDeSincronizacion(sala: string): string {
  const base = process.env.NEXT_PUBLIC_SYNC_URL ?? window.location.origin.replace(/^http/, 'ws')
  return `${base}/api/connect/${sala}`
}
