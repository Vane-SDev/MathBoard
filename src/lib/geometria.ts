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
