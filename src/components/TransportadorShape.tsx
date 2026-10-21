'use client'

import { useState, type PointerEvent } from 'react'
import {
  BaseBoxShapeUtil,
  DefaultColorStyle,
  Circle2d,
  HTMLContainer,
  Polygon2d,
  Vec,
  useEditor,
  useValue,
  type Geometry2d,
  type TLShape,
  type TLShapeId,
  type TLShapePartial,
} from 'tldraw'
import { transportadorProps, transportadorDefaults } from '@/shapes/schemas'
import { BASE_TRANSPORTADOR, PX_POR_CM, RADIO_TRANSPORTADOR as R, medidasTransportador, polarSvg } from '@/lib/geometria'
import { crearSegmento } from '@/lib/trazos'

export type TransportadorShape = TLShape<'transportador'>
type Props = TransportadorShape['props']

// Largo de cada marca, desde el borde hacia el centro
const MARCA_10 = 20
const MARCA_5 = 13
const MARCA_1 = 7
// Radios donde van los números: escala exterior (0° a la derecha) e interior (0° a la izquierda)
const R_EXTERIOR = R - 32
const R_INTERIOR = R - 50
const R_ADORNO = R - 64
// Anillo de la escala donde se marca un ángulo, y largo del rayo que se traza (1 cm más allá del borde)
const R_ANILLO = R - 12
const ANCHO_ANILLO = 32
const R_RAYO = R + PX_POR_CM

const frenar = (e: { stopPropagation: () => void }) => e.stopPropagation()

/** Marcas de 1°, 5° y 10° como tres `d`. Semicírculo: 0..180; completo: 0..359 */
function marcas(completo: boolean, cx: number, cy: number) {
  const tope = completo ? 359 : 180
  const d = { diez: '', cinco: '', uno: '' }
  for (let g = 0; g <= tope; g++) {
    const largo = g % 10 === 0 ? MARCA_10 : g % 5 === 0 ? MARCA_5 : MARCA_1
    const p = polarSvg(cx, cy, R, g)
    const q = polarSvg(cx, cy, R - largo, g)
    const tramo = `M${p.x} ${p.y}L${q.x} ${q.y}`
    if (g % 10 === 0) d.diez += tramo
    else if (g % 5 === 0) d.cinco += tramo
    else d.uno += tramo
  }
  return d
}

/** Tamaño actual / tamaño de diseño (R = 5 cm). Los ángulos no dependen del tamaño: se puede agrandar para proyectarlo. */
const escalaDe = (props: Props): number => props.w / medidasTransportador(props.completo).w

/** Contorno: semicírculo con franja recta abajo, o círculo completo */
function contornoSvg(completo: boolean, cx: number, cy: number): string {
  if (completo) return `M${cx - R} ${cy}A${R} ${R} 0 1 1 ${cx + R} ${cy}A${R} ${R} 0 1 1 ${cx - R} ${cy}Z`
  const abajo = cy + BASE_TRANSPORTADOR
  return `M${cx - R} ${cy}A${R} ${R} 0 0 1 ${cx + R} ${cy}L${cx + R} ${abajo}L${cx - R} ${abajo}Z`
}

function Transportador({ id, props, actualizar }: { id: TLShapeId; props: Props; actualizar: (p: Partial<Props>) => void }) {
  const editor = useEditor()
  const oscuro = useValue('oscuro', () => editor.user.getIsDarkMode(), [editor])
  const seleccionado = useValue('seleccionado', () => editor.getOnlySelectedShapeId() === id, [editor, id])

  const { completo } = props
  const { w, h, cx, cy } = medidasTransportador(completo)
  const s = escalaDe(props)
  const [apuntado, setApuntado] = useState<number | null>(null)

  /** Grado entero que señala el puntero, medido desde el centro (0° a la derecha, antihorario) */
  const gradoBajo = (e: PointerEvent) => {
    const local = editor.getPointInShapeSpace(id, editor.screenToPage({ x: e.clientX, y: e.clientY }))
    let g = (Math.atan2(cy - local.y / s, local.x / s - cx) * 180) / Math.PI
    if (g < 0) g += 360
    // En el semicírculo, lo que cae debajo de la base va al 0° o al 180° más cercano
    if (!completo && g > 180) g = g > 270 ? 0 : 180
    return Math.round(g) % 360
  }

  // Marcar un ángulo: un segmento nativo del centro hasta 1 cm afuera del borde, en ese grado
  const trazarRayo = (g: number) => {
    const aHoja = editor.getShapePageTransform(id)
    const fin = polarSvg(cx, cy, R_RAYO, g)
    editor.markHistoryStoppingPoint('marcar-angulo')
    crearSegmento(editor, aHoja.applyToPoint({ x: cx * s, y: cy * s }), aHoja.applyToPoint({ x: fin.x * s, y: fin.y * s }), {
      color: editor.getStyleForNextShape(DefaultColorStyle),
      size: 's',
    })
  }
  const d = marcas(completo, cx, cy)
  const tinta = oscuro ? '#e9d5ff' : '#4c1d95'
  const cuerpo = oscuro ? 'rgba(168, 85, 247, 0.16)' : 'rgba(168, 85, 247, 0.10)'

  const decenas = Array.from({ length: completo ? 36 : 19 }, (_, k) => k * 10)
  const numero = (g: number, r: number, valor: number, tamano: number, opacidad: number) => {
    const p = polarSvg(cx, cy, r, g)
    return (
      <text
        key={`${r}-${g}`}
        x={p.x}
        y={p.y}
        transform={`rotate(${90 - g} ${p.x} ${p.y})`}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={tamano}
        className="font-mono"
        fill={tinta}
        opacity={opacidad}
      >
        {valor}
      </text>
    )
  }

  const adorno = completo
    ? `M${cx - R_ADORNO} ${cy}A${R_ADORNO} ${R_ADORNO} 0 1 1 ${cx + R_ADORNO} ${cy}A${R_ADORNO} ${R_ADORNO} 0 1 1 ${cx - R_ADORNO} ${cy}`
    : `M${cx - R_ADORNO} ${cy}A${R_ADORNO} ${R_ADORNO} 0 0 1 ${cx + R_ADORNO} ${cy}`

  return (
    <HTMLContainer id={id} style={{ pointerEvents: 'all' }} className="w-full h-full select-none">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full overflow-visible">
        <path d={contornoSvg(completo, cx, cy)} fill={cuerpo} stroke={tinta} strokeOpacity={0.6} strokeWidth={1.5} />
        <path d={d.uno} stroke={tinta} strokeWidth={0.75} />
        <path d={d.cinco} stroke={tinta} strokeWidth={1} />
        <path d={d.diez} stroke={tinta} strokeWidth={1.4} />
        <path d={adorno} fill="none" stroke={tinta} strokeOpacity={0.35} strokeWidth={1} />
        {decenas.map((g) => numero(g, R_EXTERIOR, g, 12, 1))}
        {!completo && decenas.map((g) => numero(g, R_INTERIOR, 180 - g, 10, 0.7))}
        {/* Línea de 0°–180° y centro bien marcado */}
        <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke={tinta} strokeWidth={1} strokeOpacity={0.8} />
        <line x1={cx} y1={cy - 12} x2={cx} y2={cy + 12} stroke={tinta} strokeWidth={1} />
        <circle cx={cx} cy={cy} r={3} fill="none" stroke="#d946ef" strokeWidth={1.5} />
        {apuntado !== null && (
          <g pointerEvents="none">
            <line
              x1={cx}
              y1={cy}
              x2={polarSvg(cx, cy, R_RAYO, apuntado).x}
              y2={polarSvg(cx, cy, R_RAYO, apuntado).y}
              stroke="#d946ef"
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />
            <text
              x={polarSvg(cx, cy, R_INTERIOR - 40, apuntado).x}
              y={polarSvg(cx, cy, R_INTERIOR - 40, apuntado).y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={14}
              className="font-mono"
              fill="#a21caf"
              stroke="white"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {completo ? `${apuntado}°` : `${apuntado}° · ${180 - apuntado}°`}
            </text>
          </g>
        )}
        {/* Anillo invisible sobre la escala: tocar un grado traza el rayo desde el centro */}
        <path
          d={
            completo
              ? `M${cx - R_ANILLO} ${cy}A${R_ANILLO} ${R_ANILLO} 0 1 1 ${cx + R_ANILLO} ${cy}A${R_ANILLO} ${R_ANILLO} 0 1 1 ${cx - R_ANILLO} ${cy}`
              : `M${cx - R_ANILLO} ${cy}A${R_ANILLO} ${R_ANILLO} 0 0 1 ${cx + R_ANILLO} ${cy}`
          }
          fill="none"
          stroke="transparent"
          strokeWidth={ANCHO_ANILLO}
          pointerEvents="stroke"
          style={{ cursor: 'crosshair' }}
          onPointerMove={(e) => setApuntado(gradoBajo(e))}
          onPointerLeave={() => setApuntado(null)}
          onPointerDown={(e) => {
            e.stopPropagation()
            trazarRayo(gradoBajo(e))
          }}
          onPointerUp={frenar}
        />
      </svg>

      {seleccionado && (
        <button
          onClick={() => {
            const m = medidasTransportador(!completo)
            actualizar({ completo: !completo, w: m.w * s, h: m.h * s })
          }}
          onPointerDown={frenar}
          onPointerMove={frenar}
          onPointerUp={frenar}
          className="absolute left-1/2 -translate-x-1/2 text-xs whitespace-nowrap bg-zinc-900 border border-purple-500/50 rounded-full px-2 py-0.5 text-white cursor-pointer hover:bg-purple-600"
          style={{ top: cy * s + 10 }}
          title="Semicírculo o círculo completo"
        >
          {completo ? '360° → 180°' : '180° → 360°'}
        </button>
      )}
    </HTMLContainer>
  )
}

export class TransportadorShapeUtil extends BaseBoxShapeUtil<TransportadorShape> {
  static override type = 'transportador' as const

  static override props = transportadorProps

  override getDefaultProps(): Props {
    return { ...transportadorDefaults }
  }

  // Manijas proporcionales: el dibujo se arma a R = 5 cm y el viewBox lo escala a w × h.
  override isAspectRatioLocked() {
    return true
  }

  // Zona clickeable con la forma real: las esquinas de la caja no agarran el transportador.
  override getGeometry(shape: TransportadorShape): Geometry2d {
    const s = escalaDe(shape.props)
    if (shape.props.completo) {
      return new Circle2d({ x: 0, y: 0, radius: R * s, isFilled: true })
    }
    const { cx, cy } = medidasTransportador(false)
    const arco = Array.from({ length: 37 }, (_, k) => {
      const p = polarSvg(cx, cy, R, 180 - k * 5)
      return new Vec(p.x * s, p.y * s)
    })
    return new Polygon2d({
      points: [...arco, new Vec((cx + R) * s, (cy + BASE_TRANSPORTADOR) * s), new Vec((cx - R) * s, (cy + BASE_TRANSPORTADOR) * s)],
      isFilled: true,
    })
  }

  // tldraw gira alrededor del centro de la caja; corregimos x, y para que gire alrededor del centro del transportador.
  override onRotate(initial: TransportadorShape, current: TransportadorShape): TLShapePartial<TransportadorShape> | void {
    if (this.editor.getSelectedShapeIds().length !== 1) return
    const { cx, cy } = medidasTransportador(current.props.completo)
    const c = new Vec(cx, cy).mul(escalaDe(current.props))
    const fijo = Vec.Add(new Vec(initial.x, initial.y), Vec.Rot(c, initial.rotation))
    const origen = Vec.Sub(fijo, Vec.Rot(c, current.rotation))
    return { id: current.id, type: 'transportador', x: origen.x, y: origen.y }
  }

  override component(shape: TransportadorShape) {
    const actualizar = (props: Partial<Props>) => {
      this.editor.updateShape<TransportadorShape>({ id: shape.id, type: 'transportador', props })
    }
    return <Transportador id={shape.id} props={shape.props} actualizar={actualizar} />
  }

  override indicator(shape: TransportadorShape) {
    const { cx, cy } = medidasTransportador(shape.props.completo)
    return <path d={contornoSvg(shape.props.completo, cx, cy)} transform={`scale(${escalaDe(shape.props)})`} />
  }

  override getIndicatorPath(shape: TransportadorShape): Path2D {
    const { cx, cy } = medidasTransportador(shape.props.completo)
    const s = escalaDe(shape.props)
    const path = new Path2D()
    if (shape.props.completo) {
      path.arc(cx * s, cy * s, R * s, 0, 2 * Math.PI)
    } else {
      path.moveTo((cx - R) * s, cy * s)
      path.arc(cx * s, cy * s, R * s, Math.PI, 2 * Math.PI)
      path.lineTo((cx + R) * s, (cy + BASE_TRANSPORTADOR) * s)
      path.lineTo((cx - R) * s, (cy + BASE_TRANSPORTADOR) * s)
    }
    path.closePath()
    return path
  }
}
