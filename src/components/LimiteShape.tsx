'use client'

import { BaseBoxShapeUtil, HTMLContainer, type TLShape } from 'tldraw'
import { limiteProps, limiteDefaults } from '@/shapes/schemas'
import type { PresetLimite as Preset } from '@/shapes/schemas'
import { acotar, ajustar, samplePaths, deltaFunciona, deltaMaximo, type Fn, type Ventana } from '@/lib/plot'
import { toSvg, formatEs } from '@/lib/linear2d'

export type LimiteShape = TLShape<'limite-funcion'>

type PresetDef = {
  label: string
  f: Fn
  c: number
  Lizq: number
  Lder: number
  fc: number | null
  relleno: 'izq' | 'der' | 'ninguno'
  breaks: number[]
  ventana: Ventana
}

const PRESETS: Record<Preset, PresetDef> = {
  continua: {
    label: 'Continua',
    f: (x) => 0.25 * x * x + 1,
    c: 2,
    Lizq: 2,
    Lder: 2,
    fc: 2,
    relleno: 'ninguno',
    breaks: [],
    ventana: { xMin: -1, xMax: 5, yMin: -1, yMax: 6 },
  },
  agujero: {
    label: 'Agujero 0/0',
    f: (x) => (x * x - 4) / (x - 2),
    c: 2,
    Lizq: 4,
    Lder: 4,
    fc: null,
    relleno: 'ninguno',
    breaks: [2],
    ventana: { xMin: -1, xMax: 5, yMin: -1, yMax: 7 },
  },
  salto: {
    label: 'Salto',
    f: (x) => (x <= 1 ? x + 1 : x + 2),
    c: 1,
    Lizq: 2,
    Lder: 3,
    fc: 2,
    relleno: 'izq',
    breaks: [1],
    ventana: { xMin: -2, xMax: 4, yMin: -1, yMax: 6 },
  },
  asintota: {
    label: 'Asíntota',
    f: (x) => 1 / ((x - 1) * (x - 1)),
    c: 1,
    Lizq: Infinity,
    Lder: Infinity,
    fc: null,
    relleno: 'ninguno',
    breaks: [1],
    ventana: { xMin: -2, xMax: 4, yMin: -1, yMax: 8 },
  },
}

const ORDEN: Preset[] = ['continua', 'agujero', 'salto', 'asintota']
const ANCHO = 500

const fmtY = (y: number): string => (!Number.isFinite(y) || Math.abs(y) > 999 ? 'muy grande' : formatEs(y))
const fmtL = (L: number): string => (L === Infinity ? '+∞' : formatEs(L))

export class LimiteShapeUtil extends BaseBoxShapeUtil<LimiteShape> {
  static override type = 'limite-funcion' as const

  static override props = limiteProps

  override getDefaultProps(): LimiteShape['props'] {
    return { ...limiteDefaults }
  }

  override component(shape: LimiteShape) {
    const { preset, modo, dist, epsilon, delta } = shape.props
    const p = PRESETS[preset]
    const { f, c, Lizq, Lder, fc, relleno, breaks, ventana: v } = p
    const u = ANCHO / (v.xMax - v.xMin)
    const uid = shape.id.replace(/[^a-zA-Z0-9]/g, '')

    const actualizar = (props: Partial<LimiteShape['props']>) => {
      this.editor.updateShape<LimiteShape>({ id: shape.id, type: 'limite-funcion', props })
    }

    const S = (x: number, y: number) => toSvg({ x, y }, u)
    const bx = v.xMin * u
    const by = -v.yMax * u
    const bw = (v.xMax - v.xMin) * u
    const bh = (v.yMax - v.yMin) * u

    const enteros = (a: number, b: number) =>
      Array.from({ length: Math.floor(b) - Math.ceil(a) + 1 }, (_, i) => Math.ceil(a) + i)

    const paths = samplePaths(f, v, breaks, u)
    const finito = Number.isFinite(Lizq) && Number.isFinite(Lder)
    const esAsintota = preset === 'asintota'

    const huecos: number[] = []
    if (finito) {
      if (relleno !== 'izq') huecos.push(Lizq)
      if (relleno !== 'der' && Lder !== Lizq) huecos.push(Lder)
    }

    // Laterales
    const yIzq = f(c - dist)
    const yDer = f(c + dist)
    const conclusion = !finito
      ? 'límite infinito'
      : Lizq === Lder
        ? `existe lím = ${formatEs(Lizq)}`
        : 'no existe: L⁻ ≠ L⁺'

    // ε-δ
    const L = Lizq
    const mostrarED = modo === 'epsilon-delta' && !esAsintota
    const ok = mostrarED ? deltaFunciona(f, c, L, epsilon, delta) : false
    const dCrit = mostrarED ? deltaMaximo(f, c, L, epsilon, 1.5) : null
    const imanesDelta = dCrit === null ? [0.1, 0.5, 1] : [0.1, 0.5, 1, dCrit]
    const colorED = ok ? 'fill-emerald-500' : 'fill-amber-500'

    const punteado = '4 4'

    const proyeccion = (x: number, y: number, clase: string) => {
      if (!Number.isFinite(y)) return null
      const P = S(x, y)
      const X = S(x, 0)
      const Y = S(0, y)
      return (
        <g>
          <line x1={P.x} y1={P.y} x2={X.x} y2={X.y} className={clase} strokeWidth={1.5} strokeDasharray={punteado} />
          <line x1={P.x} y1={P.y} x2={Y.x} y2={Y.y} className={clase} strokeWidth={1.5} strokeDasharray={punteado} />
          <circle cx={P.x} cy={P.y} r={6} className={clase.replace('stroke-', 'fill-')} />
        </g>
      )
    }

    const panelBorde = mostrarED ? (ok ? 'border-emerald-500' : 'border-amber-500') : 'border-zinc-800'

    return (
      <HTMLContainer
        id={shape.id}
        style={{ pointerEvents: 'all' }}
        className="w-full h-full bg-zinc-950 border-2 border-purple-500/60 rounded-xl p-3 text-white shadow-2xl flex flex-col gap-2 select-none pointer-events-auto"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
          Límite de una función · {p.label}
        </span>

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

              {/* Franjas ε-δ */}
              {mostrarED && (
                <g className={colorED} fillOpacity={0.15}>
                  <rect x={bx} y={-(L + epsilon) * u} width={bw} height={2 * epsilon * u} />
                  <rect x={(c - delta) * u} y={by} width={2 * delta * u} height={bh} />
                </g>
              )}

              {/* Recta x = c */}
              <line
                x1={c * u}
                y1={by}
                x2={c * u}
                y2={by + bh}
                className={esAsintota ? 'stroke-fuchsia-500' : 'stroke-zinc-500'}
                strokeWidth={esAsintota ? 2 : 1}
                strokeDasharray={esAsintota ? '8 6' : punteado}
              />

              {/* Curva */}
              {paths.map((d, i) => (
                <path key={i} d={d} fill="none" className="stroke-violet-400" strokeWidth={2.5} />
              ))}

              {/* Puntos en c */}
              {huecos.map((y) => {
                const P = S(c, y)
                return <circle key={`h${y}`} cx={P.x} cy={P.y} r={6} className="fill-zinc-950 stroke-violet-400" strokeWidth={2} />
              })}
              {fc !== null && (() => {
                const P = S(c, fc)
                return <circle cx={P.x} cy={P.y} r={6} className="fill-violet-400" />
              })()}

              {/* Laterales */}
              {modo === 'laterales' && (
                <>
                  {proyeccion(c - dist, yIzq, 'stroke-purple-300')}
                  {proyeccion(c + dist, yDer, 'stroke-indigo-400')}
                </>
              )}
            </g>
          </svg>
        </div>

        {/* Panel de lectura */}
        <div className={`bg-zinc-900 font-mono text-xs rounded-lg p-2 border-2 ${panelBorde} space-y-1`}>
          {modo === 'laterales' ? (
            <>
              <div className="flex gap-4">
                <span className="text-purple-300">f(c−h) = {fmtY(yIzq)}</span>
                <span className="text-indigo-300">f(c+h) = {fmtY(yDer)}</span>
                <span className="text-zinc-400">h = {formatEs(dist)}</span>
              </div>
              <div className="flex gap-4 text-zinc-300">
                <span>L⁻ = {fmtL(Lizq)}</span>
                <span>L⁺ = {fmtL(Lder)}</span>
                <span>f(c) = {fc === null ? 'no definida' : formatEs(fc)}</span>
              </div>
              <div className="text-fuchsia-300 font-bold">{conclusion}</div>
            </>
          ) : esAsintota ? (
            <div className="text-fuchsia-300">L = +∞: la definición usa M en lugar de ε</div>
          ) : (
            <>
              <div className="text-zinc-300">
                L = {formatEs(L)} · ε = {formatEs(epsilon)}, δ = {formatEs(delta)}
              </div>
              <div className={ok ? 'text-emerald-400' : 'text-amber-400'}>
                {ok
                  ? '✔ |f(x) − L| < ε para todo x en el entorno reducido'
                  : '✘ hay x con 0<|x−c|<δ fuera de la franja'}
              </div>
            </>
          )}
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
                onClick={() => actualizar({ preset: k })}
                className={`px-2 py-0.5 rounded-full text-white cursor-pointer ${
                  k === preset ? 'bg-fuchsia-600' : 'bg-purple-600/80 hover:bg-purple-500'
                }`}
              >
                {PRESETS[k].label}
              </button>
            ))}
            <button
              onClick={() => actualizar({ modo: modo === 'laterales' ? 'epsilon-delta' : 'laterales' })}
              className="ml-auto px-2 py-0.5 rounded-full bg-indigo-600/80 hover:bg-indigo-500 text-white cursor-pointer"
            >
              Modo: {modo === 'laterales' ? 'Laterales' : 'ε-δ'}
            </button>
          </div>

          {modo === 'laterales' && (
            <label className="flex items-center justify-between gap-2 font-mono text-purple-300">
              h = {formatEs(dist)}
              <input
                type="range"
                min={0.01}
                max={1.5}
                step="any"
                value={dist}
                onChange={(e) => actualizar({ dist: acotar(ajustar(Number(e.target.value), 0.01, [0.1, 0.5, 1]), 0.01, 1.5) })}
                className="w-64 accent-purple-500 cursor-pointer"
              />
            </label>
          )}

          {mostrarED && (
            <>
              <label className="flex items-center justify-between gap-2 font-mono text-fuchsia-300">
                ε = {formatEs(epsilon)}
                <input
                  type="range"
                  min={0.05}
                  max={2}
                  step="any"
                  value={epsilon}
                  onChange={(e) =>
                    actualizar({ epsilon: acotar(ajustar(Number(e.target.value), 0.05, [0.1, 0.25, 0.5, 1]), 0.05, 2) })
                  }
                  className="w-64 accent-fuchsia-500 cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between gap-2 font-mono text-indigo-300">
                δ = {formatEs(delta)}
                <input
                  type="range"
                  min={0.01}
                  max={1.5}
                  step="any"
                  value={delta}
                  onChange={(e) => actualizar({ delta: acotar(ajustar(Number(e.target.value), 0.05, imanesDelta), 0.01, 1.5) })}
                  className="w-64 accent-indigo-500 cursor-pointer"
                />
              </label>
            </>
          )}
        </div>
      </HTMLContainer>
    )
  }

  override indicator(shape: LimiteShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />
  }

  override getIndicatorPath(shape: LimiteShape): Path2D {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 12)
    return path
  }
}
