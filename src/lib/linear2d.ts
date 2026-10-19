export type Vec2 = { x: number; y: number }
export type Mat2 = { a: number; b: number; c: number; d: number }

const EPS = 1e-9

/** T(v) = (a·x + b·y, c·x + d·y) — convención por columnas */
export const apply = (m: Mat2, v: Vec2): Vec2 => ({
  x: m.a * v.x + m.b * v.y,
  y: m.c * v.x + m.d * v.y,
})

export const det = (m: Mat2): number => m.a * m.d - m.b * m.c

export const isSingular = (m: Mat2): boolean => Math.abs(det(m)) < EPS

export const add = (p: Vec2, q: Vec2): Vec2 => ({ x: p.x + q.x, y: p.y + q.y })

/** Plano cartesiano → SVG: escala u px/unidad e invierte el eje y */
export const toSvg = (v: Vec2, u: number): Vec2 => ({ x: v.x * u, y: -v.y * u })

/** Formato para el alumno: coma decimal, máx. 2 decimales */
export const formatEs = (n: number, dec = 2): string =>
  (Math.abs(n) < EPS ? 0 : n).toLocaleString('es-AR', { maximumFractionDigits: dec })