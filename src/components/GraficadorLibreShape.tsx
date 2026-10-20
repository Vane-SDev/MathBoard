'use client'

import { useMemo } from 'react'
import { BaseBoxShapeUtil, HTMLContainer, RecordProps, T, TLBaseShape } from 'tldraw'
import { pasoLindo, raicesNumericas, samplePaths, type Ventana } from '@/lib/plot'
import { toSvg, formatEs } from '@/lib/linear2d'
import { parsear, type Parseo } from '@/lib/parser'

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    'graficador-libre': {
      w: number
      h: number
      exprF: string
      exprG: string
      verG: boolean
      verNotables: boolean
      ox: number
      oy: number
      escala: number
    }
  }
}

export type GraficadorLibreShape = TLBaseShape<
  'graficador-libre',
  {
    w: number
    h: number
    exprF: string
    exprG: string
    verG: boolean
    verNotables: boolean
    ox: number
    oy: number
    escala: number
  }
>

type Props = GraficadorLibreShape['props']
type Bandera = 'verG' | 'verNotables'

const ANCHO = 600
const CHECKS: { clave: Bandera; label: string }[] = [
  { clave: 'verG', label: 'g(x)' },
  { clave: 'verNotables', label: 'Puntos notables' },
]
const AYUDA = 'Usá ^ para potencias, sen cos tg ln raiz abs, pi. Ej: 2sen(x), raiz(x+2)/(x-1)'

const frenar = (e: { stopPropagation: () => void }) => e.stopPropagation()

const multiplos = (lo: number, hi: number, paso: number) =>
  Array.from({ length: Math.max(0, Math.floor(hi / paso) - Math.ceil(lo / paso) + 1) }, (_, i) => (Math.ceil(lo / paso) + i) * paso)

function Graficador({ id, props, actualizar }: { id: string; props: Props; actualizar: (p: Partial<Props>) => void }) {
  const { exprF, exprG, verG, verNotables, ox, oy, escala } = props
  const v: Ventana = { xMin: ox - escala, xMax: ox + escala, yMin: oy - 0.75 * escala, yMax: oy + 0.75 * escala }
  const u = ANCHO / (2 * escala)
  const uid = id.replace(/[^a-zA-Z0-9]/g, '')

  const pf = useMemo(() => parsear(exprF), [exprF])
  const pg = useMemo(() => parsear(exprG), [exprG])
  const f = pf.ok ? pf.f : null
  const g = pg.ok && verG ? pg.f : null

  const notables = useMemo(() => {
    if (!f) return null
    const raices = raicesNumericas(f, ox - escala, ox + escala)
    const f0 = f(0)
    const ordenada = ox - escala <= 0 && 0 <= ox + escala && Number.isFinite(f0) ? f0 : null
    const cortes = g ? raicesNumericas((x) => f(x) - g(x), ox - escala, ox + escala) : []
    return { raices, ordenada, cortes }
  }, [f, g, ox, escala])

  const boton = (activo: boolean) =>
    `px-2 py-0.5 rounded-full text-white cursor-pointer ${activo ? 'bg-fuchsia-600' : 'bg-purple-600/80 hover:bg-purple-500'}`

  const S = (x: number, y: number) => toSvg({ x, y }, u)

  const bx = v.xMin * u
  const by = -v.yMax * u
  const bw = (v.xMax - v.xMin) * u
  const bh = (v.yMax - v.yMin) * u

  const paso = pasoLindo(2 * escala)
  const gx = multiplos(v.xMin, v.xMax, paso)
  const gy = multiplos(v.yMin, v.yMax, paso)
  // Etiquetas pegadas al eje, o al borde si el eje queda fuera de la ventana
  const yEtiq = Math.min(Math.max(0, by + 14), by + bh - 4)
  const xEtiq = Math.min(Math.max(0, bx + 4), bx + bw - 30)

  const zoom = (k: number) => actualizar({ escala: Math.min(64, Math.max(0.25, escala * k)) })
  const mover = (dx: number, dy: number) => actualizar({ ox: ox + (dx * escala) / 2, oy: oy + (dy * escala) / 2 })

  const campo = (etiqueta: string, valor: string, p: Parseo, clave: 'exprF' | 'exprG', color: string) => (
    <div className="flex flex-col gap-0.5">
      <label className={`flex items-center gap-2 font-mono ${color}`}>
        <span className="w-10 shrink-0 whitespace-nowrap">{etiqueta}</span>
        <input
          type="text"
          value={valor}
          spellCheck={false}
          onChange={(e) => actualizar({ [clave]: e.target.value })}
          onKeyDown={frenar}
          onKeyUp={frenar}
          className={`flex-1 min-w-0 bg-zinc-950 text-white font-mono px-2 py-1 rounded border outline-none ${
            p.ok ? 'border-zinc-700 focus:border-purple-500' : 'border-red-500'
          }`}
        />
      </label>
      {!p.ok && (
        <span className="ml-12 text-red-400 font-mono">
          {p.error} (posición {p.pos + 1})
        </span>
      )}
    </div>
  )

  const lista = (xs: number[]) => (xs.length ? xs.map((x) => formatEs(x, 4)).join(' · ') : 'ninguna')

  return (
    <HTMLContainer
      id={id}
      style={{ pointerEvents: 'all' }}
      className="w-full h-full bg-zinc-950 border-2 border-purple-500/60 rounded-xl p-3 text-white shadow-2xl flex flex-col gap-2 select-none pointer-events-auto"
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">Graficador libre</span>

      {/* Entradas */}
      <div
        className="bg-zinc-900 p-2 rounded-lg border border-zinc-800 space-y-1.5 text-xs"
        onPointerDown={frenar}
        onPointerMove={frenar}
        onPointerUp={frenar}
      >
        {campo('f(x) =', exprF, pf, 'exprF', 'text-violet-300')}
        {verG && campo('g(x) =', exprG, pg, 'exprG', 'text-fuchsia-300')}
        <p className="text-zinc-500">{AYUDA}</p>
      </div>

      <div className="w-full aspect-[4/3] shrink-0">
        <svg viewBox={`${bx} ${by} ${bw} ${bh}`} className="w-full h-full border border-zinc-800 rounded">
          <defs>
            <clipPath id={`clip-${uid}`}>
              <rect x={bx} y={by} width={bw} height={bh} />
            </clipPath>
          </defs>

          <g clipPath={`url(#clip-${uid})`}>
            {/* Grilla */}
            <g className="stroke-zinc-800" strokeWidth={1}>
              {gx.map((x) => (
                <line key={`gx${x}`} x1={x * u} y1={by} x2={x * u} y2={by + bh} />
              ))}
              {gy.map((y) => (
                <line key={`gy${y}`} x1={bx} y1={-y * u} x2={bx + bw} y2={-y * u} />
              ))}
            </g>

            {/* Ejes */}
            <g className="stroke-zinc-500" strokeWidth={1.5}>
              <line x1={bx} y1={0} x2={bx + bw} y2={0} />
              <line x1={0} y1={by} x2={0} y2={by + bh} />
            </g>
            <g className="fill-zinc-500 text-[11px] font-mono">
              {gx
                .filter((x) => Math.abs(x) > paso / 2)
                .map((x) => (
                  <text key={`ex${x}`} x={x * u} y={yEtiq} textAnchor="middle">
                    {formatEs(x)}
                  </text>
                ))}
              {gy
                .filter((y) => Math.abs(y) > paso / 2)
                .map((y) => (
                  <text key={`ey${y}`} x={xEtiq} y={-y * u - 3}>
                    {formatEs(y)}
                  </text>
                ))}
            </g>

            {g &&
              samplePaths(g, v, [], u).map((d, i) => (
                <path key={`g${i}`} d={d} fill="none" className="stroke-fuchsia-400" strokeWidth={2.5} />
              ))}
            {f &&
              samplePaths(f, v, [], u).map((d, i) => (
                <path key={`f${i}`} d={d} fill="none" className="stroke-violet-300" strokeWidth={2.5} />
              ))}

            {verNotables && f && notables && (
              <>
                {notables.raices.map((x) => {
                  const P = S(x, 0)
                  return (
                    <g key={`r${x}`}>
                      <circle cx={P.x} cy={P.y} r={4} className="fill-white" />
                      <text x={P.x} y={P.y - 8} textAnchor="middle" className="fill-zinc-200 text-[11px] font-mono">
                        x ≈ {formatEs(x)}
                      </text>
                    </g>
                  )
                })}
                {notables.ordenada !== null &&
                  (() => {
                    const P = S(0, notables.ordenada)
                    return (
                      <polygon
                        points={`${P.x - 6},${P.y} ${P.x},${P.y - 6} ${P.x + 6},${P.y} ${P.x},${P.y + 6}`}
                        className="fill-indigo-400"
                      />
                    )
                  })()}
                {notables.cortes.map((x) => {
                  const P = S(x, f(x))
                  return <circle key={`c${x}`} cx={P.x} cy={P.y} r={5} className="fill-amber-400" />
                })}
              </>
            )}
          </g>
        </svg>
      </div>

      {/* Panel */}
      {verNotables && notables && (
        <div className="bg-zinc-900 font-mono text-xs rounded-lg p-2 border border-zinc-800 flex flex-col gap-y-1">
          <span className="text-zinc-200">Raíces de f: {lista(notables.raices)}</span>
          <span className="text-indigo-300">
            Ordenada al origen: {notables.ordenada !== null ? `f(0) = ${formatEs(notables.ordenada, 4)}` : 'fuera de la ventana'}
          </span>
          {g && <span className="text-amber-300">f = g en x ≈ {lista(notables.cortes)}</span>}
        </div>
      )}

      {/* Controles */}
      <div
        className="bg-zinc-900 p-2 rounded-lg border border-zinc-800 text-xs flex flex-wrap items-center gap-2"
        onPointerDown={frenar}
        onPointerMove={frenar}
        onPointerUp={frenar}
      >
        <button onClick={() => zoom(2)} className={boton(false)}>
          Zoom −
        </button>
        <button onClick={() => zoom(0.5)} className={boton(false)}>
          Zoom +
        </button>
        <button onClick={() => mover(-1, 0)} className={boton(false)}>
          ←
        </button>
        <button onClick={() => mover(1, 0)} className={boton(false)}>
          →
        </button>
        <button onClick={() => mover(0, 1)} className={boton(false)}>
          ↑
        </button>
        <button onClick={() => mover(0, -1)} className={boton(false)}>
          ↓
        </button>
        <button onClick={() => actualizar({ ox: 0, oy: 0, escala: 4 })} className={boton(false)}>
          Centrar
        </button>
        <div className="ml-auto flex items-center gap-3">
          {CHECKS.map(({ clave, label }) => (
            <label key={clave} className="flex items-center gap-1 text-zinc-300">
              <input
                type="checkbox"
                checked={props[clave]}
                onChange={(e) => actualizar({ [clave]: e.target.checked })}
                className="accent-fuchsia-500 cursor-pointer"
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    </HTMLContainer>
  )
}

export class GraficadorLibreShapeUtil extends BaseBoxShapeUtil<GraficadorLibreShape> {
  static override type = 'graficador-libre' as const

  static override props: RecordProps<GraficadorLibreShape> = {
    w: T.number,
    h: T.number,
    exprF: T.string,
    exprG: T.string,
    verG: T.boolean,
    verNotables: T.boolean,
    ox: T.number,
    oy: T.number,
    escala: T.number,
  }

  override getDefaultProps(): GraficadorLibreShape['props'] {
    return { w: 640, h: 760, exprF: 'x^3 - 3x + 1', exprG: 'x - 1', verG: false, verNotables: true, ox: 0, oy: 0, escala: 4 }
  }

  override component(shape: GraficadorLibreShape) {
    const actualizar = (props: Partial<Props>) => {
      this.editor.updateShape<GraficadorLibreShape>({ id: shape.id, type: 'graficador-libre', props })
    }
    return <Graficador id={shape.id} props={shape.props} actualizar={actualizar} />
  }

  override indicator(shape: GraficadorLibreShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />
  }

  override getIndicatorPath(shape: GraficadorLibreShape): Path2D {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 12)
    return path
  }
}
