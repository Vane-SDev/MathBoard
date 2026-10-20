// Sistemas de coordenadas del Lab 12: transformación, matriz Jacobiana, |J| y volumen exacto de la celda

import type { Cambio, Terna, Vec3 } from './surface3d'

export type SistemaCoordenadas = 'polares' | 'cilindricas' | 'esfericas'

export type Coordenadas = Cambio & {
  /** Nombres de (u, v, w) en el orden del Jacobiano positivo */
  nombres: [string, string, string]
  dim: 2 | 3
  /** Fórmulas de x, y, z para el panel */
  formulas: [string, string, string]
  /** |J| analítico y su fórmula */
  jac: (q: Terna) => number
  textoJ: string
  /** Factores de escala hᵢ = |∂X/∂qᵢ| (sistema ortogonal ⇒ |J| = h₁·h₂·h₃) */
  escalas: (q: Terna) => Terna
  /** Volumen (o área en polares) exacto de X([q0, q0 + d]) y la fórmula que lo calcula */
  exacto: (q0: Terna, d: Terna) => number
  textoExacto: string
}

const cs = Math.cos
const sn = Math.sin

/** (r, θ, z) → (r cos θ, r sen θ, z); en polares z queda en 0 */
const cilindrico = (q: Terna): Vec3 => ({ x: q[0] * cs(q[1]), y: q[0] * sn(q[1]), z: q[2] })
const columnasCilindricas = ([r, t]: Terna): [Vec3, Vec3, Vec3] => [
  { x: cs(t), y: sn(t), z: 0 },
  { x: -r * sn(t), y: r * cs(t), z: 0 },
  { x: 0, y: 0, z: 1 },
]
/** ∫ r dr de r a r + Δr = ((r + Δr)² − r²)/2 */
const anillo = (r: number, dr: number) => ((r + dr) ** 2 - r * r) / 2

export const SISTEMAS: Record<SistemaCoordenadas, Coordenadas> = {
  polares: {
    nombres: ['r', 'θ', 'z'],
    dim: 2,
    formulas: ['x = r cos θ', 'y = r sen θ', ''],
    X: (q) => cilindrico([q[0], q[1], 0]),
    columnas: columnasCilindricas,
    jac: ([r]) => r,
    textoJ: 'r',
    escalas: ([r]) => [1, r, 1],
    exacto: ([r], [dr, dt]) => anillo(r, dr) * dt,
    textoExacto: '[(r+Δr)² − r²]/2 · Δθ',
  },
  cilindricas: {
    nombres: ['r', 'θ', 'z'],
    dim: 3,
    formulas: ['x = r cos θ', 'y = r sen θ', 'z = z'],
    X: cilindrico,
    columnas: columnasCilindricas,
    jac: ([r]) => r,
    textoJ: 'r',
    escalas: ([r]) => [1, r, 1],
    exacto: ([r], [dr, dt, dz]) => anillo(r, dr) * dt * dz,
    textoExacto: '[(r+Δr)² − r²]/2 · Δθ · Δz',
  },
  // Orden (ρ, φ, θ): det J = +ρ² sen φ. Con (ρ, θ, φ) daría −ρ² sen φ (mismo |J|)
  esfericas: {
    nombres: ['ρ', 'φ', 'θ'],
    dim: 3,
    formulas: ['x = ρ sen φ cos θ', 'y = ρ sen φ sen θ', 'z = ρ cos φ'],
    X: ([p, f, t]) => ({ x: p * sn(f) * cs(t), y: p * sn(f) * sn(t), z: p * cs(f) }),
    columnas: ([p, f, t]) => [
      { x: sn(f) * cs(t), y: sn(f) * sn(t), z: cs(f) },
      { x: p * cs(f) * cs(t), y: p * cs(f) * sn(t), z: -p * sn(f) },
      { x: -p * sn(f) * sn(t), y: p * sn(f) * cs(t), z: 0 },
    ],
    jac: ([p, f]) => p * p * sn(f),
    textoJ: 'ρ² sen φ',
    escalas: ([p, f]) => [1, p, p * sn(f)],
    exacto: ([p, f], [dp, df, dt]) => (((p + dp) ** 3 - p ** 3) / 3) * (cs(f) - cs(f + df)) * dt,
    textoExacto: '[(ρ+Δρ)³ − ρ³]/3 · [cos φ − cos(φ+Δφ)] · Δθ',
  },
}
