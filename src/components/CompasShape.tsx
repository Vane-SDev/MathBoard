'use client'

import { Polygon2d, SVGContainer, ShapeUtil, Vec, useEditor, useValue, type Geometry2d, type TLShape } from 'tldraw'
import { compasProps, compasDefaults } from '@/shapes/schemas'
import { cmDesdePx, piezasCompas } from '@/lib/geometria'
import { formatEs } from '@/lib/linear2d'

export type CompasShape = TLShape<'compas'>
type Props = CompasShape['props']
type Punto = { x: number; y: number }

const sobreCirculo = (r: number, a: number): Punto => ({ x: r * Math.cos(a), y: r * Math.sin(a) })

/** Arco de SVG con centro en la aguja, desde `inicio` girando `barrido` (en la hoja, y hacia abajo) */
export function arcoSvg(r: number, inicio: number, barrido: number) {
  const a = sobreCirculo(r, inicio)
  const b = sobreCirculo(r, inicio + barrido)
  const grande = Math.abs(barrido) > Math.PI ? 1 : 0
  const sentido = barrido > 0 ? 1 : 0
  return `M${a.x} ${a.y}A${r} ${r} 0 ${grande} ${sentido} ${b.x} ${b.y}`
}

/** Punto a `t` del camino de `a` a `b` */
const hacia = (a: Punto, b: Punto, t: number): Punto => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

function Compas({ props }: { props: Props }) {
  const editor = useEditor()
  // Cada persona lo ve con su propio zoom: guías y letra con grosor constante en pantalla
  const z = useValue('zoom', () => editor.getZoomLevel(), [editor])
  const { r, angulo, fase, inicio, barrido } = props
  const { L, lapiz, bisagra, mango } = piezasCompas(r, angulo)

  // Aguja y mina: las puntas de cada pata, del 12 % de su largo
  const finAguja = hacia({ x: 0, y: 0 }, bisagra, 0.12)
  const finMina = hacia(lapiz, bisagra, 0.12)
  const fino = 1.5 / z
  const punteado = `${6 / z} ${4 / z}`
  const grados = Math.round((Math.abs(barrido) * 180) / Math.PI)
  const etiqueta = `r = ${formatEs(cmDesdePx(r), 1)} cm${fase === 'girando' ? ` · ${grados}°` : ''}`
  const pata = Math.max(5, L * 0.04)
  // Etiqueta afuera de la circunferencia y del lado opuesto a la bisagra: û hacia afuera, −n̂ lejos de las patas
  const u = { x: Math.cos(angulo), y: Math.sin(angulo) }
  const n = { x: Math.sin(angulo), y: -Math.cos(angulo) }
  const xEtiqueta = lapiz.x + (14 * u.x - 14 * n.x) / z
  const yEtiqueta = lapiz.y + (14 * u.y - 14 * n.y) / z + 4 / z

  return (
    <SVGContainer className="overflow-visible pointer-events-none" style={{ opacity: fase === 'enMano' ? 0.8 : 1 }}>
      {fase !== 'enMano' && (
        <circle r={r} fill="none" stroke="#a855f7" strokeOpacity={0.4} strokeWidth={fino} strokeDasharray={punteado} />
      )}
      {fase === 'girando' && barrido !== 0 && (
        <path d={arcoSvg(r, inicio, barrido)} fill="none" stroke="#9333ea" strokeWidth={2.5 / z} strokeLinecap="round" />
      )}

      {/* Patas: de la bisagra a cada punta */}
      <g strokeLinecap="round">
        <line x1={finAguja.x} y1={finAguja.y} x2={bisagra.x} y2={bisagra.y} stroke="#52525b" strokeWidth={pata} />
        <line x1={finMina.x} y1={finMina.y} x2={bisagra.x} y2={bisagra.y} stroke="#71717a" strokeWidth={pata} />
        <line x1={0} y1={0} x2={finAguja.x} y2={finAguja.y} stroke="#18181b" strokeWidth={pata * 0.35} />
        <line x1={lapiz.x} y1={lapiz.y} x2={finMina.x} y2={finMina.y} stroke="#7c3aed" strokeWidth={pata * 0.7} />
        <line x1={bisagra.x} y1={bisagra.y} x2={mango.x} y2={mango.y} stroke="#a21caf" strokeWidth={pata * 1.3} />
      </g>
      <circle cx={bisagra.x} cy={bisagra.y} r={pata * 1.1} fill="#d946ef" stroke="white" strokeWidth={pata * 0.3} />

      <text
        x={xEtiqueta}
        y={yEtiqueta}
        textAnchor={u.x - n.x >= 0 ? 'start' : 'end'}
        fontSize={13 / z}
        className="font-mono"
        fill="#7e22ce"
        stroke="white"
        strokeWidth={3 / z}
        paintOrder="stroke"
      >
        {etiqueta}
      </text>
    </SVGContainer>
  )
}

/**
 * El compás que ve toda la sala. Lo maneja CompasTool (uno por persona, bloqueado);
 * acá solo se dibuja con aguja en (0, 0) del shape.
 */
export class CompasShapeUtil extends ShapeUtil<CompasShape> {
  static override type = 'compas' as const

  static override props = compasProps

  override getDefaultProps(): Props {
    return { ...compasDefaults }
  }

  override canResize() {
    return false
  }

  override hideRotateHandle() {
    return true
  }

  // Zona del instrumento: el triángulo aguja–mango–lápiz
  override getGeometry(shape: CompasShape): Geometry2d {
    const { lapiz, mango } = piezasCompas(shape.props.r, shape.props.angulo)
    return new Polygon2d({ points: [new Vec(0, 0), Vec.From(mango), Vec.From(lapiz)], isFilled: true })
  }

  override component(shape: CompasShape) {
    return <Compas props={shape.props} />
  }

  override indicator(shape: CompasShape) {
    const { lapiz, mango } = piezasCompas(shape.props.r, shape.props.angulo)
    return <path d={`M0 0L${mango.x} ${mango.y}L${lapiz.x} ${lapiz.y}Z`} />
  }

  override getIndicatorPath(shape: CompasShape): Path2D {
    const { lapiz, mango } = piezasCompas(shape.props.r, shape.props.angulo)
    const path = new Path2D()
    path.moveTo(0, 0)
    path.lineTo(mango.x, mango.y)
    path.lineTo(lapiz.x, lapiz.y)
    path.closePath()
    return path
  }
}
