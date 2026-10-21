'use client'

import { HTMLContainer, type TLShape } from 'tldraw'
import { LabShapeUtil } from '@/components/LabShapeUtil'
import { matrizProps, matrizDefaults } from '@/shapes/schemas'
import { apply, det, isSingular, add, toSvg, formatEs, type Mat2 } from '@/lib/linear2d'

export type MatrizShape = TLShape<'matriz-2x2'>

type Coef = 'a' | 'b' | 'c' | 'd'
type Bandera = 'showGrid' | 'showDet'

const S = 400
const N = 5
const U = S / (2 * N)
const KS = Array.from({ length: 2 * N + 1 }, (_, i) => i - N)

const PRESETS: { nombre: string; m: Mat2 }[] = [
  { nombre: 'Identidad', m: { a: 1, b: 0, c: 0, d: 1 } },
  { nombre: 'Rotación 90°', m: { a: 0, b: -1, c: 1, d: 0 } },
  { nombre: 'Reflexión', m: { a: -1, b: 0, c: 0, d: 1 } },
  { nombre: 'Colapso', m: { a: 1, b: 2, c: 0.5, d: 1 } },
]

const SLIDERS: { clave: Coef; color: string }[] = [
  { clave: 'a', color: 'text-purple-300 accent-purple-500' },
  { clave: 'b', color: 'text-indigo-300 accent-indigo-500' },
  { clave: 'c', color: 'text-purple-300 accent-purple-500' },
  { clave: 'd', color: 'text-indigo-300 accent-indigo-500' },
]

export class MatrizShapeUtil extends LabShapeUtil<MatrizShape> {
  static override type = 'matriz-2x2' as const

  static override props = matrizProps

  override getDefaultProps(): MatrizShape['props'] {
    return { ...matrizDefaults }
  }

  override contenido(shape: MatrizShape) {
    const { a, b, c, d, showGrid, showDet } = shape.props
    const m: Mat2 = { a, b, c, d }
    const D = det(m)
    const singular = isSingular(m)
    const uid = shape.id.replace(/[^a-zA-Z0-9]/g, '')

    const actualizar = (props: Partial<MatrizShape['props']>) => {
      this.editor.updateShape<MatrizShape>({ id: shape.id, type: 'matriz-2x2', props })
    }

    const linea = (p: { x: number; y: number }, q: { x: number; y: number }) => {
      const P = toSvg(apply(m, p), U)
      const Q = toSvg(apply(m, q), U)
      return { x1: P.x, y1: P.y, x2: Q.x, y2: Q.y }
    }

    const ti = apply(m, { x: 1, y: 0 })
    const tj = apply(m, { x: 0, y: 1 })
    const poligono = [{ x: 0, y: 0 }, ti, add(ti, tj), tj]
      .map((v) => toSvg(v, U))
      .map((p) => `${p.x},${p.y}`)
      .join(' ')
    const fi = toSvg(ti, U)
    const fj = toSvg(tj, U)

    return (
      <HTMLContainer
        id={shape.id}
        style={{ pointerEvents: 'all' }}
        className="w-full h-full bg-zinc-950 border-2 border-purple-500/60 rounded-xl p-3 text-white shadow-2xl flex flex-col gap-2 select-none pointer-events-auto"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
          Transformación Lineal 2×2
        </span>

        <div className="flex-1 min-h-0 flex items-center justify-center">
          <svg
            viewBox={`${-S / 2} ${-S / 2} ${S} ${S}`}
            className="h-full aspect-square border border-zinc-800 rounded"
          >
            <defs>
              <clipPath id={`clip-${uid}`}>
                <rect x={-S / 2} y={-S / 2} width={S} height={S} />
              </clipPath>
              <marker id={`fi-${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" className="fill-purple-300" />
              </marker>
              <marker id={`fj-${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" className="fill-indigo-400" />
              </marker>
            </defs>

            <g clipPath={`url(#clip-${uid})`}>
              {/* (1) Grilla original */}
              {KS.map((k) => {
                const v = toSvg({ x: k, y: k }, U)
                return (
                  <g key={`o${k}`} className="stroke-zinc-700" strokeWidth={0.75}>
                    <line x1={v.x} y1={-S / 2} x2={v.x} y2={S / 2} />
                    <line x1={-S / 2} y1={v.y} x2={S / 2} y2={v.y} />
                  </g>
                )
              })}

              {/* (2) Grilla transformada */}
              {showGrid &&
                KS.map((k) => (
                  <g key={`t${k}`} className="stroke-violet-500" strokeOpacity={0.6} strokeWidth={1}>
                    <line {...linea({ x: k, y: -N }, { x: k, y: N })} />
                    <line {...linea({ x: -N, y: k }, { x: N, y: k })} />
                  </g>
                ))}

              {/* (3) Ejes transformados */}
              <g className="stroke-violet-300" strokeWidth={2}>
                <line {...linea({ x: -N, y: 0 }, { x: N, y: 0 })} />
                <line {...linea({ x: 0, y: -N }, { x: 0, y: N })} />
              </g>

              {/* (4) Área del determinante */}
              {showDet && (
                <polygon
                  points={poligono}
                  className={D < 0 ? 'fill-amber-500' : 'fill-fuchsia-500'}
                  fillOpacity={0.35}
                />
              )}

              {/* (5) Vectores base transformados */}
              <line x1={0} y1={0} x2={fi.x} y2={fi.y} className="stroke-purple-300" strokeWidth={3} markerEnd={`url(#fi-${uid})`} />
              <line x1={0} y1={0} x2={fj.x} y2={fj.y} className="stroke-indigo-400" strokeWidth={3} markerEnd={`url(#fj-${uid})`} />
            </g>
          </svg>
        </div>

        {/* Panel de lectura */}
        <div className="bg-zinc-900 text-white font-mono text-sm rounded-lg p-2 flex items-center gap-4 border border-zinc-800">
          <div className="flex items-center gap-1">
            <span className="text-2xl text-zinc-500">[</span>
            <div className="grid grid-cols-2 gap-x-3 text-center">
              <span className="text-purple-300">{formatEs(a)}</span>
              <span className="text-indigo-300">{formatEs(b)}</span>
              <span className="text-purple-300">{formatEs(c)}</span>
              <span className="text-indigo-300">{formatEs(d)}</span>
            </div>
            <span className="text-2xl text-zinc-500">]</span>
          </div>
          <div className="flex flex-col text-xs gap-0.5">
            <span className="text-fuchsia-300 font-bold">det = {formatEs(D)}</span>
            {D < 0 && <span className="text-amber-400">orientación invertida</span>}
            {singular && <span className="text-red-400">no invertible: el plano colapsa a una recta</span>}
          </div>
        </div>

        {/* Controles */}
        <div
          className="bg-zinc-900 p-2 rounded-lg border border-zinc-800 space-y-1.5 text-xs"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {SLIDERS.map(({ clave, color }) => (
              <label key={clave} className={`flex items-center justify-between gap-2 font-mono ${color}`}>
                {clave}: {formatEs(shape.props[clave])}
                <input
                  type="range"
                  min={-3}
                  max={3}
                  step={0.5}
                  value={shape.props[clave]}
                  onChange={(e) => actualizar({ [clave]: Number(e.target.value) })}
                  className="w-28 cursor-pointer"
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['showGrid', 'showDet'] as Bandera[]).map((clave) => (
              <label key={clave} className="flex items-center gap-1 text-zinc-300">
                <input
                  type="checkbox"
                  checked={shape.props[clave]}
                  onChange={(e) => actualizar({ [clave]: e.target.checked })}
                  className="accent-fuchsia-500 cursor-pointer"
                />
                {clave === 'showGrid' ? 'Grilla' : 'Det'}
              </label>
            ))}
            {PRESETS.map(({ nombre, m: p }) => (
              <button
                key={nombre}
                onClick={() => actualizar(p)}
                className="px-2 py-0.5 rounded-full bg-purple-600/80 hover:bg-purple-500 text-white cursor-pointer"
              >
                {nombre}
              </button>
            ))}
          </div>
        </div>
      </HTMLContainer>
    )
  }

  override indicator(shape: MatrizShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />
  }

  override getIndicatorPath(shape: MatrizShape): Path2D {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 12)
    return path
  }
}
