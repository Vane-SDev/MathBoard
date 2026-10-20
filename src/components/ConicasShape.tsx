'use client'

import { BaseBoxShapeUtil, HTMLContainer, type TLShape } from 'tldraw'
import { conicasProps, conicasDefaults } from '@/shapes/schemas'
import type { TipoConica as Tipo } from '@/shapes/schemas'
import { acotar, ajustar, pathParametrico, rectaVentana, type Ventana } from '@/lib/plot'
import { toSvg, formatEs, type Vec2 } from '@/lib/linear2d'
import { NOTABLES, fraccionPi } from '@/lib/trig'

export type ConicasShape = TLShape<'conicas'>

const PI = Math.PI
const V: Ventana = { xMin: -8, xMax: 8, yMin: -6, yMax: 6 }
const ANCHO = 600
const EPS = 1e-9
const ORDEN: { tipo: Tipo; label: string }[] = [
  { tipo: 'circunferencia', label: 'Circunferencia' },
  { tipo: 'elipse', label: 'Elipse' },
  { tipo: 'parabola', label: 'Parábola' },
  { tipo: 'hiperbola', label: 'Hipérbola' },
]
const IMANES_AB = [1, 2, 3, 4]
const IMANES_P = [-1, -0.5, 0.5, 1]

const enteros = (lo: number, hi: number) =>
  Array.from({ length: Math.floor(hi) - Math.ceil(lo) + 1 }, (_, i) => Math.ceil(lo) + i)

/** "x", "(x − 1)" o "(x + 2)" según el centro */
const desplazado = (variable: string, centro: number): string =>
  Math.abs(centro) < EPS ? variable : `(${variable} ${centro > 0 ? '−' : '+'} ${formatEs(Math.abs(centro))})`

const dist = (P: Vec2, Q: Vec2) => Math.hypot(P.x - Q.x, P.y - Q.y)
const punto = (P: Vec2) => `(${formatEs(P.x)}; ${formatEs(P.y)})`

export class ConicasShapeUtil extends BaseBoxShapeUtil<ConicasShape> {
  static override type = 'conicas' as const

  static override props = conicasProps

  override getDefaultProps(): ConicasShape['props'] {
    return { ...conicasDefaults }
  }

  override component(shape: ConicasShape) {
    const { tipo, orientacion, cx, cy, a, b, p, t } = shape.props
    const u = ANCHO / (V.xMax - V.xMin)
    const uid = shape.id.replace(/[^a-zA-Z0-9]/g, '')
    const horizontal = orientacion === 'horizontal'
    const angular = tipo === 'circunferencia' || tipo === 'elipse'

    const actualizar = (props: Partial<ConicasShape['props']>) => {
      this.editor.updateShape<ConicasShape>({ id: shape.id, type: 'conicas', props })
    }

    const boton = (activo: boolean) =>
      `px-2 py-0.5 rounded-full text-white cursor-pointer ${activo ? 'bg-fuchsia-600' : 'bg-purple-600/80 hover:bg-purple-500'}`

    const S = (x: number, y: number) => toSvg({ x, y }, u)
    const seg = (x1: number, y1: number, x2: number, y2: number) => {
      const P = S(x1, y1)
      const Q = S(x2, y2)
      return { x1: P.x, y1: P.y, x2: Q.x, y2: Q.y }
    }
    const segV = (P: Vec2, Q: Vec2) => seg(P.x, P.y, Q.x, Q.y)
    const recta = (x: number, y: number, m: number) => {
      const [P, Q] = rectaVentana(x, y, m, V)
      return segV(P, Q)
    }

    const bx = V.xMin * u
    const by = -V.yMax * u
    const bw = (V.xMax - V.xMin) * u
    const bh = (V.yMax - V.yMin) * u

    const f4 = (n: number) => formatEs(n, 4)
    const X = desplazado('x', cx)
    const Y = desplazado('y', cy)
    const centro: Vec2 = { x: cx, y: cy }

    // Geometría por tipo
    let curvas: string[] = []
    let focos: { P: Vec2; label: string }[] = []
    let P: Vec2 = centro
    let lineas: string[] = []

    if (tipo === 'circunferencia') {
      curvas = [pathParametrico((s) => cx + a * Math.cos(s), (s) => cy + a * Math.sin(s), 0, 2 * PI, u)]
      P = { x: cx + a * Math.cos(t), y: cy + a * Math.sin(t) }
      lineas = [
        `${X}² + ${Y}² = ${formatEs(a * a)}`,
        `Centro ${punto(centro)} · R = ${formatEs(a)}`,
        'e = 0',
      ]
    } else if (tipo === 'elipse') {
      const c = Math.sqrt(Math.abs(a * a - b * b))
      const mayor = Math.max(a, b)
      curvas = [pathParametrico((s) => cx + a * Math.cos(s), (s) => cy + b * Math.sin(s), 0, 2 * PI, u)]
      P = { x: cx + a * Math.cos(t), y: cy + b * Math.sin(t) }
      focos =
        a >= b
          ? [
              { P: { x: cx - c, y: cy }, label: 'F₁' },
              { P: { x: cx + c, y: cy }, label: 'F₂' },
            ]
          : [
              { P: { x: cx, y: cy - c }, label: 'F₁' },
              { P: { x: cx, y: cy + c }, label: 'F₂' },
            ]
      const d1 = dist(P, focos[0].P)
      const d2 = dist(P, focos[1].P)
      lineas = [
        `${X}²/${formatEs(a * a)} + ${Y}²/${formatEs(b * b)} = 1`,
        `c = √|a² − b²| = ${f4(c)} · e = ${f4(c / mayor)}`,
        `PF₁ + PF₂ = ${f4(d1)} + ${f4(d2)} = ${f4(d1 + d2)} = 2·${formatEs(mayor)}`,
      ]
      if (Math.abs(a - b) < EPS) lineas.push('a = b → es una circunferencia (e = 0)')
    } else if (tipo === 'hiperbola') {
      const c = Math.sqrt(a * a + b * b)
      if (horizontal) {
        curvas = [1, -1].map((k) =>
          pathParametrico((s) => cx + k * a * Math.cosh(s), (s) => cy + b * Math.sinh(s), -2.5, 2.5, u),
        )
        P = { x: cx + a * Math.cosh(t), y: cy + b * Math.sinh(t) }
        focos = [
          { P: { x: cx - c, y: cy }, label: 'F₁' },
          { P: { x: cx + c, y: cy }, label: 'F₂' },
        ]
      } else {
        curvas = [1, -1].map((k) =>
          pathParametrico((s) => cx + b * Math.sinh(s), (s) => cy + k * a * Math.cosh(s), -2.5, 2.5, u),
        )
        P = { x: cx + b * Math.sinh(t), y: cy + a * Math.cosh(t) }
        focos = [
          { P: { x: cx, y: cy - c }, label: 'F₁' },
          { P: { x: cx, y: cy + c }, label: 'F₂' },
        ]
      }
      const d1 = dist(P, focos[0].P)
      const d2 = dist(P, focos[1].P)
      const [U1, U2] = horizontal ? [X, Y] : [Y, X]
      lineas = [
        `${U1}²/${formatEs(a * a)} − ${U2}²/${formatEs(b * b)} = 1`,
        `c = √(a² + b²) = ${f4(c)} · e = ${f4(c / a)}`,
        `|PF₁ − PF₂| = ${f4(Math.abs(d1 - d2))} = 2·${formatEs(a)}`,
      ]
    } else {
      const F: Vec2 = horizontal ? { x: cx + p, y: cy } : { x: cx, y: cy + p }
      curvas = [
        horizontal
          ? pathParametrico((s) => cx + p * s * s, (s) => cy + 2 * p * s, -4, 4, u)
          : pathParametrico((s) => cx + 2 * p * s, (s) => cy + p * s * s, -4, 4, u),
      ]
      P = horizontal ? { x: cx + p * t * t, y: cy + 2 * p * t } : { x: cx + 2 * p * t, y: cy + p * t * t }
      focos = [{ P: F, label: 'F' }]
      const dDir = horizontal ? Math.abs(P.x - (cx - p)) : Math.abs(P.y - (cy - p))
      lineas = [
        horizontal ? `${Y}² = ${formatEs(4 * p)}·${X}` : `${X}² = ${formatEs(4 * p)}·${Y}`,
        `Foco F = ${punto(F)} · Directriz ${horizontal ? 'x' : 'y'} = ${formatEs(horizontal ? cx - p : cy - p)}`,
        `Lado recto = |4p| = ${formatEs(Math.abs(4 * p))}`,
        `PF = ${f4(dist(P, F))} = d(P, directriz) = ${f4(dDir)}`,
      ]
    }

    const PS = S(P.x, P.y)
    const CS = S(cx, cy)

    const rango = (
      etiqueta: string,
      valor: number,
      min: number,
      max: number,
      alCambiar: (crudo: number) => void,
      clase: string,
    ) => (
      <label className={`flex items-center justify-between gap-2 font-mono ${clase}`}>
        <span className="w-14 shrink-0 whitespace-nowrap font-mono">{etiqueta}</span>
        <input
          type="range"
          min={min}
          max={max}
          step="any"
          value={valor}
          onChange={(e) => alCambiar(Number(e.target.value))}
          className="w-64 accent-purple-500 cursor-pointer"
        />
      </label>
    )

    return (
      <HTMLContainer
        id={shape.id}
        style={{ pointerEvents: 'all' }}
        className="w-full h-full bg-zinc-950 border-2 border-purple-500/60 rounded-xl p-3 text-white shadow-2xl flex flex-col gap-2 select-none pointer-events-auto"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
          Cónicas · {ORDEN.find((o) => o.tipo === tipo)?.label}
          {!angular && ` · ${horizontal ? 'Horizontal' : 'Vertical'}`}
        </span>

        {/* Panel */}
        <div className="bg-zinc-900 font-mono text-xs rounded-lg p-2 border border-zinc-800 flex flex-col gap-y-1">
          {lineas.map((l, i) => (
            <span key={i} className={i === 0 ? 'text-violet-300' : i === lineas.length - 1 ? 'text-fuchsia-300' : 'text-zinc-300'}>
              {l}
            </span>
          ))}
        </div>

        <div className="w-full aspect-[4/3] shrink-0 rounded-lg border border-zinc-800 bg-zinc-950">
          <svg viewBox={`${bx} ${by} ${bw} ${bh}`} className="w-full h-full border border-zinc-800 rounded">
            <defs>
              <clipPath id={`clip-${uid}`}>
                <rect x={bx} y={by} width={bw} height={bh} />
              </clipPath>
            </defs>

            <g clipPath={`url(#clip-${uid})`}>
              {/* Grilla entera */}
              <g className="stroke-zinc-800" strokeWidth={1}>
                {enteros(V.xMin, V.xMax).map((k) => (
                  <line key={`gx${k}`} x1={k * u} y1={by} x2={k * u} y2={by + bh} />
                ))}
                {enteros(V.yMin, V.yMax).map((k) => (
                  <line key={`gy${k}`} x1={bx} y1={-k * u} x2={bx + bw} y2={-k * u} />
                ))}
              </g>

              {/* Ejes */}
              <g className="stroke-zinc-500" strokeWidth={1.5}>
                <line x1={bx} y1={0} x2={bx + bw} y2={0} />
                <line x1={0} y1={by} x2={0} y2={by + bh} />
              </g>

              {/* Elementos auxiliares */}
              {tipo === 'hiperbola' && (
                <>
                  {[1, -1].map((k) => (
                    <line
                      key={`as${k}`}
                      {...recta(cx, cy, k * (horizontal ? b / a : a / b))}
                      className="stroke-zinc-400"
                      strokeWidth={1}
                      strokeDasharray="6 4"
                    />
                  ))}
                  <rect
                    x={S(cx - (horizontal ? a : b), 0).x}
                    y={S(0, cy + (horizontal ? b : a)).y}
                    width={2 * (horizontal ? a : b) * u}
                    height={2 * (horizontal ? b : a) * u}
                    fill="none"
                    className="stroke-indigo-400"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                </>
              )}

              {tipo === 'parabola' && (
                <>
                  <line
                    {...(horizontal ? seg(cx - p, V.yMin, cx - p, V.yMax) : seg(V.xMin, cy - p, V.xMax, cy - p))}
                    className="stroke-amber-400"
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                  />
                  <line
                    {...(horizontal
                      ? seg(cx + p, cy - 2 * p, cx + p, cy + 2 * p)
                      : seg(cx - 2 * p, cy + p, cx + 2 * p, cy + p))}
                    className="stroke-fuchsia-400"
                    strokeWidth={2}
                  />
                </>
              )}

              {curvas.map((d, i) => (
                <path key={`c${i}`} d={d} fill="none" className="stroke-violet-300" strokeWidth={2.5} />
              ))}

              {/* Segmentos desde P */}
              {tipo === 'circunferencia' && <line {...segV(P, centro)} className="stroke-fuchsia-400" strokeWidth={2} />}
              {(tipo === 'elipse' || tipo === 'hiperbola') && (
                <>
                  <line {...segV(P, focos[0].P)} className="stroke-fuchsia-400" strokeWidth={2} />
                  <line {...segV(P, focos[1].P)} className="stroke-indigo-400" strokeWidth={2} />
                </>
              )}
              {tipo === 'parabola' && (
                <>
                  <line {...segV(P, focos[0].P)} className="stroke-fuchsia-400" strokeWidth={2} />
                  <line
                    {...(horizontal ? seg(P.x, P.y, cx - p, P.y) : seg(P.x, P.y, P.x, cy - p))}
                    className="stroke-amber-400"
                    strokeWidth={2}
                  />
                </>
              )}

              {focos.map(({ P: F, label }) => {
                const Q = S(F.x, F.y)
                return (
                  <g key={label}>
                    <circle cx={Q.x} cy={Q.y} r={5} className="fill-fuchsia-400" />
                    <text x={Q.x + 7} y={Q.y - 7} className="fill-fuchsia-300 text-[11px] font-mono">
                      {label}
                    </text>
                  </g>
                )
              })}

              <circle cx={CS.x} cy={CS.y} r={3} className="fill-white" />
              <circle cx={PS.x} cy={PS.y} r={6} className="fill-violet-200" />
              <text x={PS.x + 8} y={PS.y - 8} className="fill-violet-200 text-[11px] font-mono">
                P
              </text>
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
            {ORDEN.map(({ tipo: k, label }) => (
              <button
                key={k}
                onClick={() => actualizar({ tipo: k, t: k === 'circunferencia' || k === 'elipse' ? PI / 4 : 1 })}
                className={boton(k === tipo)}
              >
                {label}
              </button>
            ))}
            {!angular && (
              <button
                onClick={() => actualizar({ orientacion: horizontal ? 'vertical' : 'horizontal' })}
                className="ml-auto px-2 py-0.5 rounded-full bg-indigo-600/80 hover:bg-indigo-500 text-white cursor-pointer"
              >
                {horizontal ? 'Horizontal' : 'Vertical'}
              </button>
            )}
          </div>

          {rango(`h = ${formatEs(cx)}`, cx, -3, 3, (v) => actualizar({ cx: acotar(ajustar(v, 0.5, [0]), -3, 3) }), 'text-purple-300')}
          {rango(`k = ${formatEs(cy)}`, cy, -3, 3, (v) => actualizar({ cy: acotar(ajustar(v, 0.5, [0]), -3, 3) }), 'text-purple-300')}
          {tipo !== 'parabola' &&
            rango(
              `${tipo === 'circunferencia' ? 'R' : 'a'} = ${formatEs(a)}`,
              a,
              0.5,
              4,
              (v) => actualizar({ a: acotar(ajustar(v, 0.1, IMANES_AB), 0.5, 4) }),
              'text-violet-300',
            )}
          {(tipo === 'elipse' || tipo === 'hiperbola') &&
            rango(`b = ${formatEs(b)}`, b, 0.5, 4, (v) => actualizar({ b: acotar(ajustar(v, 0.1, IMANES_AB), 0.5, 4) }), 'text-violet-300')}
          {tipo === 'parabola' &&
            rango(
              `p = ${formatEs(p)}`,
              p,
              -2,
              2,
              (v) => {
                const q = acotar(ajustar(v, 0.05, IMANES_P), -2, 2)
                actualizar({ p: Math.abs(q) < 0.25 ? 0.25 * (Math.sign(v) || 1) : q })
              },
              'text-amber-300',
            )}
          {angular
            ? rango(
                `t = ${fraccionPi(t)}`,
                t,
                0,
                2 * PI,
                (v) => actualizar({ t: acotar(ajustar(v, PI / 24, NOTABLES), 0, 2 * PI) }),
                'text-fuchsia-300',
              )
            : rango(
                `t = ${formatEs(t)}`,
                t,
                -2.5,
                2.5,
                (v) => actualizar({ t: acotar(ajustar(v, 0.05, [-1, 0, 1]), -2.5, 2.5) }),
                'text-fuchsia-300',
              )}
        </div>
      </HTMLContainer>
    )
  }

  override indicator(shape: ConicasShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />
  }

  override getIndicatorPath(shape: ConicasShape): Path2D {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 12)
    return path
  }
}
