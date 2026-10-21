// Motor 3D mínimo para SVG: proyección ortográfica, mallas y orden del pintor

export type Vec3 = { x: number; y: number; z: number }
export type Camara = { acimut: number; elevacion: number }
export type Cara = { pts: Vec3[]; color: string; opacidad?: number; borde?: string }
export type Dominio = { min: number; max: number }
type Fn2 = (x: number, y: number) => number

/**
 * Gira φ alrededor de z e inclina θ: X horizontal, Y vertical, prof crece hacia el observador.
 * Cámara en la dirección (−sen φ cos θ, −cos φ cos θ, sen θ): con φ = 0 mira de frente (x a la derecha, z arriba)
 * y con θ = π/2 desde arriba (x a la derecha, y arriba). La terna x, y, z se ve dextrógira.
 */
export function proyectar(p: Vec3, cam: Camara): { X: number; Y: number; prof: number } {
  const cf = Math.cos(cam.acimut)
  const sf = Math.sin(cam.acimut)
  const ct = Math.cos(cam.elevacion)
  const st = Math.sin(cam.elevacion)
  const u = p.x * cf - p.y * sf
  const v = p.x * sf + p.y * cf
  return { X: u, Y: p.z * ct + v * st, prof: p.z * st - v * ct }
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
export function ordenarPintor<C extends Cara>(caras: C[], cam: Camara): C[] {
  return caras
    .map((c) => ({ c, p: c.pts.reduce((s, q) => s + proyectar(q, cam).prof, 0) / c.pts.length }))
    .sort((a, b) => a.p - b.p)
    .map(({ c }) => c)
}

/** Marching squares: segmentos de las curvas f = nivel, apoyados en z = zPiso */
export function curvasNivel(
  f: Fn2,
  dom: Dominio,
  n: number,
  niveles: number[],
  zPiso: number,
  muestras?: number[][],
): [Vec3, Vec3][] {
  const h = (dom.max - dom.min) / n
  const val = muestras ?? muestrear(f, dom, n)
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
  const d = { x: -Math.sin(cam.acimut) * ct, y: -Math.cos(cam.acimut) * ct, z: Math.sin(cam.elevacion) }
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

// ── Cambio de variables (Lab 12) ──

/** Coordenadas curvilíneas (u, v, w), en el orden que hace positivo al Jacobiano */
export type Terna = [number, number, number]
export type Eje = 0 | 1 | 2

/** X(u, v, w) y sus derivadas parciales: columnas de la matriz Jacobiana */
export type Cambio = {
  X: (q: Terna) => Vec3
  columnas: (q: Terna) => [Vec3, Vec3, Vec3]
}

/** Quad de una cara de la celda: familia = coordenada fija; aristas = lados que caen en el borde de la cara */
export type CaraCelda = CaraConNormal & { familia: Eje; aristas: [Vec3, Vec3][] }

export const cruz = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

export const punto = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z

const EPS_NORMAL = 1e-9

/** (i, j, l) cíclico: ∂ⱼX × ∂ₗX apunta hacia donde crece la coordenada i (porque ∂ᵢX · (∂ⱼX × ∂ₗX) = det J > 0) */
const ciclo = (i: Eje): [Eje, Eje] => [((i + 1) % 3) as Eje, ((i + 2) % 3) as Eje]

/**
 * Celda curva X([q0, q0 + d]): 6 caras (coordenada i fija en q0ᵢ o q0ᵢ + dᵢ), cada una en k×k quads.
 * Normal exterior por quad: ±(∂ⱼX × ∂ₗX) en el centro del quad, + en la cara de arriba y − en la de abajo.
 * Si ese producto vectorial se anula (r = 0, ρ = 0, φ = 0 o π) la cara es una arista o un punto: se omite.
 */
export function carasCelda(c: Cambio, q0: Terna, d: Terna, k: number): CaraCelda[] {
  const caras: CaraCelda[] = []
  for (const i of [0, 1, 2] as const) {
    const [j, l] = ciclo(i)
    for (const extremo of [0, 1] as const) {
      const signo = extremo === 1 ? 1 : -1
      const terna = (sj: number, sl: number): Terna => {
        const q: Terna = [q0[0], q0[1], q0[2]]
        q[i] = q0[i] + extremo * d[i]
        q[j] = q0[j] + sj * d[j]
        q[l] = q0[l] + sl * d[l]
        return q
      }
      for (let a = 0; a < k; a++) {
        for (let b = 0; b < k; b++) {
          const cols = c.columnas(terna((a + 0.5) / k, (b + 0.5) / k))
          const n = cruz(cols[j], cols[l])
          const m = Math.hypot(n.x, n.y, n.z)
          if (m < EPS_NORMAL) continue
          const pts = [
            terna(a / k, b / k),
            terna((a + 1) / k, b / k),
            terna((a + 1) / k, (b + 1) / k),
            terna(a / k, (b + 1) / k),
          ].map(c.X)
          const aristas: [Vec3, Vec3][] = []
          if (b === 0) aristas.push([pts[0], pts[1]])
          if (a === k - 1) aristas.push([pts[1], pts[2]])
          if (b === k - 1) aristas.push([pts[2], pts[3]])
          if (a === 0) aristas.push([pts[3], pts[0]])
          caras.push({
            pts,
            normal: { x: (signo * n.x) / m, y: (signo * n.y) / m, z: (signo * n.z) / m },
            familia: i,
            aristas,
            color: '',
          })
        }
      }
    }
  }
  return caras
}

/** Superficie coordenada: la coordenada i fija en valor, las otras dos (en orden cíclico) recorren sus rangos */
export function superficieCoordenada(
  c: Cambio,
  i: Eje,
  valor: number,
  rangoJ: Dominio,
  rangoL: Dominio,
  nj: number,
  nl: number,
): CaraConNormal[] {
  const [j, l] = ciclo(i)
  const terna = (sj: number, sl: number): Terna => {
    const q: Terna = [0, 0, 0]
    q[i] = valor
    q[j] = rangoJ.min + sj * (rangoJ.max - rangoJ.min)
    q[l] = rangoL.min + sl * (rangoL.max - rangoL.min)
    return q
  }
  const caras: CaraConNormal[] = []
  for (let a = 0; a < nj; a++) {
    for (let b = 0; b < nl; b++) {
      const cols = c.columnas(terna((a + 0.5) / nj, (b + 0.5) / nl))
      const n = cruz(cols[j], cols[l])
      const m = Math.hypot(n.x, n.y, n.z)
      if (m < EPS_NORMAL) continue
      const pts = [terna(a / nj, b / nl), terna((a + 1) / nj, b / nl), terna((a + 1) / nj, (b + 1) / nl), terna(a / nj, (b + 1) / nl)].map(c.X)
      caras.push({ pts, normal: { x: n.x / m, y: n.y / m, z: n.z / m }, color: '' })
    }
  }
  return caras
}

/** Curva coordenada: solo la coordenada i varía de desde a hasta, las otras quedan como en q0 */
export function curvaCoordenada(c: Cambio, q0: Terna, i: Eje, desde: number, hasta: number, n = 32): Vec3[] {
  return Array.from({ length: n + 1 }, (_, s) => {
    const q: Terna = [q0[0], q0[1], q0[2]]
    q[i] = desde + ((hasta - desde) * s) / n
    return c.X(q)
  })
}

/** Paralelepípedo tangente P + Σ sᵢ·vᵢ con sᵢ ∈ [0, 1]: sus 12 aristas */
export function aristasParalelepipedo(P: Vec3, v: [Vec3, Vec3, Vec3]): [Vec3, Vec3][] {
  const V = (s0: number, s1: number, s2: number): Vec3 => ({
    x: P.x + s0 * v[0].x + s1 * v[1].x + s2 * v[2].x,
    y: P.y + s0 * v[0].y + s1 * v[1].y + s2 * v[2].y,
    z: P.z + s0 * v[0].z + s1 * v[1].z + s2 * v[2].z,
  })
  const aristas: [Vec3, Vec3][] = []
  for (const a of [0, 1]) {
    for (const b of [0, 1]) {
      aristas.push([V(0, a, b), V(1, a, b)], [V(a, 0, b), V(a, 1, b)], [V(a, b, 0), V(a, b, 1)])
    }
  }
  return aristas
}

/** Color base rgb oscurecido por el factor de sombra */
export const tono = (rgb: Terna, factor: number): string =>
  `rgb(${rgb.map((x) => Math.round(x * factor)).join(',')})`

// ── Graficador 3D: z = f(x, y) escrita por la persona ──

/** Matriz (n+1)×(n+1) de f sobre dom × dom: val[i][j] = f(min + iΔ, min + jΔ), con Δ = (max − min)/n */
export function muestrear(f: Fn2, dom: Dominio, n: number): number[][] {
  const paso = (dom.max - dom.min) / n
  return Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => f(dom.min + i * paso, dom.min + j * paso)),
  )
}

/**
 * Ventana en z: percentiles 2 % y 98 % de los valores finitos, para que un pico aislado (1/(x² + y²))
 * no aplaste el resto. Si el extremo real está cerca del percentil (no es un pico), se usa el real.
 * Margen de 5 % de cada lado. null si f no está definida en ningún nodo.
 */
export function ventanaZ(val: number[][]): Dominio | null {
  const z = val.flat().filter(Number.isFinite).sort((a, b) => a - b)
  if (z.length === 0) return null
  const percentil = (p: number) => z[Math.round(p * (z.length - 1))]
  const p2 = percentil(0.02)
  const p98 = percentil(0.98)
  const ancho = p98 - p2
  if (ancho < 1e-6) return { min: p2 - 1, max: p2 + 1 }
  const min = p2 - z[0] <= ancho / 2 ? z[0] : p2
  const max = z[z.length - 1] - p98 <= ancho / 2 ? z[z.length - 1] : p98
  const margen = 0.05 * (max - min)
  return { min: min - margen, max: max + margen }
}

/** Sutherland-Hodgman contra un plano z = c: se queda con los puntos donde dentro(z) */
function recortarPlano(pts: Vec3[], c: number, dentro: (z: number) => boolean): Vec3[] {
  const out: Vec3[] = []
  for (let k = 0; k < pts.length; k++) {
    const A = pts[k]
    const B = pts[(k + 1) % pts.length]
    if (dentro(A.z)) out.push(A)
    if (dentro(A.z) !== dentro(B.z)) {
      // El lado AB cruza el plano: t = (c − zA)/(zB − zA), P = A + t(B − A)
      const t = (c - A.z) / (B.z - A.z)
      out.push({ x: A.x + t * (B.x - A.x), y: A.y + t * (B.y - A.y), z: c })
    }
  }
  return out
}

/** Recorta un polígono a la franja zMin ≤ z ≤ zMax; [] si no queda nada */
export function recortarZ(pts: Vec3[], zMin: number, zMax: number): Vec3[] {
  const abajo = recortarPlano(pts, zMin, (z) => z >= zMin)
  if (abajo.length < 3) return []
  const arriba = recortarPlano(abajo, zMax, (z) => z <= zMax)
  return arriba.length < 3 ? [] : arriba
}

/**
 * Celdas de la malla de z = f(x, y) ya muestreada, recortadas a la ventana.
 * Descarta las celdas con algún vértice indefinido (cuenta cuántas en `indefinidas`)
 * y las que cruzan la ventana entera (un vértice arriba de zMax y otro abajo de zMin: asíntota).
 */
export function celdasExplicitas(
  val: number[][],
  dom: Dominio,
  ventana: Dominio,
): { celdas: Vec3[][]; indefinidas: number } {
  const n = val.length - 1
  const paso = (dom.max - dom.min) / n
  const celdas: Vec3[][] = []
  let indefinidas = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const xa = dom.min + i * paso
      const ya = dom.min + j * paso
      const pts: Vec3[] = [
        { x: xa, y: ya, z: val[i][j] },
        { x: xa + paso, y: ya, z: val[i + 1][j] },
        { x: xa + paso, y: ya + paso, z: val[i + 1][j + 1] },
        { x: xa, y: ya + paso, z: val[i][j + 1] },
      ]
      if (pts.some((q) => !Number.isFinite(q.z))) {
        indefinidas++
        continue
      }
      if (pts.some((q) => q.z > ventana.max) && pts.some((q) => q.z < ventana.min)) continue
      const recortada = recortarZ(pts, ventana.min, ventana.max)
      if (recortada.length) celdas.push(recortada)
    }
  }
  return { celdas, indefinidas }
}

/** Normal unitaria de un polígono plano o casi plano (método de Newell, sirve de 3 a 6 vértices) */
export function normalPoligono(pts: Vec3[]): Vec3 {
  let x = 0
  let y = 0
  let z = 0
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k]
    const b = pts[(k + 1) % pts.length]
    x += (a.y - b.y) * (a.z + b.z)
    y += (a.z - b.z) * (a.x + b.x)
    z += (a.x - b.x) * (a.y + b.y)
  }
  return normalizar({ x, y, z })
}
