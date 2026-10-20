'use client'

import { BaseBoxShapeUtil, HTMLContainer, useEditor, useValue, type TLShape, type TLShapeId } from 'tldraw'
import { reglaProps, reglaDefaults } from '@/shapes/schemas'
import { ALTO_REGLA, LONGITUDES_REGLA, MARGEN_REGLA, PX_POR_MM, anchoRegla } from '@/lib/geometria'

export type ReglaShape = TLShape<'regla'>
type Props = ReglaShape['props']

// Largo de cada marca desde el borde, en unidades de la hoja
const MARCA_CM = 24
const MARCA_MEDIO = 16
const MARCA_MM = 10

const frenar = (e: { stopPropagation: () => void }) => e.stopPropagation()

/** Un solo `d` por tipo de marca: cientos de rayitas en 3 <path> en vez de cientos de <line> */
function marcas(longitud: number, alto: number) {
  let cm = ''
  let medio = ''
  let mm = ''
  for (let i = 0; i <= longitud * 10; i++) {
    const x = MARGEN_REGLA + i * PX_POR_MM
    if (i % 10 === 0) cm += `M${x} 0V${MARCA_CM}M${x} ${alto}V${alto - MARCA_CM}`
    else if (i % 5 === 0) medio += `M${x} 0V${MARCA_MEDIO}M${x} ${alto}V${alto - MARCA_MEDIO}`
    else mm += `M${x} 0V${MARCA_MM}`
  }
  return { cm, medio, mm }
}

function Regla({ id, props, actualizar }: { id: TLShapeId; props: Props; actualizar: (p: Partial<Props>) => void }) {
  const editor = useEditor()
  const oscuro = useValue('oscuro', () => editor.user.getIsDarkMode(), [editor])
  const seleccionada = useValue('seleccionada', () => editor.getOnlySelectedShapeId() === id, [editor, id])

  const { w, h, longitud } = props
  const { cm, medio, mm } = marcas(longitud, h)
  const tinta = oscuro ? '#e9d5ff' : '#4c1d95'
  const cuerpo = oscuro ? 'rgba(168, 85, 247, 0.16)' : 'rgba(168, 85, 247, 0.10)'

  return (
    <HTMLContainer id={id} style={{ pointerEvents: 'all' }} className="w-full h-full select-none">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full overflow-visible">
        <rect x={0} y={0} width={w} height={h} rx={6} fill={cuerpo} stroke={tinta} strokeOpacity={0.6} strokeWidth={1.5} />
        <path d={mm} stroke={tinta} strokeWidth={0.75} />
        <path d={medio} stroke={tinta} strokeWidth={1} />
        <path d={cm} stroke={tinta} strokeWidth={1.4} />
        {Array.from({ length: longitud + 1 }, (_, n) => (
          <text
            key={n}
            x={MARGEN_REGLA + n * 10 * PX_POR_MM}
            y={MARCA_CM + 14}
            textAnchor="middle"
            fontSize={13}
            className="font-mono"
            fill={tinta}
          >
            {n}
          </text>
        ))}
        <text x={MARGEN_REGLA} y={MARCA_CM + 30} textAnchor="middle" fontSize={10} className="font-mono" fill={tinta} opacity={0.7}>
          cm
        </text>
        <text x={w / 2} y={h - MARCA_CM - 10} textAnchor="middle" fontSize={11} fill={tinta} opacity={0.45}>
          Infinitamente Matemático
        </text>
      </svg>

      {seleccionada && (
        <select
          value={longitud}
          onChange={(e) => {
            const l = Number(e.target.value)
            actualizar({ longitud: l, w: anchoRegla(l), h: ALTO_REGLA })
          }}
          onPointerDown={frenar}
          onPointerMove={frenar}
          onPointerUp={frenar}
          onKeyDown={frenar}
          onKeyUp={frenar}
          className="absolute right-3 bottom-2 text-xs bg-zinc-900 border border-purple-500/50 rounded-full px-2 py-0.5 text-white outline-none cursor-pointer"
          title="Largo de la regla"
        >
          {LONGITUDES_REGLA.map((l) => (
            <option key={l} value={l}>
              {l} cm
            </option>
          ))}
        </select>
      )}
    </HTMLContainer>
  )
}

export class ReglaShapeUtil extends BaseBoxShapeUtil<ReglaShape> {
  static override type = 'regla' as const

  static override props = reglaProps

  override getDefaultProps(): Props {
    return { ...reglaDefaults }
  }

  // La escala es real (1 cm = 48): estirarla rompería la medida. Se cambia el largo desde el selector.
  override canResize() {
    return false
  }

  override hideResizeHandles() {
    return true
  }

  override component(shape: ReglaShape) {
    const actualizar = (props: Partial<Props>) => {
      this.editor.updateShape<ReglaShape>({ id: shape.id, type: 'regla', props })
    }
    return <Regla id={shape.id} props={shape.props} actualizar={actualizar} />
  }

  override indicator(shape: ReglaShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={6} ry={6} />
  }

  override getIndicatorPath(shape: ReglaShape): Path2D {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 6)
    return path
  }
}
