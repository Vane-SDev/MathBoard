// Motor 3D mínimo para SVG: proyección ortográfica, mallas y orden del pintor

export type Vec3 = { x: number; y: number; z: number }
export type Camara = { acimut: number; elevacion: number }
export type Cara = { pts: Vec3[]; color: string; opacidad?: number; borde?: string }
export type Dominio = { min: number; max: number }
type Fn2 = (x: number, y: number) => number

/** Gira φ alrededor de z e inclina θ: X horizontal, Y vertical, prof crece hacia el observador */
export function proyectar(p: Vec3, cam: Camara): { X: number; Y: number; prof: number } {
  const cf = Math.cos(cam.acimut)
  const sf = Math.sin(cam.acimut)
  const ct = Math.cos(cam.elevacion)
  const st = Math.sin(cam.elevacion)
  const u = p.x * cf - p.y * sf
  const v = p.x * sf + p.y * cf
  return { X: u, Y: p.z * ct - v * st, prof: v * ct + p.z * st }
}

const normalizar = (v: Vec3): Vec3 => {
  const m = Math.hypot(v.x, v.y, v.z) || 1
  return { x: v.x / m, y: v.y / m, z: v.z / m }
}

export const normalSuperficie = (fx: number, fy: number): Vec3 => normalizar({ x: -fx, y: -fy, z: 1 })

const LUZ = normalizar({ x: -0.4, y: -0.5, z: 0.75 })

/** Factor de iluminación difusa en [0,45; 1] */
export function sombra(n: Vec3): number {
  const d = n.x * LUZ.x + n.y * LUZ.y + n.z * LUZ.z
  return 0.45 + 0.55 * Math.max(0, d)
}

const VIOLETA_700 = [109, 40, 217]
const FUCSIA_400 = [232, 121, 249]

/** violet-700 (abajo) → fuchsia-400 (arriba), oscurecido por factor */
export function colorAltura(z: number, zMin: number, zMax: number, factor: number): string {
  const t = Math.min(1, Math.max(0, (z - zMin) / (zMax - zMin || 1)))
  const [r, g, b] = VIOLETA_700.map((c, i) => Math.round((c + (FUCSIA_400[i] - c) * t) * factor))
  return `rgb(${r},${g},${b})`
}

/** Parche paramétrico p(s, t) con s, t ∈ [0, 1] en k×k caras */
export function parche(p: (s: number, t: number) => Vec3, k: number, color: string, opacidad?: number): Cara[] {
  const caras: Cara[] = []
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      const s0 = i / k
      const s1 = (i + 1) / k
      const t0 = j / k
      const t1 = (j + 1) / k
      caras.push({ pts: [p(s0, t0), p(s1, t0), p(s1, t1), p(s0, t1)], color, opacidad })
    }
  }
  return caras
}

/** Plano (o superficie) z(x, y) sobre [x0, x1]×[y0, y1] en k×k caras, para mezclar en el pintor */
export function planoSubdividido(
  z: Fn2,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  k: number,
  color: string,
  opacidad?: number,
): Cara[] {
  return parche(
    (s, t) => {
      const x = x0 + (x1 - x0) * s
      const y = y0 + (y1 - y0) * t
      return { x, y, z: z(x, y) }
    },
    k,
    color,
    opacidad,
  )
}

/** Malla n×n de z = f(x, y); colorear recibe la altura media y la normal del quad */
export function mallaSuperficie(f: Fn2, dom: Dominio, n: number, colorear: (z: number, normal: Vec3) => string): Cara[] {
  const h = (dom.max - dom.min) / n
  const caras: Cara[] = []
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const xa = dom.min + i * h
      const ya = dom.min + j * h
      const pts = [
        { x: xa, y: ya, z: f(xa, ya) },
        { x: xa + h, y: ya, z: f(xa + h, ya) },
        { x: xa + h, y: ya + h, z: f(xa + h, ya + h) },
        { x: xa, y: ya + h, z: f(xa, ya + h) },
      ]
      // Normal por producto vectorial de las diagonales
      const d1 = { x: pts[2].x - pts[0].x, y: pts[2].y - pts[0].y, z: pts[2].z - pts[0].z }
      const d2 = { x: pts[3].x - pts[1].x, y: pts[3].y - pts[1].y, z: pts[3].z - pts[1].z }
      const normal = normalizar({
        x: d1.y * d2.z - d1.z * d2.y,
        y: d1.z * d2.x - d1.x * d2.z,
        z: d1.x * d2.y - d1.y * d2.x,
      })
      const zMedio = (pts[0].z + pts[1].z + pts[2].z + pts[3].z) / 4
      caras.push({ pts, color: colorear(zMedio, normal) })
    }
  }
  return caras
}

/** Orden del pintor: primero lo más lejano (menor profundidad media) */
export function ordenarPintor(caras: Cara[], cam: Camara): Cara[] {
  return caras
    .map((c) => ({ c, p: c.pts.reduce((s, q) => s + proyectar(q, cam).prof, 0) / c.pts.length }))
    .sort((a, b) => a.p - b.p)
    .map(({ c }) => c)
}

/** Marching squares: segmentos de las curvas f = nivel, apoyados en z = zPiso */
export function curvasNivel(f: Fn2, dom: Dominio, n: number, niveles: number[], zPiso: number): [Vec3, Vec3][] {
  const h = (dom.max - dom.min) / n
  const val: number[][] = Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => f(dom.min + i * h, dom.min + j * h)),
  )
  const segs: [Vec3, Vec3][] = []
  for (const nivel of niveles) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const xa = dom.min + i * h
        const ya = dom.min + j * h
        // Esquinas en orden: (i,j) (i+1,j) (i+1,j+1) (i,j+1)
        const esq = [
          { x: xa, y: ya, v: val[i][j] },
          { x: xa + h, y: ya, v: val[i + 1][j] },
          { x: xa + h, y: ya + h, v: val[i + 1][j + 1] },
          { x: xa, y: ya + h, v: val[i][j + 1] },
        ]
        const cortes: Vec3[] = []
        for (let k = 0; k < 4; k++) {
          const A = esq[k]
          const B = esq[(k + 1) % 4]
          if (!Number.isFinite(A.v) || !Number.isFinite(B.v)) continue
          if (A.v < nivel === B.v < nivel) continue
          const t = (nivel - A.v) / (B.v - A.v)
          cortes.push({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, z: zPiso })
        }
        if (cortes.length >= 2) segs.push([cortes[0], cortes[1]])
        if (cortes.length === 4) segs.push([cortes[2], cortes[3]])
      }
    }
  }
  return segs
}

/** Simpson compuesto (n se lleva a par) */
export function simpson(g: (x: number) => number, a: number, b: number, n = 64): number {
  if (a === b) return 0
  const m = n % 2 === 0 ? n : n + 1
  const h = (b - a) / m
  let s = g(a) + g(b)
  for (let i = 1; i < m; i++) s += (i % 2 === 0 ? 2 : 4) * g(a + i * h)
  return (s * h) / 3
}

export type CaraConNormal = Cara & { normal: Vec3 }

/** Prisma [x0,x1]×[y0,y1]×[0,zTop]: tapa + 4 paredes, cada una con su normal exterior */
export function carasPrisma(x0: number, x1: number, y0: number, y1: number, zTop: number, color = '#a78bfa'): CaraConNormal[] {
  const P = (x: number, y: number, z: number): Vec3 => ({ x, y, z })
  return [
    { pts: [P(x0, y0, zTop), P(x1, y0, zTop), P(x1, y1, zTop), P(x0, y1, zTop)], normal: P(0, 0, 1), color },
    { pts: [P(x0, y0, 0), P(x0, y1, 0), P(x0, y1, zTop), P(x0, y0, zTop)], normal: P(-1, 0, 0), color },
    { pts: [P(x1, y0, 0), P(x1, y1, 0), P(x1, y1, zTop), P(x1, y0, zTop)], normal: P(1, 0, 0), color },
    { pts: [P(x0, y0, 0), P(x1, y0, 0), P(x1, y0, zTop), P(x0, y0, zTop)], normal: P(0, -1, 0), color },
    { pts: [P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, zTop), P(x0, y1, zTop)], normal: P(0, 1, 0), color },
  ]
}

/** ¿La normal apunta a la cámara? Mayor prof = más adelante (ver ordenarPintor) */
export function caraVisible(normal: Vec3, cam: Camara): boolean {
  const ct = Math.cos(cam.elevacion)
  const d = { x: Math.sin(cam.acimut) * ct, y: Math.cos(cam.acimut) * ct, z: Math.sin(cam.elevacion) }
  return normal.x * d.x + normal.y * d.y + normal.z * d.z > 0
}

export type Orden = 'dydx' | 'dxdy'

/** (u, w) → (x, y) según el orden de integración (u = variable externa) */
export const puntoRegion = (u: number, w: number, orden: Orden): { x: number; y: number } =>
  orden === 'dydx' ? { x: u, y: w } : { x: w, y: u }

/** z = f sobre la región u ∈ [a, b], w ∈ [desde(u), hasta(u)] en n×n quads */
export function mallaRegion(
  f: (x: number, y: number) => number,
  a: number,
  b: number,
  desde: (u: number) => number,
  hasta: (u: number) => number,
  orden: Orden,
  n: number,
  colorear: (z: number, normal: Vec3) => string,
): Cara[] {
  const punto = (i: number, j: number): Vec3 => {
    const u = a + ((b - a) * i) / n
    const s = j / n
    const { x, y } = puntoRegion(u, desde(u) + s * (hasta(u) - desde(u)), orden)
    return { x, y, z: f(x, y) }
  }
  const caras: Cara[] = []
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const pts = [punto(i, j), punto(i + 1, j), punto(i + 1, j + 1), punto(i, j + 1)]
      const d1 = { x: pts[2].x - pts[0].x, y: pts[2].y - pts[0].y, z: pts[2].z - pts[0].z }
      const d2 = { x: pts[3].x - pts[1].x, y: pts[3].y - pts[1].y, z: pts[3].z - pts[1].z }
      let normal = normalizar({
        x: d1.y * d2.z - d1.z * d2.y,
        y: d1.z * d2.x - d1.x * d2.z,
        z: d1.x * d2.y - d1.y * d2.x,
      })
      // El orden dxdy invierte la orientación: la normal siempre hacia arriba
      if (normal.z < 0) normal = { x: -normal.x, y: -normal.y, z: -normal.z }
      const zMedio = (pts[0].z + pts[1].z + pts[2].z + pts[3].z) / 4
      caras.push({ pts, color: colorear(zMedio, normal) })
    }
  }
  return caras
}

/** Feta vertical en u fijo: n cuadriláteros de z = 0 a z = f a lo largo de la variable interna */
export function paredFeta(
  f: (x: number, y: number) => number,
  u: number,
  desde: (u: number) => number,
  hasta: (u: number) => number,
  orden: Orden,
  n = 16,
  color = '#e879f9',
  opacidad = 0.85,
): Cara[] {
  const w0 = desde(u)
  const w1 = hasta(u)
  const base = (k: number) => puntoRegion(u, w0 + ((w1 - w0) * k) / n, orden)
  const caras: Cara[] = []
  for (let k = 0; k < n; k++) {
    const p = base(k)
    const q = base(k + 1)
    caras.push({
      pts: [
        { ...p, z: 0 },
        { ...q, z: 0 },
        { ...q, z: f(q.x, q.y) },
        { ...p, z: f(p.x, p.y) },
      ],
      color,
      opacidad,
    })
  }
  return caras
}
