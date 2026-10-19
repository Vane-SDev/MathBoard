'use client'

import { BaseBoxShapeUtil, HTMLContainer, RecordProps, T, TLBaseShape } from 'tldraw'
import { polar, samplePolarPaths, riemannPolar, sectorPath, type FnPolar, type TramoPolar, ajustar, acotar } from '@/lib/plot'
import { NOTABLES, fraccionPi } from '@/lib/trig'
import { formatEs } from '@/lib/linear2d'

type Preset = 'cardioide' | 'rosa' | 'circulo' | 'espiral'
type Modo = 'trazado' | 'area'

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    'coordenadas-polares': {
      w: number
      h: number
      preset: 'cardioide' | 'rosa' | 'circulo' | 'espiral'
      modo: 'trazado' | 'area'
      theta: number
      alfa: number
      beta: number
      n: number
    }
  }
}

export type PolaresShape = TLBaseShape<
  'coordenadas-polares',
  {
    w: number
    h: number
    preset: Preset
    modo: Modo
    theta: number
    alfa: number
    beta: number
    n: number
  }
>

type PresetDef = {
  label: string
  r: FnPolar
  G: FnPolar
  texto: string
  alfaDef: number
  betaDef: number
}

const PI = Math.PI
const PASO = PI / 24

const PRESETS: Record<Preset, PresetDef> = {
  cardioide: {
    label: 'Cardioide',
    r: (t) => 1 + Math.cos(t),
    G: (t) => (3 * t) / 4 + Math.sin(t) + Math.sin(2 * t) / 8,
    texto: 'r = 1 + cos θ',
    alfaDef: 0,
    betaDef: 2 * PI,
  },
  rosa: {
    label: 'Rosa',
    r: (t) => 2 * Math.cos(2 * t),
    G: (t) => t + Math.sin(4 * t) / 4,
    texto: 'r = 2·cos 2θ',
    alfaDef: 0,
    betaDef: 2 * PI,
  },
  circulo: {
    label: 'Círculo',
    r: (t) => 2 * Math.cos(t),
    G: (t) => t + Math.sin(2 * t) / 2,
    texto: 'r = 2·cos θ',
    alfaDef: 0,
    betaDef: PI,
  },
  espiral: {
    label: 'Espiral',
    r: (t) => 0.35 * t,
    G: (t) => (0.1225 * t ** 3) / 6,
    texto: 'r = 0,35·θ',
    alfaDef: 0,
    betaDef: 2 * PI,
  },
}

const ORDEN: Preset[] = ['cardioide', 'rosa', 'circulo', 'espiral']
const R = 3.2
const LADO = 500
const U = LADO / (2 * R)
const RAYOS = Array.from({ length: 12 }, (_, i) => (i * PI) / 6)
const ETIQUETAS: { t: number; txt: string }[] = [
  { t: 0, txt: '0' },
  { t: PI / 2, txt: 'π/2' },
  { t: PI, txt: 'π' },
  { t: (3 * PI) / 2, txt: '3π/2' },
]

export class PolaresShapeUtil extends BaseBoxShapeUtil<PolaresShape> {
  static override type = 'coordenadas-polares' as const

  static override props: RecordProps<PolaresShape> = {
    w: T.number,
    h: T.number,
    preset: T.literalEnum('cardioide', 'rosa', 'circulo', 'espiral'),
    modo: T.literalEnum('trazado', 'area'),
    theta: T.number,
    alfa: T.number,
    beta: T.number,
    n: T.number,
  }

  override getDefaultProps(): PolaresShape['props'] {
    return { w: 580, h: 700, preset: 'cardioide', modo: 'trazado', theta: PI, alfa: 0, beta: 2 * PI, n: 12 }
  }

  override component(shape: PolaresShape) {
    const { preset, modo, theta, alfa, beta, n } = shape.props
    const p = PRESETS[preset]
    const { r, G } = p
    const uid = shape.id.replace(/[^a-zA-Z0-9]/g, '')
    const trazado = modo === 'trazado'

    const actualizar = (props: Partial<PolaresShape['props']>) => {
      this.editor.updateShape<PolaresShape>({ id: shape.id, type: 'coordenadas-polares', props })
    }

    const boton = (activo: boolean) =>
      `px-2 py-0.5 rounded-full text-white cursor-pointer ${activo ? 'bg-fuchsia-600' : 'bg-purple-600/80 hover:bg-purple-500'}`

    const tramos = (lista: TramoPolar[], ancho: number) =>
      lista.map((tr, i) => (
        <path
          key={i}
          d={tr.d}
          fill="none"
          className={tr.negativo ? 'stroke-amber-400' : 'stroke-violet-400'}
          strokeWidth={ancho}
        />
      ))

    const rayoPunteado = (t: number, key: string) => {
      const P = polar(R, t, U)
      return <line key={key} x1={0} y1={0} x2={P.x} y2={P.y} className="stroke-zinc-400" strokeWidth={1.5} strokeDasharray="5 5" />
    }

    // Trazado
    const rt = r(theta)
    const negativo = rt < 0
    const Pt = polar(rt, theta, U)

    // Área
    const { sectores, suma } = riemannPolar(r, alfa, beta, n)
    const exacto = G(beta) - G(alfa)
    const error = Math.abs(suma - exacto)

    const v0 = -R * U
    const lado = 2 * R * U


    return (
      <HTMLContainer
        id={shape.id}
        style={{ pointerEvents: 'all' }}
        className="w-full h-full bg-zinc-950 border-2 border-purple-500/60 rounded-xl p-3 text-white shadow-2xl flex flex-col gap-2 select-none pointer-events-auto"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
          Coordenadas Polares · {p.label} · {trazado ? 'Trazado' : 'Área'}
        </span>

        {/* Panel */}
        <div className="bg-zinc-900 font-mono text-xs rounded-lg p-2 border border-zinc-800 flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-violet-300">{p.texto}</span>
          {trazado ? (
            <>
              <span className="text-fuchsia-300">θ = {fraccionPi(theta)}</span>
              <span className="text-indigo-300">r(θ) = {formatEs(rt, 3)}</span>
              <span className="text-zinc-300">
                (x, y) = ({formatEs(rt * Math.cos(theta), 3)}; {formatEs(rt * Math.sin(theta), 3)})
              </span>
              {negativo && <span className="text-amber-400">r &lt; 0: el punto se refleja a θ + π</span>}
            </>
          ) : (
            <>
              <span className="text-purple-300">Sₙ = {formatEs(suma, 4)}</span>
              <span className="text-violet-300">Exacto ½∫r²dθ = G(β)−G(α) = {formatEs(exacto, 4)}</span>
              <span className="text-amber-400">Error = {formatEs(error, 4)}</span>
              <span className="text-zinc-300">
                α = {fraccionPi(alfa)}, β = {fraccionPi(beta)}
              </span>
            </>
          )}
        </div>

        <div className="flex-1 min-h-0 flex items-center justify-center">
          <svg viewBox={`${v0} ${v0} ${lado} ${lado}`} className="h-full aspect-square border border-zinc-800 rounded">
            <defs>
              <clipPath id={`clip-${uid}`}>
                <rect x={v0} y={v0} width={lado} height={lado} />
              </clipPath>
            </defs>

            <g clipPath={`url(#clip-${uid})`}>
              {/* Grilla polar */}
              <g className="stroke-zinc-800" strokeWidth={1}>
                {RAYOS.map((t, i) => {
                  const P = polar(R, t, U)
                  return <line key={`r${i}`} x1={0} y1={0} x2={P.x} y2={P.y} />
                })}
              </g>
              <g className="stroke-zinc-700" strokeWidth={1} fill="none">
                <line x1={v0} y1={0} x2={-v0} y2={0} />
                <line x1={0} y1={v0} x2={0} y2={-v0} />
                {[1, 2, 3].map((k) => (
                  <circle key={`c${k}`} cx={0} cy={0} r={k * U} />
                ))}
              </g>
              {ETIQUETAS.map(({ t, txt }) => {
                const P = polar(3, t, U)
                return (
                  <text
                    key={txt}
                    x={P.x}
                    y={P.y}
                    dx={4}
                    dy={-4}
                    className="fill-zinc-500 text-[10px]"
                  >
                    {txt}
                  </text>
                )
              })}

              {/* Curva completa de fondo */}
              {samplePolarPaths(r, 0, 2 * PI, U).map((tr, i) => (
                <path key={`bg${i}`} d={tr.d} fill="none" className="stroke-zinc-600" strokeOpacity={0.35} strokeWidth={2} />
              ))}

              {trazado ? (
                <>
                  {tramos(samplePolarPaths(r, 0, theta, U), 2.5)}
                  {negativo && rayoPunteado(theta, 'neg')}
                  <line
                    x1={0}
                    y1={0}
                    x2={Pt.x}
                    y2={Pt.y}
                    className={negativo ? 'stroke-amber-400' : 'stroke-fuchsia-400'}
                    strokeWidth={2}
                  />
                  <circle cx={Pt.x} cy={Pt.y} r={6} className={negativo ? 'fill-amber-400' : 'fill-fuchsia-400'} />
                </>
              ) : (
                <>
                  {sectores.map((s, i) => (
                    <path
                      key={`s${i}`}
                      d={sectorPath(s, U)}
                      className={s.rad >= 0 ? 'fill-purple-500 stroke-purple-300' : 'fill-amber-500 stroke-amber-300'}
                      fillOpacity={0.4}
                      strokeWidth={1}
                    />
                  ))}
                  {tramos(samplePolarPaths(r, alfa, beta, U), 2.5)}
                  {rayoPunteado(alfa, 'alfa')}
                  {rayoPunteado(beta, 'beta')}
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
                onClick={() => actualizar({ preset: k, alfa: PRESETS[k].alfaDef, beta: PRESETS[k].betaDef })}
                className={boton(k === preset)}
              >
                {PRESETS[k].label}
              </button>
            ))}
            <button
              onClick={() => actualizar({ modo: trazado ? 'area' : 'trazado' })}
              className="ml-auto px-2 py-0.5 rounded-full bg-indigo-600/80 hover:bg-indigo-500 text-white cursor-pointer"
            >
              Modo: {trazado ? 'Trazado' : 'Área'}
            </button>
          </div>

          {trazado ? (
            <label className="flex items-center justify-between gap-2 font-mono text-fuchsia-300">
              θ = {fraccionPi(theta)}
              <input
                type="range"
                min={0}
                max={2 * PI}
                step="any"
                value={theta}
                onChange={(e) => actualizar({ theta: acotar(ajustar(Number(e.target.value), Math.PI / 24, NOTABLES), 0, 2 * PI) })}
                className="w-64 accent-fuchsia-500 cursor-pointer"
              />
            </label>
          ) : (
            <>
              <label className="flex items-center justify-between gap-2 font-mono text-purple-300">
                α = {fraccionPi(alfa)}
                <input
                  type="range"
                  min={0}
                  max={beta - PASO}
                  step="any"
                  value={alfa}
                  onChange={(e) => actualizar({ alfa: acotar(ajustar(Number(e.target.value), Math.PI / 24, NOTABLES), 0, beta - Math.PI / 24) })}
                  className="w-64 accent-purple-500 cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between gap-2 font-mono text-indigo-300">
                β = {fraccionPi(beta)}
                <input
                  type="range"
                  min={alfa + PASO}
                  max={2 * PI}
                  step="any"
                  value={beta}
                  onChange={(e) => actualizar({ beta: acotar(ajustar(Number(e.target.value), Math.PI / 24, NOTABLES), alfa + Math.PI / 24, 2 * PI) })}
                  className="w-64 accent-indigo-500 cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between gap-2 font-mono text-fuchsia-300">
                n = {n}
                <input
                  type="range"
                  min={4}
                  max={48}
                  step={1}
                  value={n}
                  onChange={(e) => actualizar({ n: Number(e.target.value) })}
                  className="w-64 accent-fuchsia-500 cursor-pointer"
                />
              </label>
            </>
          )}
        </div>
      </HTMLContainer>
    )
  }

  override indicator(shape: PolaresShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />
  }

  override getIndicatorPath(shape: PolaresShape): Path2D {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 12)
    return path
  }
}
