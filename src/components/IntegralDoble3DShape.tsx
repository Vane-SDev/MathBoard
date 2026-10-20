'use client'

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { BaseBoxShapeUtil, HTMLContainer, type TLShape } from 'tldraw'
import { integralDoble3DProps, integralDoble3DDefaults, integralDoble3DMigrations } from '@/shapes/schemas'
import type { PresetIntegralDoble as Preset, RegionIntegralDoble as Region } from '@/shapes/schemas'
import { acotar, ajustar } from '@/lib/plot'
import { formatEs } from '@/lib/linear2d'
import {
  carasPrisma,
  caraVisible,
  colorAltura,
  mallaRegion,
  mallaSuperficie,
  ordenarPintor,
  paredFeta,
  puntoRegion,
  simpson,
  sombra,
  type Camara,
  type Cara,
  type Orden,
  type Vec3,
} from '@/lib/surface3d'

export type IntegralDoble3DShape = TLShape<'integral-doble-3d'>

type Props = IntegralDoble3DShape['props']
type Fn2 = (x: number, y: number) => number
type Fn = (u: number) => number

const PI = Math.PI

const PRESETS: Record<Preset, { label: string; tf: string; f: Fn2; V: number; textoV: string }> = {
  paraboloide: { label: 'Paraboloide', tf: '4 − 0,25(x² + y²)', f: (x, y) => 4 - 0.25 * (x * x + y * y), V: 160 / 3, textoV: '160/3' },
  plano: { label: 'Plano', tf: '2 + 0,4x + 0,3y', f: (x, y) => 2 + 0.4 * x + 0.3 * y, V: 32, textoV: '32' },
  silla: { label: 'Silla', tf: '2,5 + 0,25(x² − y²)', f: (x, y) => 2.5 + 0.25 * (x * x - y * y), V: 40, textoV: '40' },
}

const F_FUBINI: Fn2 = (x, y) => 3 - 0.2 * (x * x + y * y)

type Limites = { inf: string; sup: string }
type Iterada = {
  a: number
  b: number
  desde: Fn
  hasta: Fn
  ext: Limites
  int: Limites
  diferencial: 'dy dx' | 'dx dy'
  entra: string
  sale: string
}

const REGIONES: Record<Region, { label: string; V: number; textoV: string; porOrden: Record<Orden, Iterada> }> = {
  triangulo: {
    label: 'Triángulo',
    V: 74 / 15,
    textoV: '74/15',
    porOrden: {
      dydx: { a: 0, b: 2, desde: () => 0, hasta: (x) => x, ext: { inf: '0', sup: '2' }, int: { inf: '0', sup: 'x' }, diferencial: 'dy dx', entra: 'entra y = 0', sale: 'sale y = x' },
      dxdy: { a: 0, b: 2, desde: (y) => y, hasta: () => 2, ext: { inf: '0', sup: '2' }, int: { inf: 'y', sup: '2' }, diferencial: 'dx dy', entra: 'entra x = y', sale: 'sale x = 2' },
    },
  },
  parabola: {
    label: 'Parábola',
    V: 302 / 175,
    textoV: '302/175',
    porOrden: {
      dydx: {
        a: 0,
        b: 2,
        desde: (x) => (x * x) / 2,
        hasta: (x) => x,
        ext: { inf: '0', sup: '2' },
        int: { inf: 'x²/2', sup: 'x' },
        diferencial: 'dy dx',
        entra: 'entra y = x²/2',
        sale: 'sale y = x',
      },
      dxdy: {
        a: 0,
        b: 2,
        desde: (y) => y,
        hasta: (y) => Math.sqrt(2 * y),
        ext: { inf: '0', sup: '2' },
        int: { inf: 'y', sup: '√(2y)' },
        diferencial: 'dx dy',
        entra: 'entra x = y',
        sale: 'sale x = √(2y)',
      },
    },
  },
  circulo: {
    label: 'Cuarto de círculo',
    V: 2.6 * PI,
    textoV: '13π/5',
    porOrden: {
      dydx: {
        a: 0,
        b: 2,
        desde: () => 0,
        hasta: (x) => Math.sqrt(Math.max(0, 4 - x * x)),
        ext: { inf: '0', sup: '2' },
        int: { inf: '0', sup: '√(4 − x²)' },
        diferencial: 'dy dx',
        entra: 'entra y = 0',
        sale: 'sale y = √(4 − x²)',
      },
      dxdy: {
        a: 0,
        b: 2,
        desde: () => 0,
        hasta: (y) => Math.sqrt(Math.max(0, 4 - y * y)),
        ext: { inf: '0', sup: '2' },
        int: { inf: '0', sup: '√(4 − y²)' },
        diferencial: 'dx dy',
        entra: 'entra x = 0',
        sale: 'sale x = √(4 − y²)',
      },
    },
  },
}

const ORDEN_PRESETS: Preset[] = ['paraboloide', 'plano', 'silla']
const ORDEN_REGIONES: Region[] = ['triangulo', 'parabola', 'circulo']
const VISTA_3D: Camara = { acimut: -2.2, elevacion: 0.55 }
const VISTA_PISO: Camara = { acimut: 0, elevacion: (88 * PI) / 180 }
const VB_W = 600
const VB_H = 450
const EPS = 1e-9

const frenar = (e: { stopPropagation: () => void }) => e.stopPropagation()
const f2 = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const conSigno = (n: number) => `${n > EPS ? '+' : ''}${formatEs(n, 4)}`

function Integral({ inf, sup }: { inf: ReactNode; sup: ReactNode }) {
  return (
    <span className="inline-flex items-center">
      <span className="text-lg leading-none">∫</span>
      <span className="inline-flex flex-col justify-between leading-none text-[10px]">
        <span>{sup}</span>
        <span>{inf}</span>
      </span>
    </span>
  )
}

function IntegralDoble({
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
  const { modo, preset, nx, ny, verSuperficie, region, orden, t, zoom } = props
  const uid = id.replace(/[^a-zA-Z0-9]/g, '')
  const riemann = modo === 'riemann'

  // Cámara local mientras se arrastra; al soltar se guarda en props
  const [arrastre, setArrastre] = useState<Camara | null>(null)
  // Giro en vivo: se manda a las props como mucho una vez por cuadro, así la otra pantalla gira a la par
  const envio = useRef<number | null>(null)
  const pendiente = useRef<Camara | null>(null)
  // Malla liviana si giro yo (arrastre) o si gira otra persona (props.girando)
  const moviendo = arrastre !== null || props.girando
  const ultimo = useRef<{ x: number; y: number } | null>(null)
  const cam: Camara = arrastre ?? { acimut: props.acimut, elevacion: props.elevacion }

  // Encuadre: centro de la escena y escala por modo
  const centro: Vec3 = riemann ? { x: 0, y: 0, z: 2 } : { x: 1, y: 1, z: 1.5 }
  const k = (riemann ? 62 : 95) * zoom
  const pantalla = (q: Vec3) => {
    const r = { x: q.x - centro.x, y: q.y - centro.y, z: q.z - centro.z }
    const cf = Math.cos(cam.acimut)
    const sf = Math.sin(cam.acimut)
    const u = r.x * cf - r.y * sf
    const v = r.x * sf + r.y * cf
    return { x: u * k, y: -(r.z * Math.cos(cam.elevacion) + v * Math.sin(cam.elevacion)) * k }
  }
  const pts = (qs: Vec3[]) =>
    qs
      .map(pantalla)
      .map((s) => `${s.x.toFixed(1)},${s.y.toFixed(1)}`)
      .join(' ')
  const linea = (qs: Vec3[]) => `M${pts(qs).replaceAll(' ', ' L')}`
  const piso = (x: number, y: number): Vec3 => ({ x, y, z: 0 })

  // ── Riemann ──
  const p = PRESETS[preset]
  const dx = 4 / nx
  const dy = 4 / ny
  const centrosX = Array.from({ length: nx }, (_, i) => -2 + (i + 0.5) * dx)
  const centrosY = Array.from({ length: ny }, (_, j) => -2 + (j + 0.5) * dy)
  let S = 0
  for (const x of centrosX) for (const y of centrosY) S += p.f(x, y) * dx * dy

  // ── Fubini ──
  const reg = REGIONES[region]
  const it = reg.porOrden[orden]
  const u = it.a + t * (it.b - it.a)
  const enX = orden === 'dydx'
  const A = (s: number) =>
    simpson(
      (w) => {
        const q = puntoRegion(s, w, orden)
        return F_FUBINI(q.x, q.y)
      },
      it.desde(s),
      it.hasta(s),
    )
  const Au = A(u)
  const control = simpson(A, it.a, it.b, 64)

  // Caras de la escena en una sola lista del pintor
  const caras: Cara[] = []
  if (riemann) {
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const zTop = p.f(centrosX[i], centrosY[j])
        for (const c of carasPrisma(-2 + i * dx, -2 + (i + 1) * dx, -2 + j * dy, -2 + (j + 1) * dy, zTop)) {
          if (!caraVisible(c.normal, cam)) continue
          const alto = c.normal.z > 0 ? zTop : zTop / 2
          caras.push({ pts: c.pts, color: colorAltura(alto, 0, 4, sombra(c.normal)), borde: 'rgba(161,161,170,0.6)' })
        }
      }
    }
  } else {
    const malla = mallaRegion(F_FUBINI, it.a, it.b, it.desde, it.hasta, orden, moviendo ? 16 : 28, (z, n) =>
      colorAltura(z, 0, 3, sombra(n)),
    )
    for (const c of malla) caras.push({ ...c, opacidad: 0.45 })
    caras.push(...paredFeta(F_FUBINI, u, it.desde, it.hasta, orden, 16, '#e879f9', 0.85))
  }
  const ordenadas = ordenarPintor(caras, cam)
  // Superficie de referencia: ordenada aparte y dibujada encima de los prismas
  const superficie =
    riemann && verSuperficie
      ? ordenarPintor(
          mallaSuperficie(p.f, { min: -2, max: 2 }, moviendo ? 24 : 40, (z, n) => colorAltura(z, 0, 4, sombra(n))),
          cam,
        )
      : []

  // Piso de Fubini: región, fronteras, flecha
  const muestras = Array.from({ length: 49 }, (_, i) => it.a + ((it.b - it.a) * i) / 48)
  const frontera = (g: Fn) =>
    muestras.map((s) => {
      const q = puntoRegion(s, g(s), orden)
      return piso(q.x, q.y)
    })
  const curvaEntra = frontera(it.desde)
  const curvaSale = frontera(it.hasta)
  const regionPoligono = [...curvaEntra, ...[...curvaSale].reverse()]
  const etiqueta = (curva: Vec3[], idx: number) => pantalla(curva[idx])

  const q0 = puntoRegion(u, it.desde(u), orden)
  const q1 = puntoRegion(u, it.hasta(u), orden)
  const F0 = pantalla(piso(q0.x, q0.y))
  const F1 = pantalla(piso(q1.x, q1.y))
  const largo = Math.hypot(F1.x - F0.x, F1.y - F0.y)
  const ux = largo > EPS ? (F1.x - F0.x) / largo : 0
  const uy = largo > EPS ? (F1.y - F0.y) / largo : 0
  const punta = `${F1.x},${F1.y} ${F1.x - 10 * ux - 5 * uy},${F1.y - 10 * uy + 5 * ux} ${F1.x - 10 * ux + 5 * uy},${F1.y - 10 * uy - 5 * ux}`

  // Contorno de la feta
  const contornoFeta = (() => {
    const n = 32
    const w0 = it.desde(u)
    const w1 = it.hasta(u)
    const arriba = Array.from({ length: n + 1 }, (_, kk) => {
      const q = puntoRegion(u, w0 + ((w1 - w0) * kk) / n, orden)
      return { x: q.x, y: q.y, z: F_FUBINI(q.x, q.y) }
    })
    return [piso(q0.x, q0.y), ...arriba, piso(q1.x, q1.y), piso(q0.x, q0.y)]
  })()

  const boton = (activo: boolean) =>
    `px-2 py-0.5 rounded-full text-white cursor-pointer whitespace-nowrap ${activo ? 'bg-fuchsia-600' : 'bg-purple-600/80 hover:bg-purple-500'}`

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
    const ddx = e.clientX - prev.x
    const ddy = e.clientY - prev.y
    ultimo.current = { x: e.clientX, y: e.clientY }
    const nueva = { acimut: arrastre.acimut + ddx * 0.01, elevacion: acotar(arrastre.elevacion - ddy * 0.01, 0.1, PI / 2) }
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

  const rango = (etiqueta: string, valor: number, min: number, max: number, alCambiar: (v: number) => void, color: string) => (
    <label className={`flex items-center justify-between gap-2 font-mono ${color}`}>
      <span className="w-24 shrink-0 whitespace-nowrap">{etiqueta}</span>
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
      id={id}
      style={{ pointerEvents: 'all' }}
      className="w-full h-full bg-zinc-950 border-2 border-purple-500/60 rounded-xl p-3 text-white shadow-2xl flex flex-col gap-2 select-none pointer-events-auto"
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
        Integral doble · {riemann ? `Sumas de Riemann · ${p.label}` : `Fubini · ${reg.label}`}
      </span>

      {/* Panel */}
      <div className="bg-zinc-900 font-mono text-xs rounded-lg p-2 border border-zinc-800 flex flex-col gap-y-1">
        {riemann ? (
          <>
            <span className="text-violet-300">f(x, y) = {p.tf} sobre [−2, 2]²</span>
            <span className="text-fuchsia-300">
              S({nx}, {ny}) = Σ f(xᵢ*, yⱼ*)·Δx·Δy = {formatEs(S, 4)} (Δx = {formatEs(dx, 3)}, Δy = {formatEs(dy, 3)})
            </span>
            <span className="text-indigo-300">
              V exacto = {p.textoV} ≈ {formatEs(p.V, 4)}
            </span>
            <span className="text-amber-300">Error S − V = {conSigno(S - p.V)}</span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1 font-mono text-violet-300">
              V = <Integral inf={it.ext.inf} sup={it.ext.sup} /> <Integral inf={it.int.inf} sup={it.int.sup} /> f(x, y){' '}
              {it.diferencial} · f = 3 − 0,2(x² + y²)
            </span>
            <span className="text-fuchsia-300">
              {enX ? 'x' : 'y'} = {f2(u)} → A({enX ? 'x' : 'y'}) = ∫ f d{enX ? 'y' : 'x'} = {formatEs(Au, 4)}
            </span>
            <span className="text-zinc-400">Simpson es exacto acá: f es cuadrática en la variable interna</span>
            <span className="text-indigo-300">
              V exacto = {reg.textoV} ≈ {formatEs(reg.V, 4)}
            </span>
            <span className="text-amber-300">
              Control: ∫A({enX ? 'x' : 'y'}) d{enX ? 'x' : 'y'} ≈ {formatEs(control, 4)}
            </span>
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
            {riemann ? (
              /* Piso: rectángulo y grilla de la partición */
              <g className="stroke-zinc-700" strokeWidth={1}>
                <polygon points={pts([piso(-2, -2), piso(2, -2), piso(2, 2), piso(-2, 2)])} className="fill-zinc-900" />
                {Array.from({ length: nx + 1 }, (_, i) => -2 + i * dx).map((x) => (
                  <path key={`px${x}`} d={linea([piso(x, -2), piso(x, 2)])} />
                ))}
                {Array.from({ length: ny + 1 }, (_, j) => -2 + j * dy).map((y) => (
                  <path key={`py${y}`} d={linea([piso(-2, y), piso(2, y)])} />
                ))}
              </g>
            ) : (
              <>
                <path d={linea([piso(0, 0), piso(2.5, 0)])} stroke="#f87171" strokeOpacity={0.5} strokeWidth={1.5} />
                <path d={linea([piso(0, 0), piso(0, 2.5)])} stroke="#4ade80" strokeOpacity={0.5} strokeWidth={1.5} />
                {(
                  [
                    ['x', piso(2.7, 0), '#f87171'],
                    ['y', piso(0, 2.7), '#4ade80'],
                  ] as const
                ).map(([txt, q, c]) => {
                  const s = pantalla(q)
                  return (
                    <text key={txt} x={s.x} y={s.y} fill={c} textAnchor="middle" dominantBaseline="middle" className="text-[12px] font-mono">
                      {txt}
                    </text>
                  )
                })}
                <polygon points={pts(regionPoligono)} className="fill-indigo-500" fillOpacity={0.3} />
                <path d={linea(curvaEntra)} fill="none" className="stroke-indigo-400" strokeWidth={2} />
                <path d={linea(curvaSale)} fill="none" className="stroke-fuchsia-400" strokeWidth={2} />
                {(
                  [
                    [it.entra, etiqueta(curvaEntra, 30), 'fill-indigo-300'],
                    [it.sale, etiqueta(curvaSale, 18), 'fill-fuchsia-300'],
                  ] as const
                ).map(([txt, s, c]) => (
                  <text key={txt} x={s.x + 6} y={s.y - 6} className={`${c} text-[11px] font-mono`}>
                    {txt}
                  </text>
                ))}
                {largo > 1 && (
                  <g className="stroke-amber-400 fill-amber-400">
                    <line x1={F0.x} y1={F0.y} x2={F1.x} y2={F1.y} strokeWidth={2.5} />
                    <polygon points={punta} />
                  </g>
                )}
              </>
            )}

            {/* Escena (orden del pintor) */}
            {ordenadas.map((c, i) => (
              <polygon
                key={i}
                points={pts(c.pts)}
                fill={c.color}
                fillOpacity={c.opacidad ?? 1}
                stroke={c.borde ?? 'none'}
                strokeWidth={0.6}
              />
            ))}

            {superficie.length > 0 && (
              <g pointerEvents="none">
                {superficie.map((c, i) => (
                  <polygon
                    key={i}
                    points={pts(c.pts)}
                    fill={c.color}
                    fillOpacity={0.12}
                    className="stroke-purple-300"
                    strokeOpacity={0.35}
                    strokeWidth={0.6}
                  />
                ))}
              </g>
            )}

            {!riemann && <path d={linea(contornoFeta)} fill="none" className="stroke-fuchsia-200" strokeWidth={1.5} />}
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
          <button onClick={() => actualizar({ modo: 'riemann' })} className={boton(riemann)}>
            Riemann
          </button>
          <button onClick={() => actualizar({ modo: 'fubini' })} className={boton(!riemann)}>
            Fubini
          </button>
          <span className="ml-auto" />
          <button onClick={() => actualizar(VISTA_PISO)} className={boton(false)}>
            Vista Piso XY
          </button>
          <button onClick={() => actualizar(VISTA_3D)} className={boton(false)}>
            Vista 3D
          </button>
          <button onClick={() => actualizar({ zoom: acotar(zoom * 0.8, 0.6, 2) })} className={boton(false)}>
            Zoom −
          </button>
          <button onClick={() => actualizar({ zoom: acotar(zoom * 1.25, 0.6, 2) })} className={boton(false)}>
            Zoom +
          </button>
        </div>

        {riemann ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {ORDEN_PRESETS.map((key) => (
                <button key={key} onClick={() => actualizar({ preset: key })} className={boton(key === preset)}>
                  {PRESETS[key].label}
                </button>
              ))}
              <label className="ml-auto flex items-center gap-1 text-zinc-300 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={verSuperficie}
                  onChange={(e) => actualizar({ verSuperficie: e.target.checked })}
                  className="accent-fuchsia-500 cursor-pointer"
                />
                Superficie
              </label>
            </div>
            {rango(`nx = ${nx}`, nx, 2, 10, (v) => actualizar({ nx: acotar(ajustar(v, 1, []), 2, 10) }), 'text-fuchsia-300')}
            {rango(`ny = ${ny}`, ny, 2, 10, (v) => actualizar({ ny: acotar(ajustar(v, 1, []), 2, 10) }), 'text-indigo-300')}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {ORDEN_REGIONES.map((key) => (
                <button key={key} onClick={() => actualizar({ region: key })} className={boton(key === region)}>
                  {REGIONES[key].label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => actualizar({ orden: 'dydx' })} className={boton(orden === 'dydx')}>
                Tipo I · dy dx
              </button>
              <button onClick={() => actualizar({ orden: 'dxdy' })} className={boton(orden === 'dxdy')}>
                Tipo II · dx dy
              </button>
            </div>
            {rango(
              `${enX ? 'x' : 'y'} = ${f2(u)}`,
              t,
              0,
              1,
              (v) => actualizar({ t: acotar(ajustar(v, 0.01, [0, 0.25, 0.5, 0.75, 1]), 0, 1) }),
              'text-fuchsia-300',
            )}
          </>
        )}
      </div>
    </HTMLContainer>
  )
}

export class IntegralDoble3DShapeUtil extends BaseBoxShapeUtil<IntegralDoble3DShape> {
  static override type = 'integral-doble-3d' as const

  static override props = integralDoble3DProps

  static override migrations = integralDoble3DMigrations

  override getDefaultProps(): Props {
    return { ...integralDoble3DDefaults }
  }

  override component(shape: IntegralDoble3DShape) {
    const actualizar = (props: Partial<Props>) => {
      this.editor.updateShape<IntegralDoble3DShape>({ id: shape.id, type: 'integral-doble-3d', props })
    }
    return <IntegralDoble
        id={shape.id}
        props={shape.props}
        actualizar={actualizar}
        empezarGiro={() => this.editor.markHistoryStoppingPoint('girar-3d')}
      />
  }

  override indicator(shape: IntegralDoble3DShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />
  }

  override getIndicatorPath(shape: IntegralDoble3DShape): Path2D {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 12)
    return path
  }
}
