'use client'

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { HTMLContainer, type TLShape } from 'tldraw'
import { LabShapeUtil } from '@/components/LabShapeUtil'
import { graficador3DProps, graficador3DDefaults } from '@/shapes/schemas'
import { acotar, ajustar, pasoLindo } from '@/lib/plot'
import { formatEs } from '@/lib/linear2d'
import { parsear2, type Parseo2 } from '@/lib/parser'
import {
  celdasExplicitas,
  colorAltura,
  curvasNivel,
  muestrear,
  normalPoligono,
  ordenarPintor,
  proyectar,
  sombra,
  ventanaZ,
  type Camara,
  type Cara,
  type Dominio,
  type Vec3,
} from '@/lib/surface3d'

export type Graficador3DShape = TLShape<'graficador-3d'>

type Props = Graficador3DShape['props']
type Fn2 = (x: number, y: number) => number

const PI = Math.PI
const EJEMPLOS: { label: string; expr: string }[] = [
  { label: 'Paraboloide', expr: 'x^2 + y^2' },
  { label: 'Silla', expr: 'x^2 - y^2' },
  { label: 'Ondas', expr: 'sen(x)*cos(y)' },
  { label: 'Gaussiana', expr: 'exp(-(x^2 + y^2))' },
  { label: 'Cono', expr: 'raiz(x^2 + y^2)' },
  { label: 'Sombrero', expr: 'sen(raiz(x^2 + y^2))/raiz(x^2 + y^2)' },
  { label: 'Semiesfera', expr: 'raiz(9 - x^2 - y^2)' },
  { label: 'Plano', expr: '2x - y + 1' },
]
const VISTAS: { label: string; cam: Camara }[] = [
  { label: 'Iso', cam: { acimut: -2.2, elevacion: 0.55 } },
  { label: 'Frente', cam: { acimut: 0, elevacion: 0.1 } },
  { label: 'Arriba', cam: { acimut: 0, elevacion: PI / 2 } },
]
const AYUDA = 'Usá x e y, ^ para potencias, sen cos tg ln raiz abs exp, pi. Ej: 3xy^2'
const VB_W = 600
const VB_H = 450
const ESCALA_BASE = 130
const Z_LIMITE = 20
const NIVELES = 7

const frenar = (e: { stopPropagation: () => void }) => e.stopPropagation()

const multiplos = (lo: number, hi: number, paso: number) =>
  Array.from({ length: Math.max(0, Math.floor(hi / paso) - Math.ceil(lo / paso) + 1) }, (_, i) => (Math.ceil(lo / paso) + i) * paso)

function Graficador3D({
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
  const { exprZ, rango: R, zAuto, escala, zoom, verNivel } = props
  const uid = id.replace(/[^a-zA-Z0-9]/g, '')

  // Si la expresión tiene un error, se sigue dibujando la última válida
  const parseo = useMemo(() => parsear2(exprZ), [exprZ])
  const [valida, setValida] = useState<Parseo2>(() => (parseo.ok ? parseo : parsear2(graficador3DDefaults.exprZ)))
  if (parseo.ok && parseo !== valida) setValida(parseo)
  const f: Fn2 | null = valida.ok ? valida.f : null

  // Cámara local mientras se arrastra; al soltar se guarda en props (igual que el Lab 10)
  const [arrastre, setArrastre] = useState<Camara | null>(null)
  const envio = useRef<number | null>(null)
  const pendiente = useRef<Camara | null>(null)
  const ultimo = useRef<{ x: number; y: number } | null>(null)
  const moviendo = arrastre !== null || props.girando
  const acimut = arrastre?.acimut ?? props.acimut
  const elevacion = arrastre?.elevacion ?? props.elevacion
  const n = moviendo ? 24 : 40

  const dom: Dominio = useMemo(() => ({ min: -R, max: R }), [R])

  // 1. Muestreo una sola vez: lo usan la malla y las curvas de nivel
  const val = useMemo(() => (f ? muestrear(f, dom, n) : null), [f, dom, n])

  // 2. Ventana en z: automática por percentiles o manual
  const auto = useMemo(() => (val ? ventanaZ(val) : null), [val])
  const { zMin, zMax } = props
  const ventana: Dominio = useMemo(
    () => (zAuto ? (auto ?? { min: -1, max: 1 }) : { min: zMin, max: zMax }),
    [zAuto, auto, zMin, zMax],
  )

  // 3. Cubo normalizado [−1, 1]³: X = x/R, Y = y/R, Z = (z − zc)/s
  const zc = (ventana.min + ventana.max) / 2
  const semi = (ventana.max - ventana.min) / 2
  const s = escala === 'ajustada' ? semi : R
  const alto = semi / s
  const norm = (q: Vec3): Vec3 => ({ x: q.x / R, y: q.y / R, z: (q.z - zc) / s })

  const malla = useMemo(() => {
    if (!val) return { caras: [] as Cara[], indefinidas: 0 }
    const { celdas, indefinidas } = celdasExplicitas(val, dom, ventana)
    const caras = celdas.map((celda): Cara => {
      const pts = celda.map((q) => ({ x: q.x / R, y: q.y / R, z: (q.z - zc) / s }))
      const nn = normalPoligono(pts)
      const zMedio = celda.reduce((acc, q) => acc + q.z, 0) / celda.length
      const luz = sombra(nn.z < 0 ? { x: -nn.x, y: -nn.y, z: -nn.z } : nn)
      return { pts, color: colorAltura(zMedio, ventana.min, ventana.max, luz) }
    })
    return { caras, indefinidas }
  }, [val, dom, ventana, R, zc, s])

  const caras = useMemo(() => ordenarPintor(malla.caras, { acimut, elevacion }), [malla, acimut, elevacion])

  const nivel = useMemo(() => {
    if (!val || !f || !verNivel) return []
    const niveles = Array.from({ length: NIVELES }, (_, i) => ventana.min + ((ventana.max - ventana.min) * (i + 0.5)) / NIVELES)
    return curvasNivel(f, dom, n, niveles, ventana.min, val)
  }, [val, f, verNivel, dom, n, ventana])

  // En escala real la caja puede ser más alta que ancha: se achica para que entre
  const k = (ESCALA_BASE * zoom) / Math.max(1, alto)
  const cam: Camara = { acimut, elevacion }
  const pantalla = (q: Vec3) => {
    const r = proyectar(q, cam)
    return { x: r.X * k, y: -r.Y * k }
  }
  const pts = (qs: Vec3[]) =>
    qs
      .map(pantalla)
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ')
  const linea = (qs: Vec3[]) => `M${pts(qs).replaceAll(' ', ' L')}`

  // Piso en Z = −alto (zMin), grilla en múltiplos lindos de x e y
  const pisoZ = -alto
  const piso = (x: number, y: number): Vec3 => ({ x: x / R, y: y / R, z: pisoZ })
  const marcas = multiplos(-R, R, pasoLindo(2 * R))
  const borde = [piso(-R, -R), piso(R, -R), piso(R, R), piso(-R, R), piso(-R, -R)]
  const techo = norm({ x: 0, y: 0, z: ventana.max })

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

  const boton = (activo: boolean) =>
    `px-2 py-0.5 rounded-full text-white cursor-pointer ${activo ? 'bg-fuchsia-600' : 'bg-purple-600/80 hover:bg-purple-500'}`

  // Al pasar a ventana manual, arranca desde la automática redondeada a 0,5
  const cambiarAuto = (activa: boolean) => {
    if (activa) actualizar({ zAuto: true })
    else
      actualizar({
        zAuto: false,
        zMin: acotar(Math.floor(ventana.min * 2) / 2, -Z_LIMITE, Z_LIMITE - 0.5),
        zMax: acotar(Math.ceil(ventana.max * 2) / 2, -Z_LIMITE + 0.5, Z_LIMITE),
      })
  }

  const deformada = escala === 'ajustada' && Math.abs(semi / R - 1) > 0.05

  return (
    <HTMLContainer
      id={id}
      style={{ pointerEvents: 'all' }}
      className="w-full h-full bg-zinc-950 border-2 border-purple-500/60 rounded-xl p-3 text-white shadow-2xl flex flex-col gap-2 select-none pointer-events-auto"
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">Graficador 3D · z = f(x, y)</span>

      {/* Expresión */}
      <div
        className="bg-zinc-900 font-mono text-xs rounded-lg p-2 border border-zinc-800 flex flex-col gap-y-1"
        onPointerDown={frenar}
        onPointerMove={frenar}
        onPointerUp={frenar}
      >
        <label className="flex items-center gap-2 font-mono text-violet-300">
          <span className="w-16 shrink-0 whitespace-nowrap">f(x, y) =</span>
          <input
            type="text"
            value={exprZ}
            spellCheck={false}
            onChange={(e) => actualizar({ exprZ: e.target.value })}
            onKeyDown={frenar}
            onKeyUp={frenar}
            className={`flex-1 min-w-0 bg-zinc-950 text-white font-mono px-2 py-1 rounded border outline-none ${
              parseo.ok ? 'border-zinc-700 focus:border-purple-500' : 'border-red-500'
            }`}
          />
        </label>
        {parseo.ok ? (
          <span className="text-zinc-500">{AYUDA}</span>
        ) : (
          <span className="text-red-400">
            {parseo.error} (posición {parseo.pos + 1}) · se muestra la última función válida
          </span>
        )}
        <span className="text-zinc-300">
          Caja: x, y ∈ [{formatEs(-R)}; {formatEs(R)}] · z ∈ [{formatEs(ventana.min)}; {formatEs(ventana.max)}]{' '}
          {zAuto ? '(automática)' : '(manual)'}
        </span>
        {malla.indefinidas > 0 && (
          <span className="text-amber-300">{malla.indefinidas} celdas fuera del dominio de f (quedan como agujeros)</span>
        )}
        {deformada && <span className="text-zinc-500">Escala ajustada: el eje z está estirado o achicado para que entre.</span>}
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
                  <path d={linea([piso(m, -R), piso(m, R)])} />
                  <path d={linea([piso(-R, m), piso(R, m)])} />
                </g>
              ))}
            </g>
            <path d={linea(borde)} fill="none" className="stroke-zinc-700" strokeWidth={1} />
            <path d={linea([piso(-R, 0), piso(R, 0)])} stroke="#f87171" strokeOpacity={0.5} strokeWidth={1.5} />
            <path d={linea([piso(0, -R), piso(0, R)])} stroke="#4ade80" strokeOpacity={0.5} strokeWidth={1.5} />
            <path d={linea([piso(0, 0), techo])} className="stroke-zinc-400" strokeOpacity={0.6} strokeWidth={1.5} />
            {(
              [
                ['x', piso(1.12 * R, 0), '#f87171'],
                ['y', piso(0, 1.12 * R), '#4ade80'],
                ['z', { ...techo, z: techo.z + 0.12 }, '#a1a1aa'],
              ] as const
            ).map(([t, q, c]) => {
              const p = pantalla(q)
              return (
                <text key={t} x={p.x} y={p.y} fill={c} textAnchor="middle" dominantBaseline="middle" className="text-[12px] font-mono">
                  {t}
                </text>
              )
            })}
            {(
              [
                [formatEs(ventana.min), piso(0, 0)],
                [formatEs(ventana.max), techo],
              ] as const
            ).map(([t, q]) => {
              const p = pantalla(q)
              return (
                <text key={`z${t}`} x={p.x + 8} y={p.y} className="fill-zinc-400 text-[10px] font-mono" dominantBaseline="middle">
                  {t}
                </text>
              )
            })}

            {/* Curvas de nivel en el piso */}
            {nivel.map(([a, b], i) => (
              <path
                key={`n${i}`}
                d={linea([norm(a), norm(b)])}
                className="stroke-violet-400"
                strokeOpacity={0.7}
                strokeWidth={1.2}
              />
            ))}

            {/* Superficie (orden del pintor) */}
            {caras.map((c, i) => (
              <polygon key={i} points={pts(c.pts)} fill={c.color} stroke="rgba(24,24,27,0.35)" strokeWidth={0.6} />
            ))}
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
        <div className="flex flex-wrap items-center gap-1.5">
          {EJEMPLOS.map(({ label, expr }) => (
            <button key={label} onClick={() => actualizar({ exprZ: expr })} className={boton(expr === exprZ)}>
              {label}
            </button>
          ))}
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
          <label className="ml-auto flex items-center gap-1 text-zinc-300">
            <input
              type="checkbox"
              checked={verNivel}
              onChange={(e) => actualizar({ verNivel: e.target.checked })}
              className="accent-fuchsia-500 cursor-pointer"
            />
            Curvas de nivel
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-zinc-300">
            <input
              type="checkbox"
              checked={zAuto}
              onChange={(e) => cambiarAuto(e.target.checked)}
              className="accent-fuchsia-500 cursor-pointer"
            />
            Ventana z automática
          </label>
          <button
            onClick={() => actualizar({ escala: escala === 'ajustada' ? 'real' : 'ajustada' })}
            className="ml-auto px-2 py-0.5 rounded-full bg-indigo-600/80 hover:bg-indigo-500 text-white cursor-pointer"
          >
            Escala: {escala === 'ajustada' ? 'ajustada' : 'real 1:1'}
          </button>
        </div>

        <label className="flex items-center justify-between gap-2 font-mono text-violet-300">
          <span className="w-24 shrink-0 whitespace-nowrap">R = {formatEs(R)}</span>
          <input
            type="range"
            min={1}
            max={10}
            step="any"
            value={R}
            onChange={(e) => actualizar({ rango: acotar(ajustar(Number(e.target.value), 0.5, [PI]), 1, 10) })}
            className="w-64 accent-purple-500 cursor-pointer"
          />
        </label>

        {!zAuto && (
          <>
            <label className="flex items-center justify-between gap-2 font-mono text-fuchsia-300">
              <span className="w-24 shrink-0 whitespace-nowrap">z mín = {formatEs(zMin)}</span>
              <input
                type="range"
                min={-Z_LIMITE}
                max={Z_LIMITE}
                step="any"
                value={zMin}
                onChange={(e) => actualizar({ zMin: acotar(ajustar(Number(e.target.value), 0.5), -Z_LIMITE, zMax - 0.5) })}
                className="w-64 accent-purple-500 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between gap-2 font-mono text-indigo-300">
              <span className="w-24 shrink-0 whitespace-nowrap">z máx = {formatEs(zMax)}</span>
              <input
                type="range"
                min={-Z_LIMITE}
                max={Z_LIMITE}
                step="any"
                value={zMax}
                onChange={(e) => actualizar({ zMax: acotar(ajustar(Number(e.target.value), 0.5), zMin + 0.5, Z_LIMITE) })}
                className="w-64 accent-purple-500 cursor-pointer"
              />
            </label>
          </>
        )}
      </div>
    </HTMLContainer>
  )
}

export class Graficador3DShapeUtil extends LabShapeUtil<Graficador3DShape> {
  static override type = 'graficador-3d' as const

  static override props = graficador3DProps

  override getDefaultProps(): Props {
    return { ...graficador3DDefaults }
  }

  override contenido(shape: Graficador3DShape) {
    const actualizar = (props: Partial<Props>) => {
      this.editor.updateShape<Graficador3DShape>({ id: shape.id, type: 'graficador-3d', props })
    }
    return (
      <Graficador3D
        id={shape.id}
        props={shape.props}
        actualizar={actualizar}
        empezarGiro={() => this.editor.markHistoryStoppingPoint('girar-3d')}
      />
    )
  }

  override indicator(shape: Graficador3DShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />
  }

  override getIndicatorPath(shape: Graficador3DShape): Path2D {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 12)
    return path
  }
}
