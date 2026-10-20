'use client'

import {
  DefaultColorStyle,
  StateNode,
  atom,
  createShapeId,
  useEditor,
  useValue,
  type TLGeoShape,
  type TLStateNodeConstructor,
} from 'tldraw'
import { formatEs } from '@/lib/linear2d'
import { PX_POR_MM, cmDesdePx, redondearAMm } from '@/lib/geometria'

/** Lo que se está trazando ahora, en coordenadas de la hoja. Es local: los demás solo ven el círculo terminado. */
type Trazo = { centro: { x: number; y: number }; lapiz: { x: number; y: number } | null; r: number }

const trazo = atom<Trazo | null>('compas-trazo', null)

/** Radio mínimo para crear un círculo: 2 mm */
const R_MINIMO = 2 * PX_POR_MM

class Idle extends StateNode {
  static override id = 'idle'

  override onEnter() {
    this.editor.setCursor({ type: 'cross', rotation: 0 })
  }

  // 1) Clavar la aguja
  override onPointerDown() {
    const p = this.editor.inputs.getOriginPagePoint()
    trazo.set({ centro: { x: p.x, y: p.y }, lapiz: null, r: 0 })
    this.parent.transition('apuntando')
  }

  override onCancel() {
    this.editor.setCurrentTool('select')
  }
}

class Apuntando extends StateNode {
  static override id = 'apuntando'

  // Solo empieza a abrir el compás cuando el puntero se movió más que el umbral de arrastre de tldraw
  override onPointerMove() {
    if (this.editor.inputs.getIsDragging()) this.parent.transition('trazando')
  }

  override onPointerUp() {
    this.volver()
  }

  override onCancel() {
    this.volver()
  }

  override onInterrupt() {
    this.volver()
  }

  private volver() {
    trazo.set(null)
    this.parent.transition('idle')
  }
}

class Trazando extends StateNode {
  static override id = 'trazando'

  override onEnter() {
    this.actualizar()
  }

  // 2) Abrir el compás: r = |lápiz − centro|, redondeado al milímetro
  override onPointerMove() {
    this.actualizar()
  }

  // 3) Concretar: un geo 'ellipse' nativo con w = h = 2r, así sincroniza sin tocar el Worker
  override onPointerUp() {
    const t = trazo.get()
    if (t && t.r >= R_MINIMO) {
      this.editor.markHistoryStoppingPoint('compas')
      this.editor.createShape<TLGeoShape>({
        id: createShapeId(),
        type: 'geo',
        x: t.centro.x - t.r,
        y: t.centro.y - t.r,
        props: {
          geo: 'ellipse',
          w: 2 * t.r,
          h: 2 * t.r,
          fill: 'none',
          dash: 'solid',
          size: 's',
          color: this.editor.getStyleForNextShape(DefaultColorStyle),
        },
      })
    }
    this.volver()
  }

  override onCancel() {
    this.volver()
  }

  override onInterrupt() {
    this.volver()
  }

  private actualizar() {
    const t = trazo.get()
    if (!t) return
    const lapiz = this.editor.inputs.getCurrentPagePoint()
    const r = redondearAMm(Math.hypot(lapiz.x - t.centro.x, lapiz.y - t.centro.y))
    trazo.set({ ...t, lapiz: { x: lapiz.x, y: lapiz.y }, r })
  }

  private volver() {
    trazo.set(null)
    this.parent.transition('idle')
  }
}

export class CompasTool extends StateNode {
  static override id = 'compas'
  static override initial = 'idle'
  static override children = (): TLStateNodeConstructor[] => [Idle, Apuntando, Trazando]

  override onExit() {
    trazo.set(null)
  }
}

/** Guía punteada mientras se abre el compás. Va en components.OnTheCanvas: ya está en coordenadas de la hoja. */
export function GuiaCompas() {
  const editor = useEditor()
  const t = useValue('compas-trazo', () => trazo.get(), [])
  const z = useValue('zoom', () => editor.getZoomLevel(), [editor])
  if (!t) return null

  // Grosores y letra divididos por el zoom: se ven iguales en pantalla con cualquier acercamiento
  const trazoFino = 1.5 / z
  const punteado = `${6 / z} ${4 / z}`
  const { centro, lapiz, r } = t

  return (
    <svg className="absolute top-0 left-0 overflow-visible pointer-events-none" width={1} height={1} aria-hidden="true">
      {lapiz && (
        <>
          <circle cx={centro.x} cy={centro.y} r={r} fill="none" stroke="#a855f7" strokeOpacity={0.45} strokeWidth={trazoFino} strokeDasharray={punteado} />
          <line x1={centro.x} y1={centro.y} x2={lapiz.x} y2={lapiz.y} stroke="#d946ef" strokeWidth={trazoFino} strokeDasharray={punteado} />
          <circle cx={lapiz.x} cy={lapiz.y} r={3 / z} fill="#d946ef" />
          <text
            x={lapiz.x + 10 / z}
            y={lapiz.y - 10 / z}
            fontSize={13 / z}
            className="font-mono"
            fill="#7e22ce"
            stroke="white"
            strokeWidth={3 / z}
            paintOrder="stroke"
          >
            r = {formatEs(cmDesdePx(r), 1)} cm
          </text>
        </>
      )}
      <circle cx={centro.x} cy={centro.y} r={4 / z} fill="none" stroke="#d946ef" strokeWidth={trazoFino} />
      <line x1={centro.x - 7 / z} y1={centro.y} x2={centro.x + 7 / z} y2={centro.y} stroke="#d946ef" strokeWidth={trazoFino} />
      <line x1={centro.x} y1={centro.y - 7 / z} x2={centro.x} y2={centro.y + 7 / z} stroke="#d946ef" strokeWidth={trazoFino} />
    </svg>
  )
}
