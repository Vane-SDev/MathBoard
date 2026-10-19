import { toSvg, type Vec2 } from './linear2d'


export type Fn = (x: number) => number
export type Ventana = { xMin: number; xMax: number; yMin: number; yMax: number }

// Redondea v a la grilla de `paso` (anclada en 0) o lo pega a un imán cercano
export function ajustar(v: number, paso: number, imanes: readonly number[] = []): number {
  const tol = paso * 0.75
  for (const p of imanes) if (Math.abs(v - p) <= tol) return p
  return Math.round(v / paso) * paso
}


/** Muestrea f cortando el trazo en los breaks, en valores no finitos y fuera de rango */
export function samplePaths(f: Fn, v: Ventana, breaks: number[], u: number, n = 400): string[] {
  const cortes = [v.xMin, ...breaks.filter((b) => b > v.xMin && b < v.xMax).sort((a, b) => a - b), v.xMax]
  const margen = (v.yMax - v.yMin) * 2
  const paths: string[] = []
  for (let i = 0; i < cortes.length - 1; i++) {
    const x0 = cortes[i] + 1e-6
    const x1 = cortes[i + 1] - 1e-6
    const pasos = Math.max(2, Math.ceil((n * (x1 - x0)) / (v.xMax - v.xMin)))
    let d = ''
    for (let k = 0; k <= pasos; k++) {
      const x = x0 + ((x1 - x0) * k) / pasos
      const y = f(x)
      if (!Number.isFinite(y) || y > v.yMax + margen || y < v.yMin - margen) {
        if (d) paths.push(d)
        d = ''
        continue
      }
      const p = toSvg({ x, y }, u)
      d += `${d ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`
    }
    if (d) paths.push(d)
  }
  return paths
}

/** ¿f((c−δ, c+δ) \ {c}) ⊂ (L−ε, L+ε)? Verificación por muestreo */
export function deltaFunciona(f: Fn, c: number, L: number, eps: number, delta: number, n = 200): boolean {
  for (let k = 1; k <= n; k++) {
    const t = (delta * k) / (n + 1)
    for (const x of [c - t, c + t]) {
      const y = f(x)
      if (!Number.isFinite(y) || Math.abs(y - L) >= eps) return false
    }
  }
  return true
}

export type Metodo = 'izquierda' | 'derecha' | 'medio' | 'trapecio'
export type Franja = { x0: number; x1: number; y0: number; y1: number }

/** Suma de Riemann: devuelve las franjas a dibujar y Sₙ = Σ ((y₀+y₁)/2)·Δx */
export function riemann(f: Fn, a: number, b: number, n: number, m: Metodo): { franjas: Franja[]; suma: number } {
  const dx = (b - a) / n
  const franjas: Franja[] = []
  let suma = 0
  for (let i = 0; i < n; i++) {
    const x0 = a + i * dx
    const x1 = x0 + dx
    let y0: number
    let y1: number
    if (m === 'trapecio') {
      y0 = f(x0)
      y1 = f(x1)
    } else {
      const xi = m === 'izquierda' ? x0 : m === 'derecha' ? x1 : (x0 + x1) / 2
      y0 = y1 = f(xi)
    }
    franjas.push({ x0, x1, y0, y1 })
    suma += ((y0 + y1) / 2) * dx
  }
  return { franjas, suma }
}

export type FnPolar = (t: number) => number
export type TramoPolar = { d: string; negativo: boolean }
export type Sector = { t0: number; t1: number; rad: number }

const p2 = (n: number) => n.toFixed(2)

/** (r, θ) → SVG. Si r < 0 el punto cae solo en θ + π */
export const polar = (r: number, t: number, u: number) =>
  toSvg({ x: r * Math.cos(t), y: r * Math.sin(t) }, u)

/** Traza r(θ) en [t0, t1] cortando en cada cambio de signo de r (pasando por el polo) */
export function samplePolarPaths(r: FnPolar, t0: number, t1: number, u: number, n = 600): TramoPolar[] {
  const tramos: TramoPolar[] = []
  if (t1 <= t0) return tramos
  let d = ''
  let neg: boolean | null = null
  for (let k = 0; k <= n; k++) {
    const t = t0 + ((t1 - t0) * k) / n
    const rt = r(t)
    const esNeg = rt < 0
    if (neg !== null && esNeg !== neg) {
      tramos.push({ d: d + 'L0,0', negativo: neg })
      d = 'M0,0'
    }
    const p = polar(rt, t, u)
    d += `${d ? 'L' : 'M'}${p2(p.x)},${p2(p.y)}`
    neg = esNeg
  }
  tramos.push({ d, negativo: neg === true })
  return tramos
}

/** Sₙ = Σ ½·r(θᵢ*)²·Δθ con θᵢ* punto medio */
export function riemannPolar(r: FnPolar, a: number, b: number, n: number): { sectores: Sector[]; suma: number } {
  const dt = (b - a) / n
  const sectores: Sector[] = []
  let suma = 0
  for (let i = 0; i < n; i++) {
    const t0 = a + i * dt
    const t1 = t0 + dt
    const rad = r((t0 + t1) / 2)
    sectores.push({ t0, t1, rad })
    suma += 0.5 * rad * rad * dt
  }
  return { sectores, suma }
}

/** Cuña: origen → arco de radio |r| entre t0 y t1 (sweep 0 = antihorario con y invertida) */
export function sectorPath(s: Sector, u: number): string {
  const a = polar(s.rad, s.t0, u)
  const b = polar(s.rad, s.t1, u)
  const R = p2(Math.abs(s.rad) * u)
  return `M0,0 L${p2(a.x)},${p2(a.y)} A${R},${R} 0 0 0 ${p2(b.x)},${p2(b.y)} Z`
}

/** Recta y = y0 + m·(x − x0) de borde a borde de la ventana (el clipPath recorta en y) */
export function rectaVentana(x0: number, y0: number, m: number, v: Ventana): [Vec2, Vec2] {
  return [
    { x: v.xMin, y: y0 + m * (v.xMin - x0) },
    { x: v.xMax, y: y0 + m * (v.xMax - x0) },
  ]
}


export function acotar(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/** Mayor δ ∈ [0,005, dMax] que cumple ε-δ (bisección); null si ni el mínimo funciona */
export function deltaMaximo(f: Fn, c: number, L: number, epsilon: number, dMax: number): number | null {
  if (!deltaFunciona(f, c, L, epsilon, 0.005)) return null
  if (deltaFunciona(f, c, L, epsilon, dMax)) return dMax
  let lo = 0.005
  let hi = dMax
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (deltaFunciona(f, c, L, epsilon, mid)) lo = mid
    else hi = mid
  }
  return lo
}

/** Curva paramétrica (fx(t), fy(t)) para t ∈ [t0, t1]; corta el trazo en puntos no finitos */
export function pathParametrico(fx: Fn, fy: Fn, t0: number, t1: number, u: number, n = 200): string {
  let d = ''
  let corte = true
  for (let k = 0; k <= n; k++) {
    const t = t0 + ((t1 - t0) * k) / n
    const x = fx(t)
    const y = fy(t)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      corte = true
      continue
    }
    const p = toSvg({ x, y }, u)
    d += `${corte ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`
    corte = false
  }
  return d
}
