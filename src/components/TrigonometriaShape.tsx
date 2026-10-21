'use client'

import { HTMLContainer, type TLShape } from 'tldraw'
import { LabShapeUtil } from '@/components/LabShapeUtil'
import { trigonometriaProps, trigonometriaDefaults } from '@/shapes/schemas'
import { ajustar, samplePaths, type Fn, type Ventana } from '@/lib/plot'
import { toSvg, formatEs } from '@/lib/linear2d'
import { NOTABLES, fraccionPi, exactos } from '@/lib/trig'

type Bandera = 'verTan' | 'verCos'

export type TrigonometriaShape = TLShape<'trigonometria-circulo'>

const PI = Math.PI
const OX = 1.8
const V_CIRCULO: Ventana = { xMin: -1.4, xMax: 8.4, yMin: -2.2, yMax: 2.2 }
const V_ONDA: Ventana = { xMin: -PI, xMax: 3 * PI, yMin: -3, yMax: 3 }
const V_TRAMO: Ventana = { xMin: OX, xMax: OX + 2 * PI, yMin: -2.2, yMax: 2.2 }
const MARCAS_T = [1, 2, 3, 4].map((k) => (k * PI) / 2)
const MARCAS_ONDA = Array.from({ length: 9 }, (_, k) => -PI + (k * PI) / 2)
const IMANES_FASE = Array.from({ length: 9 }, (_, k) => ((k - 4) * PI) / 4)
const CHECKS: { clave: Bandera; label: string }[] = [
  { clave: 'verTan', label: 'tan θ' },
  { clave: 'verCos', label: 'Onda cos' },
]
const ANCHO = 600
const EPS = 1e-9

export class TrigonometriaShapeUtil extends LabShapeUtil<TrigonometriaShape> {
  static override type = 'trigonometria-circulo' as const

  static override props = trigonometriaProps

  override getDefaultProps(): TrigonometriaShape['props'] {
    return { ...trigonometriaDefaults }
  }

  override contenido(shape: TrigonometriaShape) {
    const { modo, theta, verTan, verCos, amp: A, freq: B, fase: C } = shape.props
    const circulo = modo === 'circulo'
    const v = circulo ? V_CIRCULO : V_ONDA
    const u = ANCHO / (v.xMax - v.xMin)
    const uid = shape.id.replace(/[^a-zA-Z0-9]/g, '')

    const actualizar = (props: Partial<TrigonometriaShape['props']>) => {
      this.editor.updateShape<TrigonometriaShape>({ id: shape.id, type: 'trigonometria-circulo', props })
    }

    const boton = (activo: boolean) =>
      `px-2 py-0.5 rounded-full text-white cursor-pointer ${activo ? 'bg-fuchsia-600' : 'bg-purple-600/80 hover:bg-purple-500'}`

    const S = (x: number, y: number) => toSvg({ x, y }, u)
    const seg = (x1: number, y1: number, x2: number, y2: number) => {
      const P = S(x1, y1)
      const Q = S(x2, y2)
      return { x1: P.x, y1: P.y, x2: Q.x, y2: Q.y }
    }

    const bx = v.xMin * u
    const by = -v.yMax * u
    const bw = (v.xMax - v.xMin) * u
    const bh = (v.yMax - v.yMin) * u

    const curva = (
      g: Fn,
      vent: Ventana,
      clase: string,
      extra: { strokeWidth: number; strokeDasharray?: string; strokeOpacity?: number },
      k: string,
    ) => samplePaths(g, vent, [], u).map((d, i) => <path key={`${k}${i}`} d={d} fill="none" className={clase} {...extra} />)

    // Círculo
    const c = Math.cos(theta)
    const s = Math.sin(theta)
    const tg = s / c
    const ex = exactos(theta)
    const grados = Math.round((theta * 180) / PI)
    const Pθ = S(c, s)
    const Pw = S(OX + theta, s)
    const rArco = 0.25 * u
    const arco =
      theta >= 2 * PI - 1e-6
        ? null
        : `M${rArco},0 A${rArco},${rArco} 0 ${theta > PI ? 1 : 0} 0 ${rArco * c},${-rArco * s}`
    const mostrarTan = verTan && Math.abs(c) > 0.08

    // Onda
    const despl = -C / B
    const T_ = (2 * PI) / B
    const textoA = Math.abs(A - 1) < EPS ? '' : `${formatEs(A)}·`
    const textoB = Math.abs(B - 1) < EPS ? 'x' : `${formatEs(B)}x`
    const textoC = Math.abs(C) < EPS ? '' : C > 0 ? ` + ${fraccionPi(C)}` : ` − ${fraccionPi(-C)}`
    const textoDesfase =
      Math.abs(C) < EPS
        ? 'sin desfase'
        : `Desfase −C/B = ${fraccionPi(despl)} → se corre a la ${despl < 0 ? 'izquierda' : 'derecha'}`

    const fila = (nombre: string, exacto: string | undefined, valor: number, clase: string) => (
      <span className={`w-full ${clase}`}>
        {nombre} θ = {exacto !== undefined ? exacto : ''}
        {exacto === 'no existe' ? '' : `${exacto !== undefined ? ' ' : ''}≈ ${formatEs(valor, 4)}`}
      </span>
    )

    return (
      <HTMLContainer
        id={shape.id}
        style={{ pointerEvents: 'all' }}
        className="w-full h-full bg-zinc-950 border-2 border-purple-500/60 rounded-xl p-3 text-white shadow-2xl flex flex-col gap-2 select-none pointer-events-auto"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
          Trigonometría · {circulo ? 'Círculo unitario' : 'Transformación de onda'}
        </span>

        {/* Panel */}
        <div className="bg-zinc-900 font-mono text-xs rounded-lg p-2 border border-zinc-800 flex flex-wrap gap-x-4 gap-y-1">
          {circulo ? (
            ex ? (
              <>
                <span className="w-full text-violet-300">
                  θ = {fraccionPi(theta)} ({ex.grados}°) · Cuadrante {ex.cuadrante}
                </span>
                {fila('sen', ex.sen, s, 'text-fuchsia-300')}
                {fila('cos', ex.cos, c, 'text-indigo-300')}
                {fila('tan', ex.tan, tg, 'text-amber-300')}
              </>
            ) : (
              <>
                <span className="w-full text-violet-300">
                  θ ≈ {formatEs(theta, 4)} rad ({grados}°)
                </span>
                {fila('sen', undefined, s, 'text-fuchsia-300')}
                {fila('cos', undefined, c, 'text-indigo-300')}
                {Math.abs(c) < EPS ? (
                  <span className="w-full text-amber-300">tan θ = no existe</span>
                ) : (
                  fila('tan', undefined, tg, 'text-amber-300')
                )}
              </>
            )
          ) : (
            <>
              <span className="w-full text-violet-300">
                y = {textoA}sen({textoB}
                {textoC})
              </span>
              <span className="text-fuchsia-300">
                Período T = 2π/B ≈ {formatEs(T_, 3)}
              </span>
              <span className="text-indigo-300">{textoDesfase}</span>
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
              {circulo ? (
                <>
                  {/* Ejes del círculo y eje t de la onda */}
                  <g className="stroke-zinc-700" strokeWidth={1}>
                    <line {...seg(-1.3, 0, 1.3, 0)} />
                    <line {...seg(0, v.yMin, 0, v.yMax)} />
                    <line {...seg(OX, -1.3, OX, 1.3)} />
                  </g>
                  <line {...seg(OX, 0, OX + 2 * PI, 0)} className="stroke-zinc-500" strokeWidth={1.5} />
                  {MARCAS_T.map((t) => {
                    const P = S(OX + t, 0)
                    return (
                      <g key={`t${t}`}>
                        <line x1={P.x} y1={P.y - 4} x2={P.x} y2={P.y + 4} className="stroke-zinc-500" strokeWidth={1.5} />
                        <text x={P.x} y={P.y + 16} textAnchor="middle" className="fill-zinc-400 text-[11px] font-mono">
                          {fraccionPi(t)}
                        </text>
                      </g>
                    )
                  })}

                  {/* Tangente */}
                  {mostrarTan && (
                    <>
                      <line {...seg(1, v.yMin, 1, v.yMax)} className="stroke-zinc-700" strokeWidth={1} strokeDasharray="2 4" />
                      <line {...seg(c, s, 1, tg)} className="stroke-amber-400" strokeWidth={1.5} strokeDasharray="4 4" />
                      <line {...seg(1, 0, 1, tg)} className="stroke-amber-400" strokeWidth={3} />
                    </>
                  )}

                  <circle cx={0} cy={0} r={u} fill="none" className="stroke-zinc-400" strokeWidth={1.5} />
                  {arco && <path d={arco} fill="none" className="stroke-violet-300" strokeWidth={1.5} />}
                  {!arco && <circle cx={0} cy={0} r={rArco} fill="none" className="stroke-violet-300" strokeWidth={1.5} />}

                  <line {...seg(0, 0, c, 0)} className="stroke-indigo-400" strokeWidth={3} />
                  <line {...seg(c, 0, c, s)} className="stroke-fuchsia-400" strokeWidth={3} />
                  <line {...seg(0, 0, c, s)} className="stroke-violet-200" strokeWidth={2.5} />

                  {/* Ondas */}
                  {verCos &&
                    curva((x) => Math.cos(x - OX), V_TRAMO, 'stroke-indigo-400', { strokeWidth: 2, strokeDasharray: '6 4' }, 'c')}
                  {curva((x) => Math.sin(x - OX), V_TRAMO, 'stroke-violet-300', { strokeWidth: 2.5 }, 's')}

                  <line {...seg(c, s, OX + theta, s)} className="stroke-zinc-400" strokeWidth={1} strokeDasharray="3 4" />
                  <line {...seg(OX + theta, 0, OX + theta, s)} className="stroke-fuchsia-400" strokeWidth={2.5} />
                  <circle cx={Pw.x} cy={Pw.y} r={5} className="fill-fuchsia-400" />
                  <circle cx={Pθ.x} cy={Pθ.y} r={6} className="fill-violet-200" />
                </>
              ) : (
                <>
                  {/* Grilla cada π/2 */}
                  <g className="stroke-zinc-800" strokeWidth={1}>
                    {MARCAS_ONDA.map((x) => (
                      <line key={`gx${x}`} {...seg(x, v.yMin, x, v.yMax)} />
                    ))}
                    {[-2, -1, 1, 2].map((k) => (
                      <line key={`gy${k}`} {...seg(v.xMin, k, v.xMax, k)} />
                    ))}
                  </g>
                  <g className="stroke-zinc-500" strokeWidth={1.5}>
                    <line {...seg(v.xMin, 0, v.xMax, 0)} />
                    <line {...seg(0, v.yMin, 0, v.yMax)} />
                  </g>
                  {MARCAS_ONDA.filter((x) => Math.abs(x) > EPS).map((x) => {
                    const P = S(x, 0)
                    return (
                      <text key={`m${x}`} x={P.x} y={P.y + 16} textAnchor="middle" className="fill-zinc-400 text-[11px] font-mono">
                        {fraccionPi(x)}
                      </text>
                    )
                  })}

                  <rect
                    x={S(despl, 0).x}
                    y={by}
                    width={T_ * u}
                    height={bh}
                    className="fill-fuchsia-500"
                    fillOpacity={0.1}
                  />

                  {curva(Math.sin, v, 'stroke-zinc-600', { strokeWidth: 1.5 }, 'ref')}
                  {curva((x) => A * Math.sin(B * x + C), v, 'stroke-violet-300', { strokeWidth: 2.5 }, 'y')}
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
            <button onClick={() => actualizar({ modo: 'circulo' })} className={boton(circulo)}>
              Círculo
            </button>
            <button onClick={() => actualizar({ modo: 'onda' })} className={boton(!circulo)}>
              Onda
            </button>
            {circulo && (
              <div className="ml-auto flex items-center gap-3">
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

          {circulo ? (
            <label className="flex items-center justify-between gap-2 font-mono text-purple-300">
              θ = {ex ? fraccionPi(theta) : formatEs(theta, 3)}
              <input
                type="range"
                min={0}
                max={2 * PI}
                step="any"
                value={theta}
                onChange={(e) => actualizar({ theta: ajustar(Number(e.target.value), PI / 24, NOTABLES) })}
                className="w-80 accent-purple-500 cursor-pointer"
              />
            </label>
          ) : (
            <>
              <label className="flex items-center justify-between gap-2 font-mono text-violet-300">
                A = {formatEs(A)}
                <input
                  type="range"
                  min={0.5}
                  max={2.5}
                  step="any"
                  value={A}
                  onChange={(e) => actualizar({ amp: ajustar(Number(e.target.value), 0.1, [1, 2]) })}
                  className="w-80 accent-purple-500 cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between gap-2 font-mono text-fuchsia-300">
                B = {formatEs(B)}
                <input
                  type="range"
                  min={0.5}
                  max={3}
                  step="any"
                  value={B}
                  onChange={(e) => actualizar({ freq: ajustar(Number(e.target.value), 0.1, [0.5, 1, 2, 3]) })}
                  className="w-80 accent-fuchsia-500 cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between gap-2 font-mono text-indigo-300">
                C = {fraccionPi(C)}
                <input
                  type="range"
                  min={-PI}
                  max={PI}
                  step="any"
                  value={C}
                  onChange={(e) => actualizar({ fase: ajustar(Number(e.target.value), PI / 24, IMANES_FASE) })}
                  className="w-80 accent-indigo-500 cursor-pointer"
                />
              </label>
            </>
          )}
        </div>
      </HTMLContainer>
    )
  }

  override indicator(shape: TrigonometriaShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />
  }

  override getIndicatorPath(shape: TrigonometriaShape): Path2D {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 12)
    return path
  }
}
