'use client'

import {
  BaseBoxShapeUtil,
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
import { BASE_TRANSPORTADOR, RADIO_TRANSPORTADOR as R, medidasTransportador, polarSvg } from '@/lib/geometria'

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

  const { w, h, completo } = props
  const { cx, cy } = medidasTransportador(completo)
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
      </svg>

      {seleccionado && (
        <button
          onClick={() => {
            const m = medidasTransportador(!completo)
            actualizar({ completo: !completo, w: m.w, h: m.h })
          }}
          onPointerDown={frenar}
          onPointerMove={frenar}
          onPointerUp={frenar}
          className="absolute left-1/2 -translate-x-1/2 text-xs whitespace-nowrap bg-zinc-900 border border-purple-500/50 rounded-full px-2 py-0.5 text-white cursor-pointer hover:bg-purple-600"
          style={{ top: cy + 10 }}
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

  override canResize() {
    return false
  }

  override hideResizeHandles() {
    return true
  }

  // Zona clickeable con la forma real: las esquinas de la caja no agarran el transportador.
  override getGeometry(shape: TransportadorShape): Geometry2d {
    if (shape.props.completo) {
      return new Circle2d({ x: 0, y: 0, radius: R, isFilled: true })
    }
    const { cx, cy } = medidasTransportador(false)
    const arco = Array.from({ length: 37 }, (_, k) => {
      const p = polarSvg(cx, cy, R, 180 - k * 5)
      return new Vec(p.x, p.y)
    })
    return new Polygon2d({
      points: [...arco, new Vec(cx + R, cy + BASE_TRANSPORTADOR), new Vec(cx - R, cy + BASE_TRANSPORTADOR)],
      isFilled: true,
    })
  }

  // tldraw gira alrededor del centro de la caja; corregimos x, y para que gire alrededor del centro del transportador.
  override onRotate(initial: TransportadorShape, current: TransportadorShape): TLShapePartial<TransportadorShape> | void {
    if (this.editor.getSelectedShapeIds().length !== 1) return
    const { cx, cy } = medidasTransportador(current.props.completo)
    const c = new Vec(cx, cy)
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
    return <path d={contornoSvg(shape.props.completo, cx, cy)} />
  }

  override getIndicatorPath(shape: TransportadorShape): Path2D {
    const { cx, cy } = medidasTransportador(shape.props.completo)
    const path = new Path2D()
    if (shape.props.completo) {
      path.arc(cx, cy, R, 0, 2 * Math.PI)
    } else {
      path.moveTo(cx - R, cy)
      path.arc(cx, cy, R, Math.PI, 2 * Math.PI)
      path.lineTo(cx + R, cy + BASE_TRANSPORTADOR)
      path.lineTo(cx - R, cy + BASE_TRANSPORTADOR)
    }
    path.closePath()
    return path
  }
}
