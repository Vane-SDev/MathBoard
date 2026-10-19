import { formatEs } from './linear2d'

const PI = Math.PI
const EPS = 1e-9

/** Ángulos notables en [0, 2π]: múltiplos de π/6 y de π/4 */
export const NOTABLES: number[] = [
  ...Array.from({ length: 13 }, (_, k) => (k * PI) / 6),
  PI / 4,
  (3 * PI) / 4,
  (5 * PI) / 4,
  (7 * PI) / 4,
].sort((a, b) => a - b)

const mcd = (a: number, b: number): number => (b === 0 ? a : mcd(b, a % b))

/** x como fracción de π en doceavos ("5π/4", "−π/3"); si no lo es, decimal */
export function fraccionPi(x: number): string {
  const k = Math.round((12 * x) / PI)
  if (Math.abs(x - (k * PI) / 12) > EPS) return formatEs(x)
  if (k === 0) return '0'
  const g = mcd(Math.abs(k), 12)
  const num = Math.abs(k) / g
  const den = 12 / g
  return `${k < 0 ? '−' : ''}${num === 1 ? '' : num}π${den === 1 ? '' : `/${den}`}`
}

export type Exactos = {
  sen: string
  cos: string
  tan: string
  grados: number
  cuadrante: 'I' | 'II' | 'III' | 'IV' | 'eje'
}

const REFS = [0, 30, 45, 60, 90]
const SEN = ['0', '1/2', '√2/2', '√3/2', '1']
const COS = ['1', '√3/2', '√2/2', '1/2', '0']
const TAN = ['0', '√3/3', '1', '√3', 'no existe']

const conSigno = (valor: number, abs: string): string =>
  Math.abs(valor) < EPS ? '0' : `${valor < 0 ? '−' : ''}${abs}`

/** Valores exactos de sen, cos y tan si θ es un ángulo notable */
export function exactos(theta: number): Exactos | null {
  if (!NOTABLES.some((n) => Math.abs(theta - n) < EPS)) return null
  const grados = Math.round((theta * 180) / PI)
  const ref = grados <= 90 ? grados : grados <= 180 ? 180 - grados : grados <= 270 ? grados - 180 : 360 - grados
  const i = REFS.indexOf(ref)
  const s = Math.sin(theta)
  const c = Math.cos(theta)
  const cuadrante =
    grados % 90 === 0 ? 'eje' : grados < 90 ? 'I' : grados < 180 ? 'II' : grados < 270 ? 'III' : 'IV'
  return {
    sen: conSigno(s, SEN[i]),
    cos: conSigno(c, COS[i]),
    tan: Math.abs(c) < EPS ? 'no existe' : conSigno(s / c, TAN[i]),
    grados,
    cuadrante,
  }
}
