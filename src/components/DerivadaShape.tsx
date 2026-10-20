'use client'

import { BaseBoxShapeUtil, HTMLContainer, type TLShape } from 'tldraw'
import { derivadaProps, derivadaDefaults } from '@/shapes/schemas'
import type { PresetDerivada as Preset } from '@/shapes/schemas'
import { ajustar, samplePaths, rectaVentana, type Fn, type Ventana } from '@/lib/plot'
import { toSvg, formatEs } from '@/lib/linear2d'

type Bandera = 'verDerivada' | 'verSegunda' | 'verNotables'

export type DerivadaShape = TLShape<'derivada-estudio'>

type PresetDef = {
  label: string
  tf: string
  td1: string
  td2: string
  f: Fn
  d1: Fn
  d2: Fn
  raices: number[]
  extremos: { x: number; tipo: 'max' | 'min' }[]
  inflexiones: number[]
  ventana: Ventana
  x0Def: number
}

const PI = Math.PI
const S3 = Math.sqrt(3)

const PRESETS: Record<Preset, PresetDef> = {
  cubica: {
    label: 'Cúbica',
    tf: 'x³/3 − x',
    td1: 'x² − 1',
    td2: '2x',
    f: (x) => (x * x * x) / 3 - x,
    d1: (x) => x * x - 1,
    d2: (x) => 2 * x,
    raices: [-S3, 0, S3],
    extremos: [
      { x: -1, tipo: 'max' },
      { x: 1, tipo: 'min' },
    ],
    inflexiones: [0],
    ventana: { xMin: -2.5, xMax: 2.5, yMin: -3, yMax: 3 },
    x0Def: 0.5,
  },
  cuadratica: {
    label: 'Cuadrática',
    tf: '−0,5x² + x + 1,5',
    td1: '−x + 1',
    td2: '−1',
    f: (x) => -0.5 * x * x + x + 1.5,
    d1: (x) => -x + 1,
    d2: () => -1,
    raices: [-1, 3],
    extremos: [{ x: 1, tipo: 'max' }],
    inflexiones: [],
    ventana: { xMin: -2, xMax: 4, yMin: -3, yMax: 3 },
    x0Def: 0,
  },
  trig: {
    label: 'Seno',
    tf: 'sen x',
    td1: 'cos x',
    td2: '−sen x',
    f: (x) => Math.sin(x),
    d1: (x) => Math.cos(x),
    d2: (x) => -Math.sin(x),
    raices: [-PI, 0, PI],
    extremos: [
      { x: PI / 2, tipo: 'max' },
      { x: -PI / 2, tipo: 'min' },
    ],
    inflexiones: [-PI, 0, PI],
    ventana: { xMin: -3.5, xMax: 3.5, yMin: -2, yMax: 2 },
    x0Def: 0.5,
  },
}

const ORDEN: Preset[] = ['cubica', 'cuadratica', 'trig']
const CHECKS: { clave: Bandera; label: string }[] = [
  { clave: 'verDerivada', label: 'f′' },
  { clave: 'verSegunda', label: 'f″' },
  { clave: 'verNotables', label: 'Puntos notables' },
]
const ANCHO = 500

export class DerivadaShapeUtil extends BaseBoxShapeUtil<DerivadaShape> {
  static override type = 'derivada-estudio' as const

  static override props = derivadaProps

  override getDefaultProps(): DerivadaShape['props'] {
    return { ...derivadaDefaults }
  }

  override component(shape: DerivadaShape) {
    const { preset, modo, x0, dx, verDerivada, verSegunda, verNotables } = shape.props
    const p = PRESETS[preset]
    const { f, d1, d2, ventana: v } = p
    const u = ANCHO / (v.xMax - v.xMin)
    const uid = shape.id.replace(/[^a-zA-Z0-9]/g, '')
    const secante = modo === 'secante'

    const actualizar = (props: Partial<DerivadaShape['props']>) => {
      this.editor.updateShape<DerivadaShape>({ id: shape.id, type: 'derivada-estudio', props })
    }

    const boton = (activo: boolean) =>
      `px-2 py-0.5 rounded-full text-white cursor-pointer ${activo ? 'bg-fuchsia-600' : 'bg-purple-600/80 hover:bg-purple-500'}`

    const S = (x: number, y: number) => toSvg({ x, y }, u)
    const seg = (x1: number, y1: number, x2: number, y2: number) => {
      const P = S(x1, y1)
      const Q = S(x2, y2)
      return { x1: P.x, y1: P.y, x2: Q.x, y2: Q.y }
    }
    const recta = (x: number, y: number, m: number) => {
      const [P, Q] = rectaVentana(x, y, m, v)
      return seg(P.x, P.y, Q.x, Q.y)
    }

    const bx = v.xMin * u
    const by = -v.yMax * u
    const bw = (v.xMax - v.xMin) * u
    const bh = (v.yMax - v.yMin) * u

    const enteros = (lo: number, hi: number) =>
      Array.from({ length: Math.floor(hi) - Math.ceil(lo) + 1 }, (_, i) => Math.ceil(lo) + i)

    const curva = (g: Fn, clase: string, extra: { strokeWidth: number; strokeDasharray?: string; strokeOpacity?: number }, k: string) =>
      samplePaths(g, v, [], u).map((d, i) => <path key={`${k}${i}`} d={d} fill="none" className={clase} {...extra} />)

    // Comunes
    const y0 = f(x0)
    const m = d1(x0)
    const m2 = d2(x0)
    const P0 = S(x0, y0)

    // Secante
    const x1 = x0 + dx
    const y1 = f(x1)
    const esCero = Math.abs(dx) < 1e-9
    const mSec = esCero ? m : (y1 - y0) / dx
    const P1 = S(x1, y1)
    const Pc = S(x1, y0)

    // Estudio
    const colorTg = Math.abs(m) < 0.05 ? 'stroke-white' : m > 0 ? 'stroke-emerald-400' : 'stroke-amber-400'
    const textoM = Math.abs(m) < 0.05 ? 'tangente horizontal (posible extremo)' : m > 0 ? 'crece' : 'decrece'
    const textoM2 = m2 > 0.05 ? 'cóncava hacia arriba' : m2 < -0.05 ? 'cóncava hacia abajo' : 'posible inflexión'
    const Pd = S(x0, m)
    const imanes = [...p.raices, ...p.extremos.map((e) => e.x), ...p.inflexiones]

    return (
      <HTMLContainer
        id={shape.id}
        style={{ pointerEvents: 'all' }}
        className="w-full h-full bg-zinc-950 border-2 border-purple-500/60 rounded-xl p-3 text-white shadow-2xl flex flex-col gap-2 select-none pointer-events-auto"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
          Derivada · {p.label} · {secante ? 'Secante → Tangente' : 'Estudio de función'}
        </span>

        {/* Panel */}
        <div className="bg-zinc-900 font-mono text-xs rounded-lg p-2 border border-zinc-800 flex flex-wrap gap-x-4 gap-y-1">
          {secante ? (
            <>
              <span className="text-amber-400">Pendiente secante Δy/Δx = {formatEs(mSec, 4)}</span>
              <span className="text-violet-300">Derivada exacta f′(x₀) = {formatEs(m, 4)}</span>
              <span className="text-zinc-300">Diferencia = {formatEs(Math.abs(mSec - m), 4)}</span>
              {esCero && <span className="text-fuchsia-400">Δx → 0: la secante se vuelve la tangente</span>}
            </>
          ) : (
            <>
              <span className="text-violet-300">f(x) = {p.tf}</span>
              <span className="text-fuchsia-300">f′(x) = {p.td1}</span>
              <span className="text-indigo-300">f″(x) = {p.td2}</span>
              <span className="w-full text-zinc-200">
                f′(x₀) = {formatEs(m, 3)} → {textoM}
              </span>
              <span className="w-full text-zinc-200">
                f″(x₀) = {formatEs(m2, 3)} → {textoM2}
              </span>
            </>
          )}
        </div>

        <div className="flex-1 min-h-0 flex items-center justify-center">
          <svg viewBox={`${bx} ${by} ${bw} ${bh}`} className="w-full h-full border border-zinc-800 rounded">
            <defs>
              <clipPath id={`clip-${uid}`}>
                <rect x={bx} y={by} width={bw} height={bh} />
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

              {secante ? (
                <>
                  {!esCero && (
                    <>
                      <polygon
                        points={`${P0.x},${P0.y} ${Pc.x},${Pc.y} ${P1.x},${P1.y}`}
                        className="fill-amber-500"
                        fillOpacity={0.12}
                      />
                      <line {...seg(x0, y0, x1, y0)} className="stroke-amber-300" strokeWidth={1.5} strokeDasharray="4 4" />
                      <line {...seg(x1, y0, x1, y1)} className="stroke-amber-300" strokeWidth={1.5} strokeDasharray="4 4" />
                      <text
                        x={(P0.x + Pc.x) / 2}
                        y={Pc.y + (y1 >= y0 ? 14 : -6)}
                        textAnchor="middle"
                        className="fill-amber-300 text-[11px] font-mono"
                      >
                        Δx = {formatEs(dx)}
                      </text>
                      <text
                        x={Pc.x + (dx >= 0 ? 6 : -6)}
                        y={(Pc.y + P1.y) / 2}
                        textAnchor={dx >= 0 ? 'start' : 'end'}
                        dominantBaseline="middle"
                        className="fill-amber-300 text-[11px] font-mono"
                      >
                        Δy = {formatEs(y1 - y0)}
                      </text>
                    </>
                  )}

                  {curva(f, 'stroke-violet-300', { strokeWidth: 2.5 }, 'f')}

                  <line {...recta(x0, y0, m)} className="stroke-violet-500" strokeWidth={2} />
                  <line
                    {...recta(x0, y0, mSec)}
                    className="stroke-amber-400"
                    strokeWidth={2}
                    strokeDasharray={esCero ? '6 4' : undefined}
                  />

                  {!esCero && <circle cx={P1.x} cy={P1.y} r={5} className="fill-amber-400" />}
                </>
              ) : (
                <>
                  {verSegunda && curva(d2, 'stroke-indigo-400', { strokeWidth: 2, strokeOpacity: 0.5 }, 'd2')}
                  {verDerivada && curva(d1, 'stroke-fuchsia-400', { strokeWidth: 2, strokeDasharray: '6 4' }, 'd1')}
                  {curva(f, 'stroke-violet-300', { strokeWidth: 2.5 }, 'f')}

                  <line {...recta(x0, y0, m)} className={colorTg} strokeWidth={2} />

                  {verDerivada && (
                    <>
                      <line {...seg(x0, y0, x0, m)} className="stroke-fuchsia-300" strokeWidth={1.5} strokeDasharray="4 4" />
                      <circle cx={Pd.x} cy={Pd.y} r={5} className="fill-fuchsia-400" />
                    </>
                  )}

                  {verNotables && (
                    <>
                      {p.raices.map((x) => {
                        const P = S(x, f(x))
                        return <circle key={`r${x}`} cx={P.x} cy={P.y} r={5} className="fill-white" />
                      })}
                      {p.extremos.map(({ x, tipo }) => {
                        const P = S(x, f(x))
                        return (
                          <g key={`e${x}`}>
                            <circle cx={P.x} cy={P.y} r={6} className="fill-fuchsia-400" />
                            <text
                              x={P.x}
                              y={P.y + (tipo === 'max' ? -12 : 20)}
                              textAnchor="middle"
                              className="fill-fuchsia-300 text-[11px] font-mono"
                            >
                              {tipo === 'max' ? 'máx' : 'mín'}
                            </text>
                          </g>
                        )
                      })}
                      {p.inflexiones.map((x) => {
                        const P = S(x, f(x))
                        return (
                          <polygon
                            key={`i${x}`}
                            points={`${P.x - 7},${P.y} ${P.x},${P.y - 7} ${P.x + 7},${P.y} ${P.x},${P.y + 7}`}
                            className="fill-indigo-400"
                          />
                        )
                      })}
                    </>
                  )}
                </>
              )}

              <circle cx={P0.x} cy={P0.y} r={6} className="fill-violet-300" />
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
              <button key={k} onClick={() => actualizar({ preset: k, x0: PRESETS[k].x0Def })} className={boton(k === preset)}>
                {PRESETS[k].label}
              </button>
            ))}
            <button
              onClick={() => actualizar({ modo: secante ? 'estudio' : 'secante' })}
              className="ml-auto px-2 py-0.5 rounded-full bg-indigo-600/80 hover:bg-indigo-500 text-white cursor-pointer"
            >
              Modo: {secante ? 'Secante' : 'Estudio'}
            </button>
          </div>

          <label className="flex items-center justify-between gap-2 font-mono text-purple-300">
            x₀ = {formatEs(x0)}
            <input
              type="range"
              min={v.xMin + 0.25}
              max={v.xMax - 0.25}
              step="any"
              value={x0}
              onChange={(e) => actualizar({ x0: ajustar(Number(e.target.value), 0.05, imanes) })}
              className="w-64 accent-purple-500 cursor-pointer"
            />
          </label>

          {secante ? (
            <label className="flex items-center justify-between gap-2 font-mono text-amber-300">
              Δx = {formatEs(dx)}
              <input
                type="range"
                min={-1.5}
                max={1.5}
                step={0.05}
                value={dx}
                onChange={(e) => actualizar({ dx: Number(e.target.value) })}
                className="w-64 accent-amber-500 cursor-pointer"
              />
            </label>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {CHECKS.map(({ clave, label }) => (
                <label key={clave} className="flex items-center gap-1 text-zinc-300">
                  <input
                    type="checkbox"
                    checked={shape.props[clave]}
                    onChange={(e) => actualizar({ [clave]: e.target.checked })}
                    className="accent-fuchsia-500 cursor-pointer"
                  />
                  {label}
                </label>
              ))}
            </div>
          )}
        </div>
      </HTMLContainer>
    )
  }

  override indicator(shape: DerivadaShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />
  }

  override getIndicatorPath(shape: DerivadaShape): Path2D {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 12)
    return path
  }
}
