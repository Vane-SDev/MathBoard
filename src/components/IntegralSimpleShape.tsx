'use client'

import { BaseBoxShapeUtil, HTMLContainer, RecordProps, T, TLBaseShape } from 'tldraw'
import { samplePaths, riemann, type Metodo, type Fn, type Ventana, ajustar, acotar } from '@/lib/plot'
import { toSvg, formatEs } from '@/lib/linear2d'

type Preset = 'parabola' | 'seno' | 'exponencial'
type Modo = 'definida' | 'indefinida'

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    'integral-simple': {
      w: number
      h: number
      preset: 'parabola' | 'seno' | 'exponencial'
      modo: 'definida' | 'indefinida'
      metodo: 'izquierda' | 'derecha' | 'medio' | 'trapecio'
      a: number
      b: number
      n: number
      c: number
      x0: number
    }
  }
}

export type IntegralSimpleShape = TLBaseShape<
  'integral-simple',
  {
    w: number
    h: number
    preset: Preset
    modo: Modo
    metodo: Metodo
    a: number
    b: number
    n: number
    c: number
    x0: number
  }
>

type PresetDef = {
  label: string
  f: Fn
  F: Fn
  Ftexto: string
  ventana: Ventana
  aDef: number
  bDef: number
  x0Def: number
}

const PRESETS: Record<Preset, PresetDef> = {
  parabola: {
    label: 'Parábola',
    f: (x) => -x * x + 4,
    F: (x) => (-x * x * x) / 3 + 4 * x,
    Ftexto: '−x³/3 + 4x',
    ventana: { xMin: -3, xMax: 3, yMin: -6, yMax: 6 },
    aDef: -1,
    bDef: 3,
    x0Def: 1,
  },
  seno: {
    label: 'Seno',
    f: (x) => Math.sin(x),
    F: (x) => -Math.cos(x),
    Ftexto: '−cos x',
    ventana: { xMin: -1, xMax: 7, yMin: -4.5, yMax: 4.5 },
    aDef: 0,
    bDef: 2 * Math.PI,
    x0Def: Math.PI / 2,
  },
  exponencial: {
    label: 'Exponencial',
    f: (x) => Math.exp(x),
    F: (x) => Math.exp(x),
    Ftexto: 'eˣ',
    ventana: { xMin: -3, xMax: 2.5, yMin: -3.5, yMax: 13 },
    aDef: -2,
    bDef: 1,
    x0Def: 0,
  },
}

const ORDEN: Preset[] = ['parabola', 'seno', 'exponencial']
const METODOS: { m: Metodo; label: string }[] = [
  { m: 'izquierda', label: 'Izquierda' },
  { m: 'derecha', label: 'Derecha' },
  { m: 'medio', label: 'Medio' },
  { m: 'trapecio', label: 'Trapecio' },
]
const CS = [-2, -1, 0, 1, 2]
const ANCHO = 500
const MUESTRAS = 200

export class IntegralSimpleShapeUtil extends BaseBoxShapeUtil<IntegralSimpleShape> {
  static override type = 'integral-simple' as const

  static override props: RecordProps<IntegralSimpleShape> = {
    w: T.number,
    h: T.number,
    preset: T.literalEnum('parabola', 'seno', 'exponencial'),
    modo: T.literalEnum('definida', 'indefinida'),
    metodo: T.literalEnum('izquierda', 'derecha', 'medio', 'trapecio'),
    a: T.number,
    b: T.number,
    n: T.number,
    c: T.number,
    x0: T.number,
  }

  override getDefaultProps(): IntegralSimpleShape['props'] {
    return { w: 580, h: 680, preset: 'parabola', modo: 'definida', metodo: 'medio', a: -1, b: 3, n: 8, c: 0, x0: 1 }
  }

  override component(shape: IntegralSimpleShape) {
    const { preset, modo, metodo, a, b, n, c, x0 } = shape.props
    const p = PRESETS[preset]
    const { f, F, ventana: v } = p
    const u = ANCHO / (v.xMax - v.xMin)
    const uid = shape.id.replace(/[^a-zA-Z0-9]/g, '')

    const actualizar = (props: Partial<IntegralSimpleShape['props']>) => {
      this.editor.updateShape<IntegralSimpleShape>({ id: shape.id, type: 'integral-simple', props })
    }

    const S = (x: number, y: number) => toSvg({ x, y }, u)
    const pts = (lista: { x: number; y: number }[]) =>
      lista
        .map(({ x, y }) => S(x, y))
        .map((q) => `${q.x},${q.y}`)
        .join(' ')
    const seg = (x1: number, y1: number, x2: number, y2: number) => {
      const P = S(x1, y1)
      const Q = S(x2, y2)
      return { x1: P.x, y1: P.y, x2: Q.x, y2: Q.y }
    }

    const bx = v.xMin * u
    const by = -v.yMax * u
    const bw = (v.xMax - v.xMin) * u
    const bh = (v.yMax - v.yMin) * u

    const enteros = (lo: number, hi: number) =>
      Array.from({ length: Math.floor(hi) - Math.ceil(lo) + 1 }, (_, i) => Math.ceil(lo) + i)

    const definida = modo === 'definida'

    // Definida
    const { franjas, suma } = riemann(f, a, b, n, metodo)
    const exacto = F(b) - F(a)
    const error = Math.abs(suma - exacto)
    const area = pts([
      ...Array.from({ length: MUESTRAS + 1 }, (_, i) => {
        const x = a + ((b - a) * i) / MUESTRAS
        return { x, y: f(x) }
      }),
      { x: b, y: 0 },
      { x: a, y: 0 },
    ])

    // Indefinida
    const y0 = F(x0) + c
    const m = f(x0)
    const P0 = S(x0, y0)
    const Pf = S(x0, m)

    const boton = (activo: boolean) =>
      `px-2 py-0.5 rounded-full text-white cursor-pointer ${activo ? 'bg-fuchsia-600' : 'bg-purple-600/80 hover:bg-purple-500'}`

    const paso = preset === 'seno' ? Math.PI / 12 : 0.1
    const imanes =
  preset === 'seno' ? [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, 2 * Math.PI]
  : preset === 'parabola' ? [-2, 0, 2]
  : [0]


    return (
      <HTMLContainer
        id={shape.id}
        style={{ pointerEvents: 'all' }}
        className="w-full h-full bg-zinc-950 border-2 border-purple-500/60 rounded-xl p-3 text-white shadow-2xl flex flex-col gap-2 select-none pointer-events-auto"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
          Integral · {p.label} · {definida ? 'Definida' : 'Indefinida'}
        </span>

        {/* Encabezado / panel */}
        <div className="bg-zinc-900 font-mono text-xs rounded-lg p-2 border border-zinc-800 flex flex-wrap gap-x-4 gap-y-1">
          {definida ? (
            <>
              <span className="text-purple-300">Sₙ = {formatEs(suma, 4)}</span>
              <span className="text-violet-300">Exacto F(b)−F(a) = {formatEs(exacto, 4)}</span>
              <span className="text-amber-400">Error = {formatEs(error, 4)}</span>
            </>
          ) : (
            <>
              <span className="text-violet-300">F(x) = {p.Ftexto}</span>
              <span className="text-indigo-300">C = {formatEs(c)}</span>
              <span className="text-emerald-400">F&apos;(x₀) = f(x₀) = {formatEs(m)}</span>
            </>
          )}
        </div>

        <div className="flex-1 min-h-0 flex items-center justify-center">
          <svg viewBox={`${bx} ${by} ${bw} ${bh}`} className="w-full h-full border border-zinc-800 rounded">
            <defs>
              <clipPath id={`clip-${uid}`}>
                <rect x={bx} y={by} width={bw} height={bh} />
              </clipPath>
              <clipPath id={`pos-${uid}`}>
                <rect x={bx} y={by} width={bw} height={-by} />
              </clipPath>
              <clipPath id={`neg-${uid}`}>
                <rect x={bx} y={0} width={bw} height={by + bh} />
              </clipPath>
            </defs>

            <g clipPath={`url(#clip-${uid})`}>
              {/* Grilla entera */}
              <g className="stroke-zinc-800" strokeWidth={1}>
                {enteros(v.xMin, v.xMax).map((k) => (
                  <line key={`gx${k}`} x1={k * u} y1={by} x2={k * u} y2={by + bh} />
                ))}
                {enteros(v.yMin, v.yMax).map((k) => (
                  <line key={`gy${k}`} x1={bx} y1={-k * u} x2={bx + bw} y2={-k * u} />
                ))}
              </g>

              {/* Ejes */}
              <g className="stroke-zinc-500" strokeWidth={1.5}>
                <line x1={bx} y1={0} x2={bx + bw} y2={0} />
                <line x1={0} y1={by} x2={0} y2={by + bh} />
              </g>

              {definida ? (
                <>
                  {/* Área exacta */}
                  <polygon points={area} clipPath={`url(#pos-${uid})`} className="fill-violet-500" fillOpacity={0.18} />
                  <polygon points={area} clipPath={`url(#neg-${uid})`} className="fill-amber-500" fillOpacity={0.18} />

                  {/* Franjas de Riemann */}
                  {franjas.map((fr, i) => {
                    const clase =
                      (fr.y0 + fr.y1) / 2 >= 0 ? 'fill-purple-500 stroke-purple-500' : 'fill-amber-500 stroke-amber-500'
                    return (
                      <polygon
                        key={i}
                        points={pts([
                          { x: fr.x0, y: 0 },
                          { x: fr.x0, y: fr.y0 },
                          { x: fr.x1, y: fr.y1 },
                          { x: fr.x1, y: 0 },
                        ])}
                        className={clase}
                        fillOpacity={0.45}
                        strokeWidth={1}
                      />
                    )
                  })}

                  {/* Curva */}
                  {samplePaths(f, v, [], u).map((d, i) => (
                    <path key={i} d={d} fill="none" className="stroke-violet-300" strokeWidth={2.5} />
                  ))}

                  {/* Límites de integración */}
                  {[a, b].map((x, i) => (
                    <line key={`l${i}`} x1={x * u} y1={by} x2={x * u} y2={by + bh} className="stroke-zinc-400" strokeWidth={1} strokeDasharray="4 4" />
                  ))}
                </>
              ) : (
                <>
                  {/* Familia F + C */}
                  {CS.map((k) =>
                    samplePaths((x) => F(x) + k, v, [], u).map((d, i) => (
                      <path key={`F${k}-${i}`} d={d} fill="none" className="stroke-zinc-600" strokeOpacity={0.6} strokeWidth={1.5} />
                    )),
                  )}

                  {/* f punteada */}
                  {samplePaths(f, v, [], u).map((d, i) => (
                    <path key={`f${i}`} d={d} fill="none" className="stroke-fuchsia-400" strokeWidth={2} strokeDasharray="6 5" />
                  ))}

                  {/* F + c activa */}
                  {samplePaths((x) => F(x) + c, v, [], u).map((d, i) => (
                    <path key={`Fc${i}`} d={d} fill="none" className="stroke-violet-400" strokeWidth={3} />
                  ))}

                  {/* Tangente en x0 */}
                  <line {...seg(x0 - 0.8, y0 - 0.8 * m, x0 + 0.8, y0 + 0.8 * m)} className="stroke-emerald-400" strokeWidth={2.5} />
                  <circle cx={P0.x} cy={P0.y} r={6} className="fill-violet-400" />

                  {/* Segmento f(x0) */}
                  <line {...seg(x0, 0, x0, m)} className="stroke-fuchsia-400" strokeWidth={2.5} />
                  <circle cx={Pf.x} cy={Pf.y} r={5} className="fill-fuchsia-400" />
                </>
              )}
            </g>
          </svg>
        </div>

        {/* Controles */}
        <div
          className="bg-zinc-900 p-2 rounded-lg border border-zinc-800 space-y-1.5 text-xs"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div className="flex flex-wrap items-center gap-2">
            {ORDEN.map((k) => (
              <button
                key={k}
                onClick={() => {
                  const d = PRESETS[k]
                  actualizar({ preset: k, a: d.aDef, b: d.bDef, x0: d.x0Def })
                }}
                className={boton(k === preset)}
              >
                {PRESETS[k].label}
              </button>
            ))}
            <button
              onClick={() => actualizar({ modo: definida ? 'indefinida' : 'definida' })}
              className="ml-auto px-2 py-0.5 rounded-full bg-indigo-600/80 hover:bg-indigo-500 text-white cursor-pointer"
            >
              Modo: {definida ? 'Definida' : 'Indefinida'}
            </button>
          </div>

          {definida ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {METODOS.map(({ m: k, label }) => (
                  <button key={k} onClick={() => actualizar({ metodo: k })} className={boton(k === metodo)}>
                    {label}
                  </button>
                ))}
              </div>
              <label className="flex items-center justify-between gap-2 font-mono text-purple-300">
                a = {formatEs(a)}
                <input
                  type="range"
                  min={v.xMin}
                  max={b - paso}
                  step="any"
                  value={a}
                  onChange={(e) => actualizar({ a: acotar(ajustar(Number(e.target.value), paso, imanes), v.xMin, b - paso) })}
                  className="w-64 accent-purple-500 cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between gap-2 font-mono text-indigo-300">
                b = {formatEs(b)}
                <input
                  type="range"
                  min={a + paso}
                  max={v.xMax}
                  step="any"
                  value={b}
                  onChange={(e) => actualizar({ b: acotar(ajustar(Number(e.target.value), paso, imanes), a + paso, v.xMax) })}
                  className="w-64 accent-indigo-500 cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between gap-2 font-mono text-fuchsia-300">
                n = {n}
                <input
                  type="range"
                  min={2}
                  max={50}
                  step={1}
                  value={n}
                  onChange={(e) => actualizar({ n: Number(e.target.value) })}
                  className="w-64 accent-fuchsia-500 cursor-pointer"
                />
              </label>
            </>
          ) : (
            <>
              <label className="flex items-center justify-between gap-2 font-mono text-indigo-300">
                C = {formatEs(c)}
                <input
                  type="range"
                  min={-3}
                  max={3}
                  step="any"
                  value={c}
                  onChange={(e) => actualizar({ c: acotar(ajustar(Number(e.target.value), 0.5), -3, 3) })}
                  className="w-64 accent-indigo-500 cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between gap-2 font-mono text-fuchsia-300">
                x₀ = {formatEs(x0)}
                <input
                  type="range"
                  min={v.xMin + 0.5}
                  max={v.xMax - 0.5}
                  step="any"
                  value={x0}
                  onChange={(e) =>
                    actualizar({ x0: acotar(ajustar(Number(e.target.value), paso, imanes), v.xMin + 0.5, v.xMax - 0.5) })
                  }
                  className="w-64 accent-fuchsia-500 cursor-pointer"
                />
              </label>
            </>
          )}
        </div>
      </HTMLContainer>
    )
  }

  override indicator(shape: IntegralSimpleShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />
  }

  override getIndicatorPath(shape: IntegralSimpleShape): Path2D {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 12)
    return path
  }
}
