'use client'

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { HTMLContainer, type TLShape } from 'tldraw'
import { LabShapeUtil } from '@/components/LabShapeUtil'
import { graficador3DProps, graficador3DDefaults, graficador3DMigrations } from '@/shapes/schemas'
import type { DespejadaGraficador3D as Despejada } from '@/shapes/schemas'
import { acotar, ajustar, pasoLindo } from '@/lib/plot'
import { formatEs } from '@/lib/linear2d'
import { parsear2, type Parseo2, type Variable } from '@/lib/parser'
import {
  celdasExplicitas,
  colorAltura,
  curvasNivel,
  muestrear,
  normalPoligono,
  parche,
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
/** Cara de la superficie, del plano de corte o segmento de curva de nivel (2 puntos), todo en el mismo pintor */
type Pieza = Cara & { segmento?: boolean }

const PI = Math.PI

/**
 * Se trabaja en coordenadas locales (u, v, w): w es la variable despejada, u y v las independientes.
 * aMundo reacomoda el punto en (x, y, z) recién al final, así la malla, la ventana y las curvas
 * de nivel son las mismas cuentas para los tres casos.
 */
const MODOS: Record<Despejada, { vars: [Variable, Variable]; aMundo: (q: Vec3) => Vec3 }> = {
  z: { vars: ['x', 'y'], aMundo: (q) => q },
  x: { vars: ['y', 'z'], aMundo: (q) => ({ x: q.z, y: q.x, z: q.y }) },
  y: { vars: ['x', 'z'], aMundo: (q) => ({ x: q.x, y: q.z, z: q.y }) },
}
const ORDEN_MODOS: Despejada[] = ['z', 'x', 'y']
const COLOR_EJE: Record<Variable, string> = { x: '#f87171', y: '#4ade80', z: '#a1a1aa' }

// U y V se reemplazan por las variables independientes del modo
const EJEMPLOS: { label: string; expr: string }[] = [
  { label: 'Paraboloide', expr: 'U^2 + V^2' },
  { label: 'Silla', expr: 'U^2 - V^2' },
  { label: 'Ondas', expr: 'sen(U)*cos(V)' },
  { label: 'Gaussiana', expr: 'exp(-(U^2 + V^2))' },
  { label: 'Cono', expr: 'raiz(U^2 + V^2)' },
  { label: 'Sombrero', expr: 'sen(raiz(U^2 + V^2))/raiz(U^2 + V^2)' },
  { label: 'Semiesfera', expr: 'raiz(9 - U^2 - V^2)' },
  { label: 'Plano', expr: '2U - V + 1' },
]
const VISTAS: { label: string; cam: Camara }[] = [
  { label: 'Iso', cam: { acimut: -2.2, elevacion: 0.55 } },
  { label: 'Frente', cam: { acimut: 0, elevacion: 0.1 } },
  { label: 'Arriba', cam: { acimut: 0, elevacion: PI / 2 } },
]
const VB_W = 600
const VB_H = 450
const ESCALA_BASE = 130
const Z_LIMITE = 20
const NIVELES = 7

const frenar = (e: { stopPropagation: () => void }) => e.stopPropagation()

const multiplos = (lo: number, hi: number, paso: number) =>
  Array.from({ length: Math.max(0, Math.floor(hi / paso) - Math.ceil(lo / paso) + 1) }, (_, i) => (Math.ceil(lo / paso) + i) * paso)

const ejemplo = (expr: string, [u, v]: [Variable, Variable]) => expr.replaceAll('U', u).replaceAll('V', v)

/** Renombra las variables de la expresión al cambiar de modo: la primera independiente pasa a la primera, etc. */
function renombrar(expr: string, de: [Variable, Variable], a: [Variable, Variable]): string {
  const mapa: Record<string, string> = { [de[0]]: a[0], [de[1]]: a[1] }
  return expr.replace(/[a-zA-ZáéíóúñÑπ]+/g, (w) => (/^[xyzXYZ]+$/.test(w) ? [...w.toLowerCase()].map((c) => mapa[c] ?? c).join('') : w))
}

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
  const { despejada, exprZ, rango: R, zAuto, escala, zoom, verNivel, nivelEnAltura, verSuperficie, verCorte, corte } = props
  const { vars, aMundo } = MODOS[despejada]
  const [u, v] = vars
  const uid = id.replace(/[^a-zA-Z0-9]/g, '')

  // Si la expresión tiene un error, se sigue dibujando la última válida
  const parseo = useMemo(() => parsear2(exprZ, vars), [exprZ, vars])
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

  // 2. Ventana de la variable despejada: automática por percentiles o manual
  const auto = useMemo(() => (val ? ventanaZ(val) : null), [val])
  const { zMin, zMax } = props
  const ventana: Dominio = useMemo(
    () => (zAuto ? (auto ?? { min: -1, max: 1 }) : { min: zMin, max: zMax }),
    [zAuto, auto, zMin, zMax],
  )

  // 3. Cubo normalizado [−1, 1]³ en locales: U = u/R, V = v/R, W = (w − wc)/s; después se pasa a (x, y, z)
  const wc = (ventana.min + ventana.max) / 2
  const semi = (ventana.max - ventana.min) / 2
  const s = escala === 'ajustada' ? semi : R
  const alto = semi / s
  const local = (q: Vec3): Vec3 => ({ x: q.x / R, y: q.y / R, z: (q.z - wc) / s })
  const norm = (q: Vec3): Vec3 => aMundo(local(q))

  // Plano de corte w = k, con k entre los extremos de la ventana
  const kCorte = ventana.min + corte * (ventana.max - ventana.min)

  const malla = useMemo(() => {
    if (!val) return { caras: [] as Pieza[], indefinidas: 0 }
    const { celdas, indefinidas } = celdasExplicitas(val, dom, ventana)
    const caras = celdas.map((celda): Pieza => {
      const pts = celda.map((q) => ({ x: q.x / R, y: q.y / R, z: (q.z - wc) / s }))
      // La luz se calcula en locales: "arriba" es siempre la variable despejada
      const nn = normalPoligono(pts)
      const wMedio = celda.reduce((acc, q) => acc + q.z, 0) / celda.length
      const luz = sombra(nn.z < 0 ? { x: -nn.x, y: -nn.y, z: -nn.z } : nn)
      return { pts: pts.map(aMundo), color: colorAltura(wMedio, ventana.min, ventana.max, luz) }
    })
    return { caras, indefinidas }
  }, [val, dom, ventana, R, wc, s, aMundo])

  // Curvas de nivel f = c: en el piso (mapa) o cada una a su altura w = c (construyen la superficie)
  const nivel = useMemo(() => {
    if (!val || !f || !verNivel) return []
    const niveles = Array.from({ length: NIVELES }, (_, i) => ventana.min + ((ventana.max - ventana.min) * (i + 0.5)) / NIVELES)
    return niveles.flatMap((c) =>
      curvasNivel(f, dom, n, [c], nivelEnAltura ? c : ventana.min, val).map((seg) => ({ seg, c })),
    )
  }, [val, f, verNivel, nivelEnAltura, dom, n, ventana])

  // Traza del corte: la curva f = k (a su altura) y su sombra en el piso
  const traza = useMemo(() => {
    if (!val || !f || !verCorte) return []
    return curvasNivel(f, dom, n, [kCorte], kCorte, val)
  }, [val, f, verCorte, dom, n, kCorte])

  const piezas = useMemo(() => {
    const lista: Pieza[] = verSuperficie ? [...malla.caras] : []
    if (nivelEnAltura)
      for (const { seg, c } of nivel)
        lista.push({ pts: seg.map(norm), color: colorAltura(c, ventana.min, ventana.max, 1.15), segmento: true })
    if (verCorte)
      lista.push(
        ...parche((a, b) => norm({ x: -R + 2 * R * a, y: -R + 2 * R * b, z: kCorte }), 8, '#fbbf24', 0.22),
      )
    // Pintor con un empujoncito para las curvas: están apoyadas en la superficie y sin él empatan con sus celdas
    const cam = { acimut, elevacion }
    const prof = (c: Pieza) => c.pts.reduce((acc, q) => acc + proyectar(q, cam).prof, 0) / c.pts.length + (c.segmento ? 0.04 : 0)
    return lista
      .map((c) => ({ c, p: prof(c) }))
      .sort((a, b) => a.p - b.p)
      .map(({ c }) => c)
    // norm depende de R, wc, s y aMundo, que ya están en la lista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [malla, verSuperficie, nivel, nivelEnAltura, verCorte, kCorte, R, wc, s, aMundo, ventana, acimut, elevacion])

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

  // Piso en w = mínimo de la ventana, grilla en múltiplos lindos de u y v
  const piso = (a: number, b: number): Vec3 => norm({ x: a, y: b, z: ventana.min })
  const marcas = multiplos(-R, R, pasoLindo(2 * R))
  const borde = [piso(-R, -R), piso(R, -R), piso(R, R), piso(-R, R), piso(-R, -R)]
  const techo = norm({ x: 0, y: 0, z: ventana.max })
  const sobreTecho = norm({ x: 0, y: 0, z: ventana.max + 0.25 * s })

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

  const cambiarModo = (nuevo: Despejada) => {
    if (nuevo === despejada) return
    actualizar({ despejada: nuevo, exprZ: renombrar(exprZ, vars, MODOS[nuevo].vars) })
  }

  const deformada = escala === 'ajustada' && Math.abs(semi / R - 1) > 0.05
  const check = (etiqueta: string, valor: boolean, cambiar: (b: boolean) => void, deshabilitado = false) => (
    <label className={`flex items-center gap-1 ${deshabilitado ? 'text-zinc-600' : 'text-zinc-300'}`}>
      <input
        type="checkbox"
        checked={valor}
        disabled={deshabilitado}
        onChange={(e) => cambiar(e.target.checked)}
        className="accent-fuchsia-500 cursor-pointer"
      />
      {etiqueta}
    </label>
  )

  return (
    <HTMLContainer
      id={id}
      style={{ pointerEvents: 'all' }}
      className="w-full h-full bg-zinc-950 border-2 border-purple-500/60 rounded-xl p-3 text-white shadow-2xl flex flex-col gap-2 select-none pointer-events-auto"
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
        Graficador 3D · {despejada} = f({u}, {v})
      </span>

      {/* Expresión */}
      <div
        className="bg-zinc-900 font-mono text-xs rounded-lg p-2 border border-zinc-800 flex flex-col gap-y-1"
        onPointerDown={frenar}
        onPointerMove={frenar}
        onPointerUp={frenar}
      >
        <label className="flex items-center gap-2 font-mono text-violet-300">
          <span className="w-20 shrink-0 whitespace-nowrap">
            {despejada} = f({u}, {v}) =
          </span>
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
          <span className="text-zinc-500">
            Variables {u}, {v} · ^ para potencias, sen cos tg ln raiz abs exp, pi. Ej: 3{u}{v}^2
          </span>
        ) : (
          <span className="text-red-400">
            {parseo.error} (posición {parseo.pos + 1}) · se muestra la última función válida
          </span>
        )}
        <span className="text-zinc-300">
          Caja: {u}, {v} ∈ [{formatEs(-R)}; {formatEs(R)}] · {despejada} ∈ [{formatEs(ventana.min)}; {formatEs(ventana.max)}]{' '}
          {zAuto ? '(automática)' : '(manual)'}
        </span>
        {verCorte && (
          <span className="text-amber-300">
            Corte {despejada} = {formatEs(kCorte)} → curva de nivel f({u}, {v}) = {formatEs(kCorte)}
          </span>
        )}
        {malla.indefinidas > 0 && (
          <span className="text-amber-300">{malla.indefinidas} celdas fuera del dominio de f (quedan como agujeros)</span>
        )}
        {deformada && (
          <span className="text-zinc-500">Escala ajustada: el eje {despejada} está estirado o achicado para que entre.</span>
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
                  <path d={linea([piso(m, -R), piso(m, R)])} />
                  <path d={linea([piso(-R, m), piso(R, m)])} />
                </g>
              ))}
            </g>
            <path d={linea(borde)} fill="none" className="stroke-zinc-700" strokeWidth={1} />
            <path d={linea([piso(-R, 0), piso(R, 0)])} stroke={COLOR_EJE[u]} strokeOpacity={0.5} strokeWidth={1.5} />
            <path d={linea([piso(0, -R), piso(0, R)])} stroke={COLOR_EJE[v]} strokeOpacity={0.5} strokeWidth={1.5} />
            <path d={linea([piso(0, 0), techo])} stroke={COLOR_EJE[despejada]} strokeOpacity={0.6} strokeWidth={1.5} />
            {(
              [
                [u, piso(1.12 * R, 0)],
                [v, piso(0, 1.12 * R)],
                [despejada, sobreTecho],
              ] as const
            ).map(([t, q]) => {
              const p = pantalla(q)
              return (
                <text
                  key={t}
                  x={p.x}
                  y={p.y}
                  fill={COLOR_EJE[t]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-[12px] font-mono"
                >
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
                <text key={`w${t}`} x={p.x + 8} y={p.y} className="fill-zinc-400 text-[10px] font-mono" dominantBaseline="middle">
                  {t}
                </text>
              )
            })}

            {/* Curvas de nivel en el piso (mapa topográfico) */}
            {!nivelEnAltura &&
              nivel.map(({ seg: [a, b] }, i) => (
                <path key={`n${i}`} d={linea([norm(a), norm(b)])} className="stroke-violet-400" strokeOpacity={0.7} strokeWidth={1.2} />
              ))}

            {/* Sombra de la traza en el piso */}
            {traza.map(([a, b], i) => (
              <path
                key={`ts${i}`}
                d={linea([norm({ ...a, z: ventana.min }), norm({ ...b, z: ventana.min })])}
                className="stroke-amber-400"
                strokeOpacity={0.8}
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
            ))}

            {/* Superficie, curvas en altura y plano de corte (orden del pintor) */}
            {piezas.map((c, i) =>
              c.segmento ? (
                <path key={i} d={linea(c.pts)} stroke={c.color} strokeWidth={1.8} strokeLinecap="round" />
              ) : (
                <polygon
                  key={i}
                  points={pts(c.pts)}
                  fill={c.color}
                  fillOpacity={c.opacidad ?? 1}
                  stroke={c.opacidad === undefined ? 'rgba(24,24,27,0.35)' : 'none'}
                  strokeWidth={0.6}
                />
              ),
            )}

            {/* Traza a su altura, siempre encima */}
            {traza.map(([a, b], i) => (
              <path key={`t${i}`} d={linea([norm(a), norm(b)])} className="stroke-amber-300" strokeWidth={2.5} strokeLinecap="round" />
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
          <span className="text-zinc-400 mr-1">Despejar:</span>
          {ORDEN_MODOS.map((m) => (
            <button key={m} onClick={() => cambiarModo(m)} className={`${boton(m === despejada)} font-mono`}>
              {m} = f({MODOS[m].vars[0]}, {MODOS[m].vars[1]})
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {EJEMPLOS.map(({ label, expr }) => {
            const e = ejemplo(expr, vars)
            return (
              <button key={label} onClick={() => actualizar({ exprZ: e })} className={boton(e === exprZ)}>
                {label}
              </button>
            )
          })}
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
          <button
            onClick={() => actualizar({ escala: escala === 'ajustada' ? 'real' : 'ajustada' })}
            className="ml-auto px-2 py-0.5 rounded-full bg-indigo-600/80 hover:bg-indigo-500 text-white cursor-pointer"
          >
            Escala: {escala === 'ajustada' ? 'ajustada' : 'real 1:1'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {check('Superficie', verSuperficie, (b) => actualizar({ verSuperficie: b }))}
          {check('Curvas de nivel', verNivel, (b) => actualizar({ verNivel: b }))}
          {check('en altura', nivelEnAltura, (b) => actualizar({ nivelEnAltura: b }), !verNivel)}
          {check(`Ventana ${despejada} automática`, zAuto, cambiarAuto)}
        </div>

        <div className="flex items-center justify-between gap-2">
          {check(`Corte ${despejada} = ${formatEs(kCorte)}`, verCorte, (b) => actualizar({ verCorte: b }))}
          <input
            type="range"
            min={0}
            max={1}
            step="any"
            value={corte}
            disabled={!verCorte}
            onChange={(e) => actualizar({ corte: acotar(ajustar(Number(e.target.value), 0.02), 0, 1) })}
            className="w-64 accent-amber-400 cursor-pointer disabled:opacity-40"
          />
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
              <span className="w-24 shrink-0 whitespace-nowrap">
                {despejada} mín = {formatEs(zMin)}
              </span>
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
              <span className="w-24 shrink-0 whitespace-nowrap">
                {despejada} máx = {formatEs(zMax)}
              </span>
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

  static override migrations = graficador3DMigrations

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
