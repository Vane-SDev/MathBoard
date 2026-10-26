// Escala real del kit de geometría. Sin React: la usan los shapes, el compás y schemas.ts (Worker).

/** 1 cm = 48 unidades de la hoja: cada cuadradito del cuaderno (24) mide medio centímetro, como en papel. */
export const PX_POR_CM = 48
export const PX_POR_MM = PX_POR_CM / 10

/** Centímetros a partir de una distancia en la hoja */
export const cmDesdePx = (px: number): number => px / PX_POR_CM

/** Redondea una distancia en la hoja al milímetro entero más cercano */
export const redondearAMm = (px: number): number => Math.round(px / PX_POR_MM) * PX_POR_MM

// ── Regla ──
export const LONGITUDES_REGLA = [10, 15, 20, 30] as const
/** Margen antes del 0 y después de la última marca (medio centímetro) */
export const MARGEN_REGLA = PX_POR_CM / 2
/** Ancho de la regla: 2,5 cm */
export const ALTO_REGLA = 120

export const anchoRegla = (longitud: number): number => longitud * PX_POR_CM + 2 * MARGEN_REGLA

// ── Transportador ──
/** Radio de la escala: 5 cm (10 cm de diámetro, como el de la cartuchera) */
export const RADIO_TRANSPORTADOR = 5 * PX_POR_CM
/** Franja recta debajo del centro en el semicírculo */
export const BASE_TRANSPORTADOR = 36

/**
 * Caja del transportador y su centro. El centro queda en el mismo lugar en las dos versiones.
 * La caja coincide justo con el contorno: tldraw dimensiona el shape con los límites de getGeometry.
 */
export function medidasTransportador(completo: boolean): { w: number; h: number; cx: number; cy: number } {
  const r = RADIO_TRANSPORTADOR
  return { w: 2 * r, h: completo ? 2 * r : r + BASE_TRANSPORTADOR, cx: r, cy: r }
}

/** Punto a `r` del centro en la dirección de `grados` (0° a la derecha, antihorario), en coordenadas SVG (y hacia abajo) */
export function polarSvg(cx: number, cy: number, r: number, grados: number): { x: number; y: number } {
  const a = (grados * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) }
}

// ── Escuadra ──
export type AngulosEscuadra = '45' | '30-60'

/**
 * Catetos de la escuadra. El ángulo recto queda abajo a la izquierda de la caja: (0, h).
 * 45°: 12 cm y 12 cm. 30°-60°: 8 cm de alto y 8·√3 ≈ 13,86 cm de base (30° abajo a la derecha, 60° arriba).
 */
export function medidasEscuadra(angulos: AngulosEscuadra): { w: number; h: number } {
  if (angulos === '45') return { w: 12 * PX_POR_CM, h: 12 * PX_POR_CM }
  return { w: 8 * Math.sqrt(3) * PX_POR_CM, h: 8 * PX_POR_CM }
}

// ── Compás ──
type Punto = { x: number; y: number }

/**
 * Piezas del compás dibujado "de frente", en coordenadas locales con la aguja en (0, 0).
 * û = (cos θ, sen θ) apunta al lápiz; n̂ = (sen θ, −cos θ) es su normal (con y hacia abajo, en θ = 0 apunta para arriba).
 * Las patas miden L, así que la bisagra H está sobre la mediatriz de la cuerda aguja–lápiz:
 *   P = r·û,  M = P/2,  d = √(L² − (r/2)²),  H = M + d·n̂.
 * L = máx(4 cm; 0,6·r): con r chico las patas casi se juntan y con r grande nunca quedan chatas (d ≥ 0,33·r).
 */
export function piezasCompas(r: number, angulo: number): { L: number; lapiz: Punto; bisagra: Punto; mango: Punto } {
  const L = Math.max(4 * PX_POR_CM, 0.6 * r)
  const u = { x: Math.cos(angulo), y: Math.sin(angulo) }
  const n = { x: Math.sin(angulo), y: -Math.cos(angulo) }
  const d = Math.sqrt(L * L - (r / 2) ** 2)
  const bisagra = { x: (r / 2) * u.x + d * n.x, y: (r / 2) * u.y + d * n.y }
  return {
    L,
    lapiz: { x: r * u.x, y: r * u.y },
    bisagra,
    mango: { x: bisagra.x + 0.25 * L * n.x, y: bisagra.y + 0.25 * L * n.y },
  }
}
