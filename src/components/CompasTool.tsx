'use client'

import {
  DefaultColorStyle,
  StateNode,
  Vec,
  createShapeId,
  useEditor,
  useValue,
  type Editor,
  type TLArrowShape,
  type TLGeoShape,
  type TLShapeId,
  type TLStateNodeConstructor,
} from 'tldraw'
import { PX_POR_MM, redondearAMm } from '@/lib/geometria'
import type { CompasShape } from '@/components/CompasShape'

type Punto = { x: number; y: number }
type PropsCompas = CompasShape['props']

/**
 * El compás es un shape de la sala (CompasShape): todas ven la aguja, las patas y el arco en curso.
 * La herramienta solo lo mueve. Ángulos en radianes medidos en la hoja (y hacia abajo): `barrido` > 0 gira en
 * sentido horario en pantalla. x, y del shape = la aguja.
 */
type Trazo = { centro: Punto; r: number; inicio: number; barrido: number }

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

// ── El shape del compás: uno por persona ──

/** Id fijo por persona: si dos usan el compás a la vez, cada una mueve el suyo */
export const idCompas = (editor: Editor): TLShapeId => createShapeId(`compas-${editor.user.getId()}`)

export function leerCompas(editor: Editor): CompasShape | undefined {
  return editor.getShape<CompasShape>(idCompas(editor))
}

/** Movimientos del compás: sin historial (Ctrl+Z solo saca arcos) y aunque esté bloqueado */
function moverCompas(editor: Editor, cambio: { x?: number; y?: number; props?: Partial<PropsCompas> }) {
  editor.run(
    () => {
      const id = idCompas(editor)
      const actual = editor.getShape<CompasShape>(id)
      if (actual) {
        editor.updateShape<CompasShape>({ id, type: 'compas', ...cambio })
      } else {
        editor.createShape<CompasShape>({ id, type: 'compas', isLocked: true, ...cambio })
      }
    },
    { history: 'ignore', ignoreShapeLock: true },
  )
}

/** Guardar el compás: desaparece de la sala */
export function guardarCompas(editor: Editor) {
  const id = idCompas(editor)
  if (!editor.getShape(id)) return
  editor.run(() => editor.deleteShape(id), { history: 'ignore', ignoreShapeLock: true })
}

/** Después de crear un arco el compás vuelve a quedar encima de todo */
function compasAlFrente(editor: Editor) {
  editor.run(() => editor.bringToFront([idCompas(editor)]), { history: 'ignore', ignoreShapeLock: true })
}

const trazoDe = (c: CompasShape): Trazo => ({ centro: { x: c.x, y: c.y }, r: c.props.r, inicio: c.props.inicio, barrido: c.props.barrido })

// ── Lo que deja el compás en la hoja (shapes nativos) ──

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
  compasAlFrente(editor)
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
  compasAlFrente(editor)
}

// ── Estados de la herramienta ──

/** 1) El compás en la mano: la aguja sigue al puntero, con la última abertura */
class Idle extends StateNode {
  static override id = 'idle'

  override onEnter() {
    this.editor.setCursor({ type: 'cross', rotation: 0 })
    const p = this.editor.inputs.getCurrentPagePoint()
    moverCompas(this.editor, { x: p.x, y: p.y, props: { fase: 'enMano', barrido: 0 } })
  }

  override onPointerMove() {
    const p = this.editor.inputs.getCurrentPagePoint()
    moverCompas(this.editor, { x: p.x, y: p.y })
  }

  // Clavar la aguja
  override onPointerDown() {
    const p = this.editor.inputs.getOriginPagePoint()
    moverCompas(this.editor, { x: p.x, y: p.y })
    this.parent.transition('apuntando')
  }

  // Esc con el compás en la mano: se guarda y vuelve Seleccionar
  override onCancel() {
    this.editor.setCurrentTool('select')
  }
}

class Apuntando extends StateNode {
  static override id = 'apuntando'

  // Arrastrar abre el compás desde cero; recién cuando el puntero se movió más que el umbral de arrastre de tldraw
  override onPointerMove() {
    if (this.editor.inputs.getIsDragging()) this.parent.transition('abriendo')
  }

  // Un toque: queda clavado con la misma abertura (mediatriz: mismo radio desde el otro extremo)
  override onPointerUp() {
    const c = leerCompas(this.editor)
    if (c && c.props.r >= R_MINIMO) {
      moverCompas(this.editor, { props: { fase: 'abierto' } })
      this.parent.transition('abierto')
    } else {
      this.parent.transition('idle')
    }
  }

  override onCancel() {
    this.parent.transition('idle')
  }

  override onInterrupt() {
    this.parent.transition('idle')
  }
}

class Abriendo extends StateNode {
  static override id = 'abriendo'

  override onEnter() {
    this.actualizar()
  }

  // 2) Abrir el compás: r = |lápiz − aguja|, redondeado al milímetro
  override onPointerMove() {
    this.actualizar()
  }

  // Al soltar, el compás queda abierto con ese radio y la aguja clavada
  override onPointerUp() {
    const c = leerCompas(this.editor)
    if (c && c.props.r >= R_MINIMO) {
      moverCompas(this.editor, { props: { fase: 'abierto' } })
      this.parent.transition('abierto')
    } else {
      this.parent.transition('idle')
    }
  }

  override onCancel() {
    this.parent.transition('idle')
  }

  override onInterrupt() {
    this.parent.transition('idle')
  }

  private actualizar() {
    const c = leerCompas(this.editor)
    if (!c) return
    const lapiz = this.editor.inputs.getCurrentPagePoint()
    const r = redondearAMm(Math.hypot(lapiz.x - c.x, lapiz.y - c.y))
    moverCompas(this.editor, { props: { fase: 'abriendo', r, angulo: anguloDesde(c, lapiz) } })
  }
}

class Abierto extends StateNode {
  static override id = 'abierto'

  // El lápiz sigue al puntero sobre la circunferencia: el compás gira sobre la aguja
  override onPointerMove() {
    const c = leerCompas(this.editor)
    if (c) moverCompas(this.editor, { props: { angulo: anguloDesde(c, this.editor.inputs.getCurrentPagePoint()) } })
  }

  // 3) Tocar: si es sobre la aguja, se traslada el compás; si no, se apoya el lápiz
  override onPointerDown() {
    const c = leerCompas(this.editor)
    if (!c) return
    const p = this.editor.inputs.getOriginPagePoint()
    const cercaDeLaAguja = Math.hypot(p.x - c.x, p.y - c.y) * this.editor.getZoomLevel() <= AGARRE_AGUJA
    this.parent.transition(cercaDeLaAguja ? 'trasladando' : 'apoyando')
  }

  // Esc levanta el compás con la misma abertura; otro Esc lo guarda
  override onCancel() {
    this.parent.transition('idle')
  }
}

class Apoyando extends StateNode {
  static override id = 'apoyando'

  override onPointerMove() {
    if (!this.editor.inputs.getIsDragging()) return
    const c = leerCompas(this.editor)
    if (!c) return
    // El arco arranca donde estaba el lápiz al apoyarlo
    const a = anguloDesde(c, this.editor.inputs.getOriginPagePoint())
    moverCompas(this.editor, { props: { fase: 'girando', angulo: a, inicio: a, barrido: 0 } })
    this.parent.transition('girando')
  }

  // Un toque sin arrastrar: círculo entero
  override onPointerUp() {
    const c = leerCompas(this.editor)
    if (c) crearCirculo(this.editor, trazoDe(c))
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
    const c = leerCompas(this.editor)
    if (!c) return
    const a = anguloDesde(c, this.editor.inputs.getCurrentPagePoint())
    moverCompas(this.editor, { props: { angulo: a, barrido: c.props.barrido + diferencia(a, c.props.angulo) } })
  }

  override onPointerUp() {
    const c = leerCompas(this.editor)
    if (c) {
      const giro = Math.abs(c.props.barrido)
      if (giro >= CASI_VUELTA) crearCirculo(this.editor, trazoDe(c))
      else if (giro >= BARRIDO_MINIMO) crearArco(this.editor, trazoDe(c))
    }
    this.terminar()
  }

  override onCancel() {
    this.terminar()
  }

  override onInterrupt() {
    this.terminar()
  }

  private terminar() {
    moverCompas(this.editor, { props: { fase: 'abierto', barrido: 0 } })
    this.parent.transition('abierto')
  }
}

/** Levantar el compás sin cerrarlo y clavar la aguja en otro lado: mismo radio (mediatriz, copiar segmentos) */
class Trasladando extends StateNode {
  static override id = 'trasladando'

  override onPointerMove() {
    const p = this.editor.inputs.getCurrentPagePoint()
    moverCompas(this.editor, { x: p.x, y: p.y })
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

  // Otra herramienta o el segundo Esc: el compás se guarda
  override onExit() {
    guardarCompas(this.editor)
  }
}

/** Ayuda para quien usa el compás (las demás no la ven). Va en components.OnTheCanvas: ya está en coordenadas de la hoja. */
export function GuiaCompas() {
  const editor = useEditor()
  const c = useValue('mi-compas', () => leerCompas(editor), [editor])
  const z = useValue('zoom', () => editor.getZoomLevel(), [editor])
  if (!c) return null

  const { fase } = c.props
  const ayuda =
    fase === 'enMano'
      ? 'clic: clavar con esta abertura · arrastrá: abrir · Esc: guardar'
      : fase === 'abierto'
        ? 'arrastrá: arco · tocá: círculo · aguja: mover · Esc: levantar'
        : fase === 'abriendo'
          ? 'soltá para fijar el radio'
          : ''
  if (!ayuda) return null

  // zIndex alto: los shapes tienen 8000 o más y taparían la ayuda
  return (
    <svg
      className="absolute top-0 left-0 overflow-visible pointer-events-none"
      style={{ zIndex: 100000 }}
      width={1}
      height={1}
      aria-hidden="true"
    >
      <text
        x={c.x}
        y={c.y + 22 / z}
        textAnchor="middle"
        fontSize={11 / z}
        fill="#6b21a8"
        stroke="white"
        strokeWidth={3 / z}
        paintOrder="stroke"
      >
        {ayuda}
      </text>
    </svg>
  )
}
