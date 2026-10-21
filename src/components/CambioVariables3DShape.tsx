'use client'

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { HTMLContainer, type TLShape } from 'tldraw'
import { LabShapeUtil } from '@/components/LabShapeUtil'
import { cambioVariables3DProps, cambioVariables3DDefaults } from '@/shapes/schemas'
import { acotar, ajustar } from '@/lib/plot'
import { formatEs } from '@/lib/linear2d'
import { NOTABLES, fraccionPi } from '@/lib/trig'
import { SISTEMAS, type SistemaCoordenadas } from '@/lib/coordenadas'
import {
  aristasParalelepipedo,
  carasCelda,
  caraVisible,
  curvaCoordenada,
  ordenarPintor,
  parche,
  proyectar,
  punto,
  sombra,
  superficieCoordenada,
  tono,
  type Camara,
  type CaraConNormal,
  type Dominio,
  type Eje,
  type Terna,
  type Vec3,
} from '@/lib/surface3d'

export type CambioVariables3DShape = TLShape<'cambio-variables-3d'>

type Props = CambioVariables3DShape['props']

const PI = Math.PI
const VISTA_3D: Camara = { acimut: -2.2, elevacion: 0.45 }
const VISTA_PISO: Camara = { acimut: 0, elevacion: (88 * PI) / 180 }
const VB_W = 600
const VB_H = 450
const EPS = 1e-9
/** Radio de las superficies coordenadas y largo de los ejes */
const R_SUP = 3.2
const Z_SUP = 1.6

const FUCSIA: Terna = [232, 121, 249]
const INDIGO: Terna = [129, 140, 248]
const AMBAR: Terna = [252, 211, 77]

// Color por coordenada: r/ρ fucsia, θ índigo, z/φ ámbar (el orden de (u, v, w) cambia en esféricas)
const INFO: Record<
  SistemaCoordenadas,
  { label: string; colores: [Terna, Terna, Terna]; clases: [string, string, string]; superficies: [string, string, string]; escalas: [string, string, string] }
> = {
  polares: {
    label: 'Polares',
    colores: [FUCSIA, INDIGO, AMBAR],
    clases: ['text-fuchsia-300', 'text-indigo-300', 'text-amber-300'],
    superficies: ['circunferencia', 'semirrecta', ''],
    escalas: ['1', 'r', '1'],
  },
  cilindricas: {
    label: 'Cilíndricas',
    colores: [FUCSIA, INDIGO, AMBAR],
    clases: ['text-fuchsia-300', 'text-indigo-300', 'text-amber-300'],
    superficies: ['cilindro', 'semiplano', 'plano'],
    escalas: ['1', 'r', '1'],
  },
  esfericas: {
    label: 'Esféricas',
    colores: [FUCSIA, AMBAR, INDIGO],
    clases: ['text-fuchsia-300', 'text-amber-300', 'text-indigo-300'],
    superficies: ['esfera', 'cono', 'semiplano'],
    escalas: ['1', 'ρ', 'ρ sen φ'],
  },
}

const ORDEN_SISTEMAS: SistemaCoordenadas[] = ['polares', 'cilindricas', 'esfericas']
const IMANES_R = [0.5, 1, 1.5, 2, 2.5, 3]
const NOTABLES_PHI = NOTABLES.filter((a) => a <= PI + EPS)

const frenar = (e: { stopPropagation: () => void }) => e.stopPropagation()
const conSigno = (n: number) => `${n > EPS ? '+' : ''}${formatEs(n, 2)}`
const rgb = (c: Terna) => `rgb(${c.join(',')})`
const escalar = (v: Vec3, s: number): Vec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s })
const sumar = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
const unitario = (v: Vec3): Vec3 => escalar(v, 1 / (Math.hypot(v.x, v.y, v.z) || 1))

function CambioVariables({
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
  const { sistema, modo, r, rho, theta, phi, z0, delta, verLineal, zoom } = props
  const uid = id.replace(/[^a-zA-Z0-9]/g, '')
  const S = SISTEMAS[sistema]
  const info = INFO[sistema]
  const esf = sistema === 'esfericas'
  const plano = S.dim === 2
  const jacobiano = modo === 'jacobiano'

  // Cámara local mientras se arrastra; al soltar se guarda en props
  const [arrastre, setArrastre] = useState<Camara | null>(null)
  // Giro en vivo: se manda a las props como mucho una vez por cuadro, así la otra pantalla gira a la par
  const envio = useRef<number | null>(null)
  const pendiente = useRef<Camara | null>(null)
  // Malla liviana si giro yo (arrastre) o si gira otra persona (props.girando)
  const moviendo = arrastre !== null || props.girando
  const ultimo = useRef<{ x: number; y: number } | null>(null)
  const cam: Camara = arrastre ?? { acimut: props.acimut, elevacion: props.elevacion }

  // ── Punto base P = X(q0) y celda [q0, q0 + d] ──
  // En esféricas la celda no puede pasar de φ = π
  const phiEf = acotar(phi, 0, PI - delta)
  const q0: Terna = esf ? [rho, phiEf, theta] : [r, theta, plano ? 0 : z0]
  const d: Terna = esf ? [delta, delta, delta] : [delta, delta, plano ? 0 : delta]
  const P = S.X(q0)
  const cols = S.columnas(q0)
  const n = plano ? 2 : 3
  const indices = ([0, 1, 2] as const).slice(0, n)
  const J = S.jac(q0)
  const lineal = J * d[0] * d[1] * (plano ? 1 : d[2])
  const exacto = S.exacto(q0, d)
  const errorRel = exacto > EPS ? ((lineal - exacto) / exacto) * 100 : 0
  const escalas = S.escalas(q0)
  const nombreDelta = (i: Eje) => `Δ${S.nombres[i]}`
  const valorCoord = (i: Eje) => (S.nombres[i] === 'θ' || S.nombres[i] === 'φ' ? fraccionPi(q0[i]) : formatEs(q0[i]))

  // Encuadre
  const centro: Vec3 = { x: 0, y: 0, z: plano ? 0 : 0.3 }
  const k = 64 * zoom
  const pantalla = (q: Vec3) => {
    const s = proyectar({ x: q.x - centro.x, y: q.y - centro.y, z: q.z - centro.z }, cam)
    return { x: s.X * k, y: -s.Y * k }
  }
  const pts = (qs: Vec3[]) =>
    qs
      .map(pantalla)
      .map((s) => `${s.x.toFixed(1)},${s.y.toFixed(1)}`)
      .join(' ')
  const linea = (qs: Vec3[]) => `M${pts(qs).replaceAll(' ', ' L')}`
  const O: Vec3 = { x: 0, y: 0, z: 0 }

  // Flecha de a hasta b con punta en pantalla
  const flecha = (a: Vec3, b: Vec3) => {
    const A = pantalla(a)
    const B = pantalla(b)
    const largo = Math.hypot(B.x - A.x, B.y - A.y)
    const ux = largo > EPS ? (B.x - A.x) / largo : 0
    const uy = largo > EPS ? (B.y - A.y) / largo : 0
    return {
      A,
      B,
      punta: `${B.x},${B.y} ${B.x - 9 * ux - 4.5 * uy},${B.y - 9 * uy + 4.5 * ux} ${B.x - 9 * ux + 4.5 * uy},${B.y - 9 * uy - 4.5 * ux}`,
    }
  }

  // Normal hacia la cámara: las superficies translúcidas se ven de los dos lados
  const haciaCamara = (nr: Vec3) => (caraVisible(nr, cam) ? nr : escalar(nr, -1))

  // ── Modo jacobiano: celda curva (cada cara en quads chicos con su normal exterior) ──
  const kCelda = moviendo ? 4 : 8
  const celda = jacobiano && !plano
    ? ordenarPintor(
        carasCelda(S, q0, d, kCelda)
          .filter((c) => caraVisible(c.normal, cam))
          .map((c) => ({ ...c, color: tono(info.colores[c.familia], sombra(c.normal)) })),
        cam,
      )
    : []
  // En polares la celda es un sector de corona en el piso
  const celdaPlana = jacobiano && plano
    ? parche((s, t) => S.X([q0[0] + s * d[0], q0[1] + t * d[1], 0]), kCelda, rgb(FUCSIA), 0.8)
    : []
  const bordePlano = jacobiano && plano
    ? [
        curvaCoordenada(S, q0, 1, q0[1], q0[1] + d[1]),
        curvaCoordenada(S, [q0[0] + d[0], q0[1], 0], 1, q0[1], q0[1] + d[1]),
        curvaCoordenada(S, q0, 0, q0[0], q0[0] + d[0], 2),
        curvaCoordenada(S, [q0[0], q0[1] + d[1], 0], 0, q0[0], q0[0] + d[0], 2),
      ]
    : []
  // Aproximación lineal: paralelepípedo generado por Δuᵢ·∂X/∂uᵢ en P
  const tangente = aristasParalelepipedo(P, [escalar(cols[0], d[0]), escalar(cols[1], d[1]), escalar(cols[2], d[2])])

  // Guías de posición de P (debajo de la celda)
  const pie: Vec3 = { x: P.x, y: P.y, z: 0 }
  const radioArco = 0.7
  const arcoTheta = curvaCoordenada(SISTEMAS.cilindricas, [radioArco, 0, 0], 1, 0, theta)
  const arcoPhi = esf ? curvaCoordenada(S, [radioArco, 0, theta], 1, 0, phiEf) : []

  // ── Modo superficies: las tres superficies coordenadas por P ──
  const rangos = (i: Eje): [Dominio, Dominio] => {
    const radial: Dominio = { min: 0, max: R_SUP }
    const vuelta: Dominio = { min: 0, max: 2 * PI }
    const altura: Dominio = { min: -Z_SUP, max: Z_SUP }
    if (esf) return i === 0 ? [{ min: 0, max: PI }, vuelta] : i === 1 ? [vuelta, radial] : [radial, { min: 0, max: PI }]
    return i === 0 ? [vuelta, altura] : i === 1 ? [altura, radial] : [radial, vuelta]
  }
  const finura = (rango: Dominio) => Math.max(4, Math.round(((rango.max - rango.min) / (moviendo ? 0.5 : 0.25))))
  const superficies: (CaraConNormal & { familia: Eje })[] =
    !jacobiano && !plano
      ? ordenarPintor(
          indices.flatMap((i) => {
            const [rj, rl] = rangos(i)
            return superficieCoordenada(S, i, q0[i], rj, rl, finura(rj), finura(rl)).map((c) => ({
              ...c,
              familia: i,
              color: tono(info.colores[i], sombra(haciaCamara(c.normal))),
            }))
          }),
          cam,
        )
      : []
  // Curvas coordenadas por P: solo varía la coordenada i (intersección de las otras dos superficies)
  const curvaPorP = (i: Eje): Vec3[] => {
    const nombre = S.nombres[i]
    if (nombre === 'θ') return curvaCoordenada(S, q0, i, 0, 2 * PI, 64)
    if (nombre === 'φ') return curvaCoordenada(S, q0, i, 0, PI, 48)
    if (nombre === 'z') return curvaCoordenada(S, q0, i, -Z_SUP, Z_SUP, 2)
    return curvaCoordenada(S, q0, i, 0, R_SUP, 2)
  }
  const versores = indices.map((i) => ({ i, ...flecha(P, sumar(P, escalar(unitario(cols[i]), 0.9))) }))
  // Ortogonalidad: productos escalares entre las columnas del Jacobiano
  const productos = plano
    ? [punto(cols[0], cols[1])]
    : [punto(cols[0], cols[1]), punto(cols[1], cols[2]), punto(cols[2], cols[0])]

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

  // Columna de la coordenada radial, la angular θ y la tercera, según el sistema
  const iRadial: Eje = 0
  const iTheta: Eje = esf ? 2 : 1
  const unidad = plano ? 'ΔA' : 'ΔV'
  const productoDeltas = indices.map(nombreDelta).join(' ')

  return (
    <HTMLContainer
      id={id}
      style={{ pointerEvents: 'all' }}
      className="w-full h-full bg-zinc-950 border-2 border-purple-500/60 rounded-xl p-3 text-white shadow-2xl flex flex-col gap-2 select-none pointer-events-auto"
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
        Cambio de variables · {info.label} · {jacobiano ? 'Jacobiano' : 'Superficies coordenadas'}
      </span>

      {/* Panel */}
      <div className="bg-zinc-900 font-mono text-xs rounded-lg p-2 border border-zinc-800 flex flex-col gap-y-1">
        <span className="text-violet-300">{S.formulas.slice(0, n).join(' · ')}</span>
        {jacobiano ? (
          <>
            <div className="flex items-center gap-3">
              <span className="text-zinc-300 whitespace-nowrap">J(P) =</span>
              <div className={`grid gap-x-3 gap-y-0.5 text-right ${plano ? 'grid-cols-2' : 'grid-cols-3'} border-x border-zinc-500 px-2`}>
                {indices.map((i) => (
                  <span key={`h${i}`} className={`${info.clases[i]} text-[10px]`}>
                    ∂/∂{S.nombres[i]}
                  </span>
                ))}
                {(['x', 'y', 'z'] as const).slice(0, n).flatMap((eje) =>
                  indices.map((i) => (
                    <span key={`${eje}${i}`} className="text-zinc-100">
                      {formatEs(cols[i][eje], 3)}
                    </span>
                  )),
                )}
              </div>
              <span className="text-zinc-400 whitespace-nowrap">
                en ({indices.map(valorCoord).join('; ')})
              </span>
            </div>
            <span className="text-fuchsia-300">
              |J| = {S.textoJ} = {formatEs(J, 4)}
            </span>
            <span className="text-indigo-300">
              {unidad} ≈ |J|·{productoDeltas} = {formatEs(lineal, 4)}
            </span>
            <span className="text-amber-300">
              {unidad} exacto = {S.textoExacto} = {formatEs(exacto, 4)}
            </span>
            <span className="text-zinc-300">
              Error relativo = {exacto > EPS ? `${conSigno(errorRel)} %` : '—'} (con Δ → 0 tiende a 0)
            </span>
          </>
        ) : (
          <>
            <span className="text-zinc-300">
              {indices.map((i) => (
                <span key={i} className={info.clases[i]}>
                  {S.nombres[i]} = {valorCoord(i)} ({info.superficies[i]}){i < n - 1 ? ' · ' : ''}
                </span>
              ))}
            </span>
            <span className="text-zinc-300">
              Escalas:{' '}
              {indices.map((i) => (
                <span key={i} className={info.clases[i]}>
                  h{S.nombres[i]} = {info.escalas[i] === '1' ? '1' : `${info.escalas[i]} = ${formatEs(escalas[i], 3)}`}
                  {i < n - 1 ? ' · ' : ''}
                </span>
              ))}
            </span>
            <span className="text-violet-300">
              Columnas de J ortogonales: {productos.map((p) => formatEs(p, 3)).join(', ')} ⇒ |J| = {indices.map((i) => `h${S.nombres[i]}`).join('·')} ={' '}
              {formatEs(J, 4)}
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
            {/* Ejes */}
            {(
              [
                ['x', { x: R_SUP + 0.4, y: 0, z: 0 }, '#f87171'],
                ['y', { x: 0, y: R_SUP + 0.4, z: 0 }, '#4ade80'],
                ...(plano ? [] : [['z', { x: 0, y: 0, z: Z_SUP + 0.6 }, '#38bdf8']]),
              ] as [string, Vec3, string][]
            ).map(([txt, q, c]) => {
              const s = pantalla(q)
              return (
                <g key={txt}>
                  <path d={linea([O, q])} stroke={c} strokeOpacity={0.5} strokeWidth={1.5} />
                  <text x={s.x} y={s.y} fill={c} textAnchor="middle" dominantBaseline="middle" className="text-[12px] font-mono">
                    {txt}
                  </text>
                </g>
              )
            })}

            {jacobiano ? (
              <>
                {/* Posición de P: radio, proyección al piso y ángulos */}
                <g fill="none" className="stroke-zinc-400" strokeWidth={1} strokeDasharray="4 3">
                  <path d={linea([O, P])} />
                  {!plano && <path d={linea([O, pie, P])} />}
                </g>
                <path d={linea(arcoTheta)} fill="none" className="stroke-indigo-300" strokeWidth={1.5} />
                {esf && <path d={linea(arcoPhi)} fill="none" className="stroke-amber-300" strokeWidth={1.5} />}

                {/* Celda curva (pintor); en cada quad, los lados que caen en el borde de la cara */}
                {celda.map((c, i) => (
                  <g key={i}>
                    <polygon points={pts(c.pts)} fill={c.color} stroke={c.color} strokeWidth={0.6} />
                    {c.aristas.map(([a, b], j) => (
                      <path key={j} d={linea([a, b])} className="stroke-zinc-100" strokeOpacity={0.85} strokeWidth={1} />
                    ))}
                  </g>
                ))}
                {celdaPlana.map((c, i) => (
                  <polygon key={i} points={pts(c.pts)} fill={c.color} fillOpacity={c.opacidad} stroke={c.color} strokeWidth={0.6} />
                ))}
                {bordePlano.map((b, i) => (
                  <path key={i} d={linea(b)} fill="none" className="stroke-zinc-100" strokeWidth={1.2} />
                ))}

                {/* Aproximación lineal: paralelepípedo tangente (en polares, paralelogramo) */}
                {verLineal && (
                  <g fill="none" className="stroke-white" strokeWidth={1.4} strokeDasharray="5 4" pointerEvents="none">
                    {tangente.map(([a, b], i) => (
                      <path key={i} d={linea([a, b])} />
                    ))}
                  </g>
                )}
              </>
            ) : (
              <>
                {superficies.map((c, i) => (
                  <polygon
                    key={i}
                    points={pts(c.pts)}
                    fill={c.color}
                    fillOpacity={0.28}
                    stroke={c.color}
                    strokeOpacity={0.3}
                    strokeWidth={0.6}
                  />
                ))}
                {/* Curvas coordenadas por P (en polares: la circunferencia y la semirrecta) */}
                {indices.map((i) => (
                  <path
                    key={i}
                    d={linea(curvaPorP(i))}
                    fill="none"
                    stroke={plano ? rgb(info.colores[(1 - i) as Eje]) : 'white'}
                    strokeOpacity={plano ? 1 : 0.9}
                    strokeWidth={plano ? 2.5 : 1.2}
                    strokeDasharray={plano ? undefined : '3 3'}
                  />
                ))}
                {versores.map(({ i, A, B, punta }) => (
                  <g key={i} stroke={rgb(info.colores[i])} fill={rgb(info.colores[i])}>
                    <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} strokeWidth={2.5} />
                    <polygon points={punta} />
                    <text x={B.x + 6} y={B.y - 6} stroke="none" className="text-[12px] font-mono">
                      ê{S.nombres[i]}
                    </text>
                  </g>
                ))}
              </>
            )}

            {/* Punto P */}
            {(() => {
              const s = pantalla(P)
              return (
                <g>
                  <circle cx={s.x} cy={s.y} r={4} className="fill-white stroke-zinc-950" strokeWidth={1.5} />
                  <text x={s.x - 8} y={s.y + 14} textAnchor="end" className="fill-white text-[12px] font-mono">
                    P
                  </text>
                </g>
              )
            })()}
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
          {ORDEN_SISTEMAS.map((key) => (
            <button
              key={key}
              // Polares vive en el piso: se mira desde arriba; al volver a 3D, vista 3D
              onClick={() => actualizar({ sistema: key, ...(key === 'polares' ? VISTA_PISO : sistema === 'polares' ? VISTA_3D : {}) })}
              className={boton(key === sistema)}
            >
              {INFO[key].label}
            </button>
          ))}
          <span className="ml-auto" />
          <button onClick={() => actualizar(VISTA_PISO)} className={boton(false)}>
            Vista Piso XY
          </button>
          <button onClick={() => actualizar(VISTA_3D)} className={boton(false)}>
            Vista 3D
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => actualizar({ modo: 'jacobiano' })} className={boton(jacobiano)}>
            Jacobiano
          </button>
          <button onClick={() => actualizar({ modo: 'superficies' })} className={boton(!jacobiano)}>
            Superficies
          </button>
          {jacobiano && (
            <label className="flex items-center gap-1 text-zinc-300 whitespace-nowrap">
              <input
                type="checkbox"
                checked={verLineal}
                onChange={(e) => actualizar({ verLineal: e.target.checked })}
                className="accent-fuchsia-500 cursor-pointer"
              />
              Aproximación lineal
            </label>
          )}
          <span className="ml-auto" />
          <button onClick={() => actualizar({ zoom: acotar(zoom * 0.8, 0.6, 2) })} className={boton(false)}>
            Zoom −
          </button>
          <button onClick={() => actualizar({ zoom: acotar(zoom * 1.25, 0.6, 2) })} className={boton(false)}>
            Zoom +
          </button>
        </div>

        {esf
          ? rango(`ρ = ${formatEs(rho)}`, rho, 0, 3, (v) => actualizar({ rho: acotar(ajustar(v, 0.05, IMANES_R), 0, 3) }), info.clases[iRadial])
          : rango(`r = ${formatEs(r)}`, r, 0, 3, (v) => actualizar({ r: acotar(ajustar(v, 0.05, IMANES_R), 0, 3) }), info.clases[iRadial])}
        {rango(`θ = ${fraccionPi(theta)}`, theta, 0, 2 * PI, (v) => actualizar({ theta: acotar(ajustar(v, 0.01, NOTABLES), 0, 2 * PI) }), info.clases[iTheta])}
        {esf &&
          rango(`φ = ${fraccionPi(phiEf)}`, phi, 0, PI, (v) => actualizar({ phi: acotar(ajustar(v, 0.01, NOTABLES_PHI), 0, PI) }), info.clases[1])}
        {sistema === 'cilindricas' &&
          rango(`z = ${formatEs(z0)}`, z0, -1.5, 1.5, (v) => actualizar({ z0: acotar(ajustar(v, 0.05, [-1, 0, 1]), -1.5, 1.5) }), info.clases[2])}
        {jacobiano &&
          rango(
            `Δ = ${formatEs(delta)}`,
            delta,
            0.05,
            1,
            (v) => actualizar({ delta: acotar(ajustar(v, 0.01, [0.1, 0.25, 0.5, 1]), 0.05, 1) }),
            'text-zinc-200',
          )}
      </div>
    </HTMLContainer>
  )
}

export class CambioVariables3DShapeUtil extends LabShapeUtil<CambioVariables3DShape> {
  static override type = 'cambio-variables-3d' as const

  static override props = cambioVariables3DProps

  override getDefaultProps(): Props {
    return { ...cambioVariables3DDefaults }
  }

  override contenido(shape: CambioVariables3DShape) {
    const actualizar = (props: Partial<Props>) => {
      this.editor.updateShape<CambioVariables3DShape>({ id: shape.id, type: 'cambio-variables-3d', props })
    }
    return (
      <CambioVariables
        id={shape.id}
        props={shape.props}
        actualizar={actualizar}
        empezarGiro={() => this.editor.markHistoryStoppingPoint('girar-3d')}
      />
    )
  }

  override indicator(shape: CambioVariables3DShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />
  }

  override getIndicatorPath(shape: CambioVariables3DShape): Path2D {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 12)
    return path
  }
}
