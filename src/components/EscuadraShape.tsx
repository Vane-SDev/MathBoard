'use client'

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  Polygon2d,
  Vec,
  useEditor,
  useValue,
  type Geometry2d,
  type TLShape,
  type TLShapeId,
} from 'tldraw'
import { escuadraProps, escuadraDefaults } from '@/shapes/schemas'
import { PX_POR_MM, medidasEscuadra, type AngulosEscuadra } from '@/lib/geometria'

export type EscuadraShape = TLShape<'escuadra'>
type Props = EscuadraShape['props']

// Largo de cada marca desde el canto, en unidades de la hoja
const MARCA_CM = 16
const MARCA_MEDIO = 11
const MARCA_MM = 7
/** Las marcas siguen mientras el triángulo tenga al menos este ancho perpendicular al canto (lugar para el número) */
const LUGAR_MINIMO = 40
/** Ancho del plástico alrededor del hueco del medio */
const BORDE_HUECO = 64

const frenar = (e: { stopPropagation: () => void }) => e.stopPropagation()

/**
 * Marcas de los dos catetos, medidas desde el ángulo recto A = (0, h).
 * Sobre la base, a distancia d del vértice queda un alto libre h·(1 − d/w); sobre el cateto vertical, un ancho w·(1 − d/h).
 */
function marcas(w: number, h: number) {
  const d = { cm: '', medio: '', mm: '', numeros: [] as { x: number; y: number; n: number; vertical: boolean }[] }
  const largoDe = (i: number) => (i % 10 === 0 ? MARCA_CM : i % 5 === 0 ? MARCA_MEDIO : MARCA_MM)
  const sumar = (i: number, tramo: string) => {
    if (i % 10 === 0) d.cm += tramo
    else if (i % 5 === 0) d.medio += tramo
    else d.mm += tramo
  }
  // Base: de A hacia la derecha, marcas hacia arriba
  for (let i = 1; i * PX_POR_MM < w; i++) {
    const x = i * PX_POR_MM
    if (h * (1 - x / w) < LUGAR_MINIMO) break
    sumar(i, `M${x} ${h}V${h - largoDe(i)}`)
    if (i % 10 === 0) d.numeros.push({ x, y: h - MARCA_CM - 9, n: i / 10, vertical: false })
  }
  // Cateto vertical: de A hacia arriba, marcas hacia la derecha
  for (let i = 1; i * PX_POR_MM < h; i++) {
    const y = h - i * PX_POR_MM
    if (w * (1 - (h - y) / h) < LUGAR_MINIMO) break
    sumar(i, `M0 ${y}H${largoDe(i)}`)
    if (i % 10 === 0) d.numeros.push({ x: MARCA_CM + 10, y, n: i / 10, vertical: true })
  }
  return d
}

/** Hueco del medio: el mismo triángulo achicado desde el incentro I = (ρ, h − ρ), con ρ = (w + h − hipotenusa)/2 */
function hueco(w: number, h: number): string {
  const rho = (w + h - Math.hypot(w, h)) / 2
  const k = (rho - BORDE_HUECO) / rho
  if (k <= 0) return ''
  const ix = rho
  const iy = h - rho
  const p = (x: number, y: number) => `${ix + k * (x - ix)} ${iy + k * (y - iy)}`
  return `M${p(0, 0)}L${p(w, h)}L${p(0, h)}Z`
}

function Escuadra({ id, props, cambiarAngulos }: { id: TLShapeId; props: Props; cambiarAngulos: (a: AngulosEscuadra) => void }) {
  const editor = useEditor()
  const oscuro = useValue('oscuro', () => editor.user.getIsDarkMode(), [editor])
  const seleccionada = useValue('seleccionada', () => editor.getOnlySelectedShapeId() === id, [editor, id])

  const { w, h, angulos } = props
  const d = marcas(w, h)
  const tinta = oscuro ? '#e9d5ff' : '#4c1d95'
  const cuerpo = oscuro ? 'rgba(168, 85, 247, 0.16)' : 'rgba(168, 85, 247, 0.10)'

  return (
    <HTMLContainer id={id} style={{ pointerEvents: 'all' }} className="w-full h-full select-none">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full overflow-visible">
        {/* evenodd: el hueco del medio queda transparente, como en la escuadra de plástico */}
        <path d={`M0 0L${w} ${h}L0 ${h}Z${hueco(w, h)}`} fillRule="evenodd" fill={cuerpo} stroke={tinta} strokeOpacity={0.6} strokeWidth={1.5} strokeLinejoin="round" />
        <path d={d.mm} stroke={tinta} strokeWidth={0.75} />
        <path d={d.medio} stroke={tinta} strokeWidth={1} />
        <path d={d.cm} stroke={tinta} strokeWidth={1.4} />
        {d.numeros.map(({ x, y, n, vertical }) => (
          <text
            key={`${vertical ? 'v' : 'b'}${n}`}
            x={x}
            y={y}
            textAnchor={vertical ? 'start' : 'middle'}
            dominantBaseline="middle"
            fontSize={11}
            className="font-mono"
            fill={tinta}
          >
            {n}
          </text>
        ))}
        {/* Marca del ángulo recto */}
        <path d={`M0 ${h - 22}H22V${h}`} fill="none" stroke="#d946ef" strokeWidth={1.5} />
      </svg>

      {seleccionada && (
        <button
          onClick={() => cambiarAngulos(angulos === '45' ? '30-60' : '45')}
          onPointerDown={frenar}
          onPointerMove={frenar}
          onPointerUp={frenar}
          className="absolute text-xs whitespace-nowrap bg-zinc-900 border border-purple-500/50 rounded-full px-2 py-0.5 text-white cursor-pointer hover:bg-purple-600"
          style={{ left: 72, bottom: 72 }}
          title="Escuadra de 45° o de 30° y 60°"
        >
          {angulos === '45' ? '45° → 30°-60°' : '30°-60° → 45°'}
        </button>
      )}
    </HTMLContainer>
  )
}

export class EscuadraShapeUtil extends BaseBoxShapeUtil<EscuadraShape> {
  static override type = 'escuadra' as const

  static override props = escuadraProps

  override getDefaultProps(): Props {
    return { ...escuadraDefaults }
  }

  // Escala real (los catetos miden en cm): no se estira
  override canResize() {
    return false
  }

  override hideResizeHandles() {
    return true
  }

  // Zona clickeable: el triángulo, no la caja
  override getGeometry(shape: EscuadraShape): Geometry2d {
    const { w, h } = shape.props
    return new Polygon2d({ points: [new Vec(0, 0), new Vec(w, h), new Vec(0, h)], isFilled: true })
  }

  override component(shape: EscuadraShape) {
    // Al cambiar de modelo, el vértice del ángulo recto A = (0, h) queda en el mismo lugar de la hoja
    const cambiarAngulos = (angulos: AngulosEscuadra) => {
      const nuevo = medidasEscuadra(angulos)
      const fijo = Vec.Add(new Vec(shape.x, shape.y), Vec.Rot(new Vec(0, shape.props.h), shape.rotation))
      const origen = Vec.Sub(fijo, Vec.Rot(new Vec(0, nuevo.h), shape.rotation))
      this.editor.updateShape<EscuadraShape>({ id: shape.id, type: 'escuadra', x: origen.x, y: origen.y, props: { angulos, ...nuevo } })
    }
    return <Escuadra id={shape.id} props={shape.props} cambiarAngulos={cambiarAngulos} />
  }

  override indicator(shape: EscuadraShape) {
    const { w, h } = shape.props
    return <path d={`M0 0L${w} ${h}L0 ${h}Z`} />
  }

  override getIndicatorPath(shape: EscuadraShape): Path2D {
    const { w, h } = shape.props
    const path = new Path2D()
    path.moveTo(0, 0)
    path.lineTo(w, h)
    path.lineTo(0, h)
    path.closePath()
    return path
  }
}
