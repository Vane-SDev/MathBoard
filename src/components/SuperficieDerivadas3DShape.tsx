'use client'

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { HTMLContainer, type TLShape } from 'tldraw'
import { LabShapeUtil } from '@/components/LabShapeUtil'
import { superficieDerivadas3DProps, superficieDerivadas3DDefaults, superficieDerivadas3DMigrations } from '@/shapes/schemas'
import type { PresetSuperficie as Preset } from '@/shapes/schemas'
import { acotar, ajustar } from '@/lib/plot'
import { formatEs } from '@/lib/linear2d'
import {
  colorAltura,
  curvasNivel,
  mallaSuperficie,
  ordenarPintor,
  parche,
  planoSubdividido,
  proyectar,
  sombra,
  type Camara,
  type Cara,
  type Vec3,
} from '@/lib/surface3d'

export type SuperficieDerivadas3DShape = TLShape<'superficie-3d'>

type Props = SuperficieDerivadas3DShape['props']
type Fn2 = (x: number, y: number) => number

type PresetDef = {
  label: string
  tf: string
  tfx: string
  tfy: string
  f: Fn2
  fx: Fn2
  fy: Fn2
  fxx: Fn2
  fyy: Fn2
  fxy: Fn2
  zMin: number
  zMax: number
  imanes: number[]
}

const PI = Math.PI
const gauss: Fn2 = (x, y) => 3 * Math.exp(-(x * x + y * y) / 2)

const PRESETS: Record<Preset, PresetDef> = {
  paraboloide: {
    label: 'Paraboloide',
    tf: '4 − 0,5(x² + y²)',
    tfx: '−x',
    tfy: '−y',
    f: (x, y) => 4 - 0.5 * (x * x + y * y),
    fx: (x) => -x,
    fy: (_, y) => -y,
    fxx: () => -1,
    fyy: () => -1,
    fxy: () => 0,
    zMin: -2.5,
    zMax: 4,
    imanes: [0, 1, -1],
  },
  silla: {
    label: 'Silla',
    tf: '0,5(x² − y²)',
    tfx: 'x',
    tfy: '−y',
    f: (x, y) => 0.5 * (x * x - y * y),
    fx: (x) => x,
    fy: (_, y) => -y,
    fxx: () => 1,
    fyy: () => -1,
    fxy: () => 0,
    zMin: -3.2,
    zMax: 3.2,
    imanes: [0, 1, -1],
  },
  ondas: {
    label: 'Ondas',
    tf: 'sen x · cos y',
    tfx: 'cos x · cos y',
    tfy: '−sen x · sen y',
    f: (x, y) => Math.sin(x) * Math.cos(y),
    fx: (x, y) => Math.cos(x) * Math.cos(y),
    fy: (x, y) => -Math.sin(x) * Math.sin(y),
    fxx: (x, y) => -Math.sin(x) * Math.cos(y),
    fyy: (x, y) => -Math.sin(x) * Math.cos(y),
    fxy: (x, y) => -Math.cos(x) * Math.sin(y),
    zMin: -1.5,
    zMax: 1.5,
    imanes: [0, PI / 2, -PI / 2],
  },
  gaussiana: {
    label: 'Gaussiana',
    tf: '3·e^(−(x² + y²)/2)',
    tfx: '−x·f',
    tfy: '−y·f',
    f: gauss,
    fx: (x, y) => -x * gauss(x, y),
    fy: (x, y) => -y * gauss(x, y),
    fxx: (x, y) => (x * x - 1) * gauss(x, y),
    fyy: (x, y) => (y * y - 1) * gauss(x, y),
    fxy: (x, y) => x * y * gauss(x, y),
    zMin: -0.5,
    zMax: 3,
    imanes: [0, 1, -1],
  },
}

const ORDEN: Preset[] = ['paraboloide', 'silla', 'ondas', 'gaussiana']
const DOM = { min: -2.5, max: 2.5 }
const VISTAS: { label: string; cam: Camara }[] = [
  { label: 'Iso', cam: { acimut: -2.2, elevacion: 0.55 } },
  { label: 'Frente', cam: { acimut: 0, elevacion: 0.1 } },
  { label: 'Arriba', cam: { acimut: 0, elevacion: PI / 2 } },
]
const VB_W = 600
const VB_H = 450
const ESCALA_BASE = 62
const EPS = 1e-9

const frenar = (e: { stopPropagation: () => void }) => e.stopPropagation()

/** "x", "(x − 1)" o "(x + 2)" según el centro */
const desplazado = (variable: string, centro: number): string =>
  Math.abs(centro) < EPS ? variable : `(${variable} ${centro > 0 ? '−' : '+'} ${formatEs(Math.abs(centro), 4)})`

const termino = (coef: number, expr: string): string =>
  Math.abs(coef) < EPS ? '' : ` ${coef > 0 ? '+' : '−'} ${formatEs(Math.abs(coef), 4)}·${expr}`

function Superficie({
  id,
  props,
  actualizar,
  empezarGiro,
}: {
  id: string
  props: Props
  actualizar: (p: Partial<Props>) => void
  empezarGiro: () => void
}) {
  const { preset, modo, x0, y0, zoom, verNivel } = props
  const p = PRESETS[preset]
  const uid = id.replace(/[^a-zA-Z0-9]/g, '')
  const parciales = modo === 'parciales'

  // Cámara local mientras se arrastra; al soltar se guarda en props
  const [arrastre, setArrastre] = useState<Camara | null>(null)
  // Giro en vivo: se manda a las props como mucho una vez por cuadro, así la otra pantalla gira a la par
  const envio = useRef<number | null>(null)
  const pendiente = useRef<Camara | null>(null)
  // Malla liviana si giro yo (arrastre) o si gira otra persona (props.girando)
  const moviendo = arrastre !== null || props.girando
  const ultimo = useRef<{ x: number; y: number } | null>(null)
  const acimut = arrastre?.acimut ?? props.acimut
  const elevacion = arrastre?.elevacion ?? props.elevacion
  const cam: Camara = { acimut, elevacion }
  const n = moviendo ? 24 : 40

  const zMid = (p.zMin + p.zMax) / 2
  const k = ESCALA_BASE * zoom
  const pantalla = (q: Vec3) => {
    const r = proyectar({ x: q.x, y: q.y, z: q.z - zMid }, cam)
    return { x: r.X * k, y: -r.Y * k }
  }
  const pts = (qs: Vec3[]) =>
    qs
      .map(pantalla)
      .map((s) => `${s.x.toFixed(1)},${s.y.toFixed(1)}`)
      .join(' ')
  const linea = (qs: Vec3[]) => `M${pts(qs).replaceAll(' ', ' L')}`

  const z0 = p.f(x0, y0)
  const fx = p.fx(x0, y0)
  const fy = p.fy(x0, y0)
  const grad = Math.hypot(fx, fy)

  const malla = useMemo(
    () =>
      mallaSuperficie(p.f, DOM, n, (z, normal) =>
        colorAltura(z, p.zMin, p.zMax, sombra(normal.z < 0 ? { x: -normal.x, y: -normal.y, z: -normal.z } : normal)),
      ),
    [p, n],
  )

  const nivel = useMemo(() => {
    if (parciales || !verNivel) return []
    const m = moviendo ? 24 : 40
    let lo = Infinity
    let hi = -Infinity
    for (let i = 0; i <= m; i++)
      for (let j = 0; j <= m; j++) {
        const z = p.f(DOM.min + ((DOM.max - DOM.min) * i) / m, DOM.min + ((DOM.max - DOM.min) * j) / m)
        lo = Math.min(lo, z)
        hi = Math.max(hi, z)
      }
    const niveles = Array.from({ length: 8 }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / 8)
    return curvasNivel(p.f, DOM, m, niveles, p.zMin)
  }, [p, parciales, verNivel, moviendo])

  const caras = useMemo(() => {
    const zP = p.f(x0, y0)
    const mx = p.fx(x0, y0)
    const my = p.fy(x0, y0)
    const extra: Cara[] = parciales
      ? [
          ...parche(
            (s, t) => ({ x: DOM.min + (DOM.max - DOM.min) * s, y: y0, z: p.zMin + (p.zMax - p.zMin) * t }),
            10,
            '#e879f9',
            0.15,
          ),
          ...parche(
            (s, t) => ({ x: x0, y: DOM.min + (DOM.max - DOM.min) * s, z: p.zMin + (p.zMax - p.zMin) * t }),
            10,
            '#818cf8',
            0.15,
          ),
        ]
      : planoSubdividido(
          (x, y) => zP + mx * (x - x0) + my * (y - y0),
          x0 - 1,
          x0 + 1,
          y0 - 1,
          y0 + 1,
          8,
          '#fbbf24',
          0.35,
        )
    return ordenarPintor([...malla, ...extra], { acimut, elevacion })
  }, [malla, parciales, x0, y0, p, acimut, elevacion])

  // Curvas de corte y tangentes (modo parciales)
  const muestras = Array.from({ length: 81 }, (_, i) => DOM.min + ((DOM.max - DOM.min) * i) / 80)
  const corteX = muestras.map((x) => ({ x, y: y0, z: p.f(x, y0) }))
  const corteY = muestras.map((y) => ({ x: x0, y, z: p.f(x0, y) }))
  const tangente = (d: Vec3) => [
    { x: x0 - 1.2 * d.x, y: y0 - 1.2 * d.y, z: z0 - 1.2 * d.z },
    { x: x0 + 1.2 * d.x, y: y0 + 1.2 * d.y, z: z0 + 1.2 * d.z },
  ]

  // Flecha del gradiente en el piso
  const A = pantalla({ x: x0, y: y0, z: p.zMin })
  const B = pantalla({ x: x0 + fx, y: y0 + fy, z: p.zMin })
  const largo = Math.hypot(B.x - A.x, B.y - A.y)
  const ux = largo > EPS ? (B.x - A.x) / largo : 0
  const uy = largo > EPS ? (B.y - A.y) / largo : 0
  const punta = `${B.x},${B.y} ${B.x - 10 * ux - 5 * uy},${B.y - 10 * uy + 5 * ux} ${B.x - 10 * ux + 5 * uy},${B.y - 10 * uy - 5 * ux}`

  const P = pantalla({ x: x0, y: y0, z: z0 })
  const Ppiso = pantalla({ x: x0, y: y0, z: p.zMin })

  // Piso
  const marcas = Array.from({ length: 11 }, (_, i) => DOM.min + i * 0.5)
  const piso = (x: number, y: number): Vec3 => ({ x, y, z: p.zMin })

  // Clasificación del punto crítico
  const critico = grad < 0.05
  const D = p.fxx(x0, y0) * p.fyy(x0, y0) - p.fxy(x0, y0) ** 2
  const fxx = p.fxx(x0, y0)
  const tipoCritico =
    D > EPS ? (fxx < 0 ? 'máximo local' : 'mínimo local') : D < -EPS ? 'punto de ensilladura' : 'no concluyente'

  const lectura = (d: number, eje: string) =>
    Math.abs(d) < EPS
      ? `si avanzo en ${eje}, z no cambia (pendiente 0)`
      : `si avanzo en ${eje}, z ${d > 0 ? 'sube' : 'baja'} a razón de ${formatEs(Math.abs(d), 4)}`

  const boton = (activo: boolean) =>
    `px-2 py-0.5 rounded-full text-white cursor-pointer ${activo ? 'bg-fuchsia-600' : 'bg-purple-600/80 hover:bg-purple-500'}`

  const alBajar = (e: ReactPointerEvent<SVGSVGElement>) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    ultimo.current = { x: e.clientX, y: e.clientY }
    // Marca de historial: un solo Ctrl+Z deshace todo el giro
    empezarGiro()
    actualizar({ girando: true })
    setArrastre({ acimut: props.acimut, elevacion: props.elevacion })
  }
  const alMover = (e: ReactPointerEvent<SVGSVGElement>) => {
    e.stopPropagation()
    const prev = ultimo.current
    if (!arrastre || !prev) return
    const dx = e.clientX - prev.x
    const dy = e.clientY - prev.y
    ultimo.current = { x: e.clientX, y: e.clientY }
    const nueva = { acimut: arrastre.acimut + dx * 0.01, elevacion: acotar(arrastre.elevacion - dy * 0.01, 0.1, PI / 2) }
    setArrastre(nueva)
    pendiente.current = nueva
    if (envio.current === null) {
      envio.current = requestAnimationFrame(() => {
        envio.current = null
        if (pendiente.current) actualizar(pendiente.current)
      })
    }
  }
  const alSoltar = (e: ReactPointerEvent<SVGSVGElement>) => {
    e.stopPropagation()
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    ultimo.current = null
    if (envio.current !== null) cancelAnimationFrame(envio.current)
    envio.current = null
    pendiente.current = null
    if (arrastre) actualizar({ acimut: arrastre.acimut, elevacion: arrastre.elevacion, girando: false })
    setArrastre(null)
  }

  return (
    <HTMLContainer
      id={id}
      style={{ pointerEvents: 'all' }}
      className="w-full h-full bg-zinc-950 border-2 border-purple-500/60 rounded-xl p-3 text-white shadow-2xl flex flex-col gap-2 select-none pointer-events-auto"
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
        Superficies · {p.label} · {parciales ? 'Derivadas parciales' : 'Gradiente y plano tangente'}
      </span>

      {/* Panel */}
      <div className="bg-zinc-900 font-mono text-xs rounded-lg p-2 border border-zinc-800 flex flex-col gap-y-1">
        <span className="text-violet-300">
          f(x, y) = {p.tf} · f(x₀, y₀) = {formatEs(z0, 4)}
        </span>
        {parciales ? (
          <>
            <span className="text-fuchsia-300">
              ∂f/∂x = {p.tfx} = {formatEs(fx, 4)} → {lectura(fx, 'x')}
            </span>
            <span className="text-indigo-300">
              ∂f/∂y = {p.tfy} = {formatEs(fy, 4)} → {lectura(fy, 'y')}
            </span>
          </>
        ) : (
          <>
            <span className="text-amber-300">
              ∇f(x₀, y₀) = ({formatEs(fx, 4)}; {formatEs(fy, 4)}) · |∇f| = {formatEs(grad, 4)} (pendiente máxima)
            </span>
            <span className="text-zinc-300">
              Plano tangente: z = {formatEs(z0, 4)}
              {termino(fx, desplazado('x', x0))}
              {termino(fy, desplazado('y', y0))}
            </span>
            {critico && (
              <span className="text-fuchsia-300">
                Punto crítico · D = fxx·fyy − fxy² = {formatEs(D, 4)} → {tipoCritico}
              </span>
            )}
          </>
        )}
      </div>

      <div className="w-full aspect-[4/3] shrink-0">
        <svg
          viewBox={`${-VB_W / 2} ${-VB_H / 2} ${VB_W} ${VB_H}`}
          className={`w-full h-full border border-zinc-800 rounded touch-none ${arrastre ? 'cursor-grabbing' : 'cursor-grab'}`}
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
        >
          <defs>
            <clipPath id={`clip-${uid}`}>
              <rect x={-VB_W / 2} y={-VB_H / 2} width={VB_W} height={VB_H} />
            </clipPath>
          </defs>

          <g clipPath={`url(#clip-${uid})`}>
            {/* Piso */}
            <g className="stroke-zinc-800" strokeWidth={1}>
              {marcas.map((m) => (
                <g key={`p${m}`}>
                  <path d={linea([piso(m, DOM.min), piso(m, DOM.max)])} />
                  <path d={linea([piso(DOM.min, m), piso(DOM.max, m)])} />
                </g>
              ))}
            </g>
            <path d={linea([piso(-3, 0), piso(3, 0)])} stroke="#f87171" strokeOpacity={0.5} strokeWidth={1.5} />
            <path d={linea([piso(0, -3), piso(0, 3)])} stroke="#4ade80" strokeOpacity={0.5} strokeWidth={1.5} />
            <path
              d={linea([piso(0, 0), { x: 0, y: 0, z: p.zMax + 0.5 }])}
              className="stroke-zinc-400"
              strokeOpacity={0.6}
              strokeWidth={1.5}
            />
            {(
              [
                ['x', piso(3.2, 0), '#f87171'],
                ['y', piso(0, 3.2), '#4ade80'],
                ['z', { x: 0, y: 0, z: p.zMax + 0.7 }, '#a1a1aa'],
              ] as const
            ).map(([t, q, c]) => {
              const s = pantalla(q)
              return (
                <text key={t} x={s.x} y={s.y} fill={c} textAnchor="middle" dominantBaseline="middle" className="text-[12px] font-mono">
                  {t}
                </text>
              )
            })}

            {/* Curvas de nivel */}
            {nivel.map(([a, b], i) => (
              <path key={`n${i}`} d={linea([a, b])} className="stroke-violet-400" strokeOpacity={0.7} strokeWidth={1.2} />
            ))}

            {/* Gradiente en el piso */}
            {!parciales && largo > 1 && (
              <g className="stroke-amber-400 fill-amber-400">
                <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} strokeWidth={2.5} />
                <polygon points={punta} />
              </g>
            )}

            {/* Proyección de P */}
            <line x1={P.x} y1={P.y} x2={Ppiso.x} y2={Ppiso.y} className="stroke-zinc-300" strokeWidth={1} strokeDasharray="3 4" />
            <circle cx={Ppiso.x} cy={Ppiso.y} r={3} className="fill-zinc-300" />

            {/* Superficie y planos (orden del pintor) */}
            {caras.map((c, i) => (
              <polygon
                key={i}
                points={pts(c.pts)}
                fill={c.color}
                fillOpacity={c.opacidad ?? 1}
                stroke={c.borde ?? (c.opacidad === undefined ? 'rgba(24,24,27,0.35)' : 'none')}
                strokeWidth={0.6}
              />
            ))}

            {parciales && (
              <>
                <path d={linea(corteX)} fill="none" className="stroke-fuchsia-300" strokeWidth={2} />
                <path d={linea(corteY)} fill="none" className="stroke-indigo-300" strokeWidth={2} />
                <path d={linea(tangente({ x: 1, y: 0, z: fx }))} className="stroke-fuchsia-400" strokeWidth={3} />
                <path d={linea(tangente({ x: 0, y: 1, z: fy }))} className="stroke-indigo-400" strokeWidth={3} />
              </>
            )}

            <circle cx={P.x} cy={P.y} r={6} className="fill-white" />
          </g>
        </svg>
      </div>

      {/* Controles */}
      <div
        className="bg-zinc-900 p-2 rounded-lg border border-zinc-800 space-y-1.5 text-xs"
        onPointerDown={frenar}
        onPointerMove={frenar}
        onPointerUp={frenar}
      >
        <div className="flex flex-wrap items-center gap-2">
          {ORDEN.map((key) => (
            <button key={key} onClick={() => actualizar({ preset: key })} className={boton(key === preset)}>
              {PRESETS[key].label}
            </button>
          ))}
          <button
            onClick={() => actualizar({ modo: parciales ? 'gradiente' : 'parciales' })}
            className="ml-auto px-2 py-0.5 rounded-full bg-indigo-600/80 hover:bg-indigo-500 text-white cursor-pointer"
          >
            Modo: {parciales ? 'Parciales' : 'Gradiente'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {VISTAS.map(({ label, cam: c }) => (
            <button key={label} onClick={() => actualizar(c)} className={boton(false)}>
              {label}
            </button>
          ))}
          <button onClick={() => actualizar({ zoom: acotar(zoom * 0.8, 0.6, 2) })} className={boton(false)}>
            Zoom −
          </button>
          <button onClick={() => actualizar({ zoom: acotar(zoom * 1.25, 0.6, 2) })} className={boton(false)}>
            Zoom +
          </button>
          {!parciales && (
            <label className="ml-auto flex items-center gap-1 text-zinc-300">
              <input
                type="checkbox"
                checked={verNivel}
                onChange={(e) => actualizar({ verNivel: e.target.checked })}
                className="accent-fuchsia-500 cursor-pointer"
              />
              Curvas de nivel
            </label>
          )}
        </div>

        {(
          [
            ['x₀', 'x0', x0, 'text-fuchsia-300'],
            ['y₀', 'y0', y0, 'text-indigo-300'],
          ] as const
        ).map(([etiqueta, clave, valor, color]) => (
          <label key={clave} className={`flex items-center justify-between gap-2 font-mono ${color}`}>
            <span className="w-20 shrink-0 whitespace-nowrap">
              {etiqueta} = {formatEs(valor)}
            </span>
            <input
              type="range"
              min={DOM.min}
              max={DOM.max}
              step="any"
              value={valor}
              onChange={(e) => actualizar({ [clave]: acotar(ajustar(Number(e.target.value), 0.1, p.imanes), DOM.min, DOM.max) })}
              className="w-64 accent-purple-500 cursor-pointer"
            />
          </label>
        ))}
      </div>
    </HTMLContainer>
  )
}

export class SuperficieDerivadas3DShapeUtil extends LabShapeUtil<SuperficieDerivadas3DShape> {
  static override type = 'superficie-3d' as const

  static override props = superficieDerivadas3DProps

  static override migrations = superficieDerivadas3DMigrations

  override getDefaultProps(): Props {
    return { ...superficieDerivadas3DDefaults }
  }

  override contenido(shape: SuperficieDerivadas3DShape) {
    const actualizar = (props: Partial<Props>) => {
      this.editor.updateShape<SuperficieDerivadas3DShape>({ id: shape.id, type: 'superficie-3d', props })
    }
    return <Superficie
        id={shape.id}
        props={shape.props}
        actualizar={actualizar}
        empezarGiro={() => this.editor.markHistoryStoppingPoint('girar-3d')}
      />
  }

  override indicator(shape: SuperficieDerivadas3DShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />
  }

  override getIndicatorPath(shape: SuperficieDerivadas3DShape): Path2D {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 12)
    return path
  }
}
