'use client'

import {
  DefaultColorStyle,
  StateNode,
  Vec,
  atom,
  createShapeId,
  useEditor,
  useValue,
  type Editor,
  type TLArrowShape,
  type TLGeoShape,
  type TLStateNodeConstructor,
} from 'tldraw'
import { formatEs } from '@/lib/linear2d'
import { PX_POR_MM, cmDesdePx, redondearAMm } from '@/lib/geometria'

type Punto = { x: number; y: number }

/**
 * Lo que se está trazando ahora, en coordenadas de la hoja. Es local: los demás solo ven el trazo terminado.
 * Ángulos en radianes medidos en la hoja (y hacia abajo): `barrido` > 0 gira en sentido horario en pantalla.
 */
type Trazo = {
  fase: 'abriendo' | 'abierto' | 'girando'
  centro: Punto
  r: number
  /** Dirección actual del lápiz */
  angulo: number
  /** Dónde empezó el arco y cuánto giró (acumulado: puede pasar de una vuelta) */
  inicio: number
  barrido: number
}

const trazo = atom<Trazo | null>('compas-trazo', null)

/** Radio mínimo para abrir el compás: 2 mm */
const R_MINIMO = 2 * PX_POR_MM
/** Arcos más chicos que esto no se trazan; desde casi una vuelta se traza el círculo entero */
const BARRIDO_MINIMO = Math.PI / 180
const CASI_VUELTA = (350 * Math.PI) / 180
/** Radio (en pantalla) alrededor de la aguja para agarrarla y trasladar el compás abierto */
const AGARRE_AGUJA = 12

const anguloDesde = (c: Punto, p: Punto) => Math.atan2(p.y - c.y, p.x - c.x)
const sobreCirculo = (c: Punto, r: number, a: number): Punto => ({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) })

/** Diferencia de ángulos llevada a (−π, π]: así el barrido acumula bien al cruzar ±180° */
function diferencia(a: number, b: number) {
  let d = a - b
  while (d > Math.PI) d -= 2 * Math.PI
  while (d <= -Math.PI) d += 2 * Math.PI
  return d
}

function crearCirculo(editor: Editor, t: Trazo) {
  editor.markHistoryStoppingPoint('compas')
  editor.createShape<TLGeoShape>({
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
      color: editor.getStyleForNextShape(DefaultColorStyle),
    },
  })
}

/** Tramo de arco nativo: una flecha curva sin puntas, de `inicio` girando `barrido` (|barrido| ≤ 120°) */
function tramoDeArco(editor: Editor, c: Punto, r: number, inicio: number, barrido: number) {
  // tldraw dibuja el arco que pasa por S, E y el punto medio = M + per(û)·(−bend), con M el medio de la cuerda.
  // Despejando con P = el punto medio del arco: bend = −(P − M)·per(û).
  const s = Vec.From(sobreCirculo(c, r, inicio))
  const e = Vec.From(sobreCirculo(c, r, inicio + barrido))
  const p = Vec.From(sobreCirculo(c, r, inicio + barrido / 2))
  const m = Vec.Med(s, e)
  const per = Vec.Sub(e, s).uni().per()
  const id = createShapeId()
  editor.createShape<TLArrowShape>({
    id,
    type: 'arrow',
    x: s.x,
    y: s.y,
    props: {
      kind: 'arc',
      start: { x: 0, y: 0 },
      end: { x: e.x - s.x, y: e.y - s.y },
      bend: -Vec.Dpr(Vec.Sub(p, m), per),
      arrowheadStart: 'none',
      arrowheadEnd: 'none',
      dash: 'solid',
      size: 's',
      color: editor.getStyleForNextShape(DefaultColorStyle),
    },
  })
  return id
}

/** Tramo más largo que dibujamos con una sola flecha: cerca de 180° tldraw puede elegir el lado equivocado del arco */
const TRAMO_MAXIMO = (2 * Math.PI) / 3

/** El arco del compás: se parte en tramos de hasta 120° y, si son varios, se agrupan para que se muevan juntos */
function crearArco(editor: Editor, t: Trazo) {
  const n = Math.ceil(Math.abs(t.barrido) / TRAMO_MAXIMO)
  const paso = t.barrido / n
  editor.markHistoryStoppingPoint('compas')
  const ids = Array.from({ length: n }, (_, k) => tramoDeArco(editor, t.centro, t.r, t.inicio + k * paso, paso))
  if (ids.length > 1) {
    editor.groupShapes(ids)
    editor.selectNone()
  }
}

class Idle extends StateNode {
  static override id = 'idle'

  override onEnter() {
    this.editor.setCursor({ type: 'cross', rotation: 0 })
  }

  // 1) Clavar la aguja
  override onPointerDown() {
    const p = this.editor.inputs.getOriginPagePoint()
    trazo.set({ fase: 'abriendo', centro: { x: p.x, y: p.y }, r: 0, angulo: 0, inicio: 0, barrido: 0 })
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
    if (this.editor.inputs.getIsDragging()) this.parent.transition('abriendo')
  }

  override onPointerUp() {
    this.cerrar()
  }

  override onCancel() {
    this.cerrar()
  }

  override onInterrupt() {
    this.cerrar()
  }

  private cerrar() {
    trazo.set(null)
    this.parent.transition('idle')
  }
}

class Abriendo extends StateNode {
  static override id = 'abriendo'

  override onEnter() {
    this.actualizar()
  }

  // 2) Abrir el compás: r = |lápiz − centro|, redondeado al milímetro
  override onPointerMove() {
    this.actualizar()
  }

  // Al soltar, el compás queda abierto con ese radio y la aguja clavada
  override onPointerUp() {
    const t = trazo.get()
    if (t && t.r >= R_MINIMO) {
      trazo.set({ ...t, fase: 'abierto' })
      this.parent.transition('abierto')
    } else {
      this.cerrar()
    }
  }

  override onCancel() {
    this.cerrar()
  }

  override onInterrupt() {
    this.cerrar()
  }

  private actualizar() {
    const t = trazo.get()
    if (!t) return
    const lapiz = this.editor.inputs.getCurrentPagePoint()
    const r = redondearAMm(Math.hypot(lapiz.x - t.centro.x, lapiz.y - t.centro.y))
    trazo.set({ ...t, r, angulo: anguloDesde(t.centro, lapiz) })
  }

  private cerrar() {
    trazo.set(null)
    this.parent.transition('idle')
  }
}

class Abierto extends StateNode {
  static override id = 'abierto'

  // El lápiz sigue al puntero sobre la circunferencia
  override onPointerMove() {
    const t = trazo.get()
    if (t) trazo.set({ ...t, fase: 'abierto', angulo: anguloDesde(t.centro, this.editor.inputs.getCurrentPagePoint()) })
  }

  // 3) Tocar: si es sobre la aguja, se traslada el compás; si no, se apoya el lápiz
  override onPointerDown() {
    const t = trazo.get()
    if (!t) return
    const p = this.editor.inputs.getOriginPagePoint()
    const cercaDeLaAguja = Math.hypot(p.x - t.centro.x, p.y - t.centro.y) * this.editor.getZoomLevel() <= AGARRE_AGUJA
    this.parent.transition(cercaDeLaAguja ? 'trasladando' : 'apoyando')
  }

  // Esc cierra el compás; otro Esc vuelve a Seleccionar
  override onCancel() {
    trazo.set(null)
    this.parent.transition('idle')
  }
}

class Apoyando extends StateNode {
  static override id = 'apoyando'

  override onPointerMove() {
    if (!this.editor.inputs.getIsDragging()) return
    const t = trazo.get()
    if (!t) return
    // El arco arranca donde estaba el lápiz al apoyarlo
    const a = anguloDesde(t.centro, this.editor.inputs.getOriginPagePoint())
    trazo.set({ ...t, fase: 'girando', angulo: a, inicio: a, barrido: 0 })
    this.parent.transition('girando')
  }

  // Un toque sin arrastrar: círculo entero
  override onPointerUp() {
    const t = trazo.get()
    if (t) crearCirculo(this.editor, t)
    this.parent.transition('abierto')
  }

  override onCancel() {
    this.parent.transition('abierto')
  }
}

class Girando extends StateNode {
  static override id = 'girando'

  // 4) Girar el compás: se acumula cuánto giró el lápiz alrededor de la aguja
  override onPointerMove() {
    const t = trazo.get()
    if (!t) return
    const a = anguloDesde(t.centro, this.editor.inputs.getCurrentPagePoint())
    trazo.set({ ...t, angulo: a, barrido: t.barrido + diferencia(a, t.angulo) })
  }

  override onPointerUp() {
    const t = trazo.get()
    if (t) {
      const giro = Math.abs(t.barrido)
      if (giro >= CASI_VUELTA) crearCirculo(this.editor, t)
      else if (giro >= BARRIDO_MINIMO) crearArco(this.editor, t)
      trazo.set({ ...t, fase: 'abierto', barrido: 0 })
    }
    this.parent.transition('abierto')
  }

  override onCancel() {
    const t = trazo.get()
    if (t) trazo.set({ ...t, fase: 'abierto', barrido: 0 })
    this.parent.transition('abierto')
  }

  override onInterrupt() {
    this.onCancel()
  }
}

/** Levantar el compás sin cerrarlo y clavar la aguja en otro lado: mismo radio (mediatriz, copiar segmentos) */
class Trasladando extends StateNode {
  static override id = 'trasladando'

  override onPointerMove() {
    const t = trazo.get()
    if (!t) return
    const p = this.editor.inputs.getCurrentPagePoint()
    trazo.set({ ...t, centro: { x: p.x, y: p.y } })
  }

  override onPointerUp() {
    this.parent.transition('abierto')
  }

  override onCancel() {
    this.parent.transition('abierto')
  }
}

export class CompasTool extends StateNode {
  static override id = 'compas'
  static override initial = 'idle'
  static override children = (): TLStateNodeConstructor[] => [Idle, Apuntando, Abriendo, Abierto, Apoyando, Girando, Trasladando]

  override onExit() {
    trazo.set(null)
  }
}

/** Arco de SVG desde `inicio` girando `barrido` (en la hoja, y hacia abajo) */
function arcoSvg(c: Punto, r: number, inicio: number, barrido: number) {
  const a = sobreCirculo(c, r, inicio)
  const b = sobreCirculo(c, r, inicio + barrido)
  const grande = Math.abs(barrido) > Math.PI ? 1 : 0
  const sentido = barrido > 0 ? 1 : 0
  return `M${a.x} ${a.y}A${r} ${r} 0 ${grande} ${sentido} ${b.x} ${b.y}`
}

/** Guía del compás. Va en components.OnTheCanvas: ya está en coordenadas de la hoja. */
export function GuiaCompas() {
  const editor = useEditor()
  const t = useValue('compas-trazo', () => trazo.get(), [])
  const z = useValue('zoom', () => editor.getZoomLevel(), [editor])
  if (!t) return null

  // Grosores y letra divididos por el zoom: se ven iguales en pantalla con cualquier acercamiento
  const fino = 1.5 / z
  const punteado = `${6 / z} ${4 / z}`
  const { centro, r, fase } = t
  const lapiz = sobreCirculo(centro, r, t.angulo)
  const grados = Math.round((Math.abs(t.barrido) * 180) / Math.PI)
  const etiqueta = `r = ${formatEs(cmDesdePx(r), 1)} cm${fase === 'girando' ? ` · ${grados}°` : ''}`
  const ayuda =
    fase === 'abierto' ? 'arrastrá: arco · tocá: círculo · aguja: mover · Esc: cerrar' : fase === 'abriendo' ? 'soltá para fijar el radio' : ''

  return (
    <svg className="absolute top-0 left-0 overflow-visible pointer-events-none" width={1} height={1} aria-hidden="true">
      {r > 0 && (
        <>
          <circle cx={centro.x} cy={centro.y} r={r} fill="none" stroke="#a855f7" strokeOpacity={0.4} strokeWidth={fino} strokeDasharray={punteado} />
          <line x1={centro.x} y1={centro.y} x2={lapiz.x} y2={lapiz.y} stroke="#d946ef" strokeWidth={fino} strokeDasharray={punteado} />
          {fase === 'girando' && t.barrido !== 0 && (
            <path d={arcoSvg(centro, r, t.inicio, t.barrido)} fill="none" stroke="#9333ea" strokeWidth={2.5 / z} />
          )}
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
            {etiqueta}
          </text>
        </>
      )}
      <circle cx={centro.x} cy={centro.y} r={4 / z} fill="none" stroke="#d946ef" strokeWidth={fino} />
      <line x1={centro.x - 7 / z} y1={centro.y} x2={centro.x + 7 / z} y2={centro.y} stroke="#d946ef" strokeWidth={fino} />
      <line x1={centro.x} y1={centro.y - 7 / z} x2={centro.x} y2={centro.y + 7 / z} stroke="#d946ef" strokeWidth={fino} />
      {ayuda && (
        <text
          x={centro.x}
          y={centro.y + 22 / z}
          textAnchor="middle"
          fontSize={11 / z}
          fill="#6b21a8"
          stroke="white"
          strokeWidth={3 / z}
          paintOrder="stroke"
        >
          {ayuda}
        </text>
      )}
    </svg>
  )
}
